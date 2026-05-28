import crypto from "crypto";
import { openai } from "../../config/openai";
import { redis } from "../../config/redis";
import { env } from "../../config/env";
import { ProductStatus } from "../../libs/enums/product.enum";
import {
  AiSearchResult,
  ScoredProduct,
  SearchIntent,
} from "../../libs/types/ai";
import { logger } from "../../libs/utils/logger";
import ProductModel from "../../schemas/product.schema";
import CostService from "./cost.service";
import EmbeddingService from "./embedding.service";

const VECTOR_INDEX = "product_vector_index";
const RESULT_TTL_SECONDS = 60 * 60; // cache a full search response for 1h
const TOP_K = 8;
const NUM_CANDIDATES = 100;

const INTENT_SYSTEM_PROMPT = `You extract structured search filters from an e-commerce shopping query.
Return ONLY a JSON object with any of these keys you can confidently infer:
- "category": string (single product category, singular, lowercase)
- "minPrice": number
- "maxPrice": number
- "tags": string[] (descriptive attributes useful as tags)
- "attributes": string[] (qualities the user wants, e.g. "waterproof", "lightweight")
- "keywords": string (cleaned core search phrase)
Omit keys you cannot infer. Do not guess prices that are not stated.`;

const EXPLAIN_SYSTEM_PROMPT = `You are a concise shopping assistant. Given the user's query and a list of matched products, write 2-3 sentences explaining why these products fit the request. Reference concrete product attributes (price, material, use-case). Never mention products that are not in the provided list.`;

export class AiSearchService {
  private readonly embeddingService = new EmbeddingService();
  private readonly costService = new CostService();

  public search = async (query: string): Promise<AiSearchResult> => {
    const normalized = query.toLowerCase().trim();
    const cacheKey = `ai:search:${crypto
      .createHash("sha256")
      .update(normalized)
      .digest("hex")}`;

    const cached = await redis.get<AiSearchResult>(cacheKey);
    if (cached) return { ...cached, cached: true };

    const degraded = await this.costService.budgetExceeded();
    if (degraded) logger.warn("AI daily budget exceeded — degrading to non-LLM search");

    const intent = degraded
      ? this.fallbackIntent(query)
      : await this.extractIntent(query);

    const queryVector = await this.embeddingService.embed(query);
    const products = await this.retrieve(queryVector, intent, query);

    const explanation =
      degraded || products.length === 0
        ? ""
        : await this.explain(query, products);

    const result: AiSearchResult = {
      query,
      intent,
      products,
      explanation,
      cached: false,
      degraded,
    };
    await redis.set(cacheKey, result, { ex: RESULT_TTL_SECONDS });
    return result;
  };

  private extractIntent = async (query: string): Promise<SearchIntent> => {
    try {
      const res = await openai.chat.completions.create({
        model: env.OPENAI_INTENT_MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: INTENT_SYSTEM_PROMPT },
          { role: "user", content: query },
        ],
      });
      await this.costService.record(
        env.OPENAI_INTENT_MODEL,
        res.usage?.prompt_tokens ?? 0,
        res.usage?.completion_tokens ?? 0
      );
      return this.normalizeIntent(
        JSON.parse(res.choices[0]?.message?.content || "{}")
      );
    } catch (error) {
      logger.warn("Intent extraction failed; using fallback", error);
      return this.fallbackIntent(query);
    }
  };

  /** Hybrid retrieval: vector search + structured filters, with keyword fallback. */
  private retrieve = async (
    queryVector: number[],
    intent: SearchIntent,
    query: string
  ): Promise<ScoredProduct[]> => {
    const filter: any = { productStatus: { $eq: ProductStatus.ACTIVE } };
    if (intent.category) filter.productCategory = { $eq: intent.category };
    if (intent.minPrice != null || intent.maxPrice != null) {
      filter.productPrice = {};
      if (intent.minPrice != null) filter.productPrice.$gte = intent.minPrice;
      if (intent.maxPrice != null) filter.productPrice.$lte = intent.maxPrice;
    }

    try {
      const docs: any[] = await ProductModel.aggregate([
        {
          $vectorSearch: {
            index: VECTOR_INDEX,
            path: "productEmbedding",
            queryVector,
            numCandidates: NUM_CANDIDATES,
            limit: TOP_K,
            filter,
          },
        },
        {
          $project: {
            productName: 1,
            productDescription: 1,
            productCategory: 1,
            productPrice: 1,
            productCurrency: 1,
            productTags: 1,
            score: { $meta: "vectorSearchScore" },
          },
        },
      ]).exec();
      return docs.map((d) => this.toScored(d, d.score));
    } catch (error) {
      logger.warn("Vector search unavailable; falling back to keyword search", error);
      return this.keywordSearch(intent, query);
    }
  };

  private keywordSearch = async (
    intent: SearchIntent,
    query: string
  ): Promise<ScoredProduct[]> => {
    const match: any = { productStatus: ProductStatus.ACTIVE };
    if (intent.category) match.productCategory = intent.category;
    if (intent.minPrice != null || intent.maxPrice != null) {
      match.productPrice = {};
      if (intent.minPrice != null) match.productPrice.$gte = intent.minPrice;
      if (intent.maxPrice != null) match.productPrice.$lte = intent.maxPrice;
    }
    const term = intent.keywords || query;
    if (term) {
      const regex = new RegExp(term, "i");
      match.$or = [{ productName: regex }, { productDescription: regex }];
    }
    const docs: any[] = await ProductModel.find(match)
      .select("-productEmbedding")
      .limit(TOP_K)
      .lean()
      .exec();
    return docs.map((d) => this.toScored(d, 0));
  };

  private explain = async (
    query: string,
    products: ScoredProduct[]
  ): Promise<string> => {
    try {
      const context = products
        .map(
          (p) =>
            `- ${p.productName} ($${p.productPrice} ${p.productCurrency}, ${p.productCategory}; tags: ${p.productTags.join(", ")})`
        )
        .join("\n");
      const res = await openai.chat.completions.create({
        model: env.OPENAI_CHAT_MODEL,
        temperature: 0.4,
        messages: [
          { role: "system", content: EXPLAIN_SYSTEM_PROMPT },
          { role: "user", content: `Query: ${query}\n\nProducts:\n${context}` },
        ],
      });
      await this.costService.record(
        env.OPENAI_CHAT_MODEL,
        res.usage?.prompt_tokens ?? 0,
        res.usage?.completion_tokens ?? 0
      );
      return res.choices[0]?.message?.content?.trim() || "";
    } catch (error) {
      logger.warn("Explanation generation failed", error);
      return "";
    }
  };

  private toScored = (d: any, score: number): ScoredProduct => ({
    _id: String(d._id),
    productName: d.productName,
    productDescription: d.productDescription,
    productCategory: d.productCategory,
    productPrice: d.productPrice,
    productCurrency: d.productCurrency,
    productTags: d.productTags ?? [],
    score,
  });

  private normalizeIntent = (raw: any): SearchIntent => {
    const intent: SearchIntent = {};
    if (typeof raw.category === "string") intent.category = raw.category.toLowerCase();
    if (typeof raw.minPrice === "number") intent.minPrice = raw.minPrice;
    if (typeof raw.maxPrice === "number") intent.maxPrice = raw.maxPrice;
    if (Array.isArray(raw.tags)) intent.tags = raw.tags.map(String);
    if (Array.isArray(raw.attributes)) intent.attributes = raw.attributes.map(String);
    if (typeof raw.keywords === "string") intent.keywords = raw.keywords;
    return intent;
  };

  private fallbackIntent = (query: string): SearchIntent => ({ keywords: query });
}

export default AiSearchService;
