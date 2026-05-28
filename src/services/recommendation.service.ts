import { openai } from "../config/openai";
import { env } from "../config/env";
import { redis } from "../config/redis";
import { shapeIntoMongooseObjectId } from "../libs/configs";
import Errors, { HttpCode, Message } from "../libs/Errors";
import { ProductStatus } from "../libs/enums/product.enum";
import {
  RecommendationResult,
  RecommendationSource,
  RecommendedProduct,
} from "../libs/types/recommendation";
import { logger } from "../libs/utils/logger";
import EventModel from "../schemas/event.schema";
import ProductModel from "../schemas/product.schema";
import CostService from "./ai/cost.service";
import { vectorSearchProducts } from "./ai/vector";

const DEFAULT_LIMIT = 10;
const SIMILAR_TTL = 60 * 60; // 1h
const PERSONAL_TTL = 60 * 10; // 10m
const PROJECTION =
  "productName productDescription productCategory productPrice productCurrency productTags";

class RecommendationService {
  private readonly productModel = ProductModel;
  private readonly eventModel = EventModel;
  private readonly costService = new CostService();

  /** "Because you viewed X" — products similar to one product's embedding. */
  public similar = async (
    productId: string,
    limit = 8
  ): Promise<RecommendedProduct[]> => {
    const cacheKey = `rec:similar:${productId}:${limit}`;
    const cached = await redis.get<RecommendedProduct[]>(cacheKey);
    if (cached) return cached;

    const _id = shapeIntoMongooseObjectId(productId);
    const product: any = await this.productModel
      .findById(_id)
      .select("+productEmbedding productName")
      .lean()
      .exec();
    if (!product) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
    if (!product.productEmbedding?.length) return [];

    const docs = await vectorSearchProducts(product.productEmbedding, {
      excludeIds: [_id],
      limit,
    });
    const items = docs.map((d) =>
      this.toRec(d, `Similar to ${product.productName}`, "similar", d.score)
    );
    await redis.set(cacheKey, items, { ex: SIMILAR_TTL });
    return items;
  };

  /** "Recommended for you" — personalized blend with cold-start fallback. */
  public forUser = async (
    userId: string,
    limit = DEFAULT_LIMIT,
    explain = false
  ): Promise<RecommendationResult> => {
    const cacheKey = `rec:user:${userId}:${limit}:${explain ? "x" : "b"}`;
    const cached = await redis.get<RecommendationResult>(cacheKey);
    if (cached) return { ...cached, cached: true };

    const engaged = await this.userEngagement(userId);
    let result: RecommendationResult;

    if (!engaged.length) {
      result = { strategy: "cold-start", items: await this.coldStart(limit, []), cached: false };
    } else {
      const engagedIds = engaged.map((e) => e._id);
      const profile = await this.profileVector(engaged);
      const items: RecommendedProduct[] = [];
      const seen = new Set<string>(engagedIds.map(String));

      // 1) content-based
      if (profile.vector) {
        try {
          const docs = await vectorSearchProducts(profile.vector, {
            excludeIds: engagedIds,
            limit,
          });
          for (const d of docs) {
            seen.add(String(d._id));
            items.push(
              this.toRec(
                d,
                `Based on your interest in ${profile.topName}`,
                "content",
                d.score
              )
            );
          }
        } catch (error) {
          logger.warn("Content-based recs unavailable (vector search)", error);
        }
      }

      // 2) collaborative fill
      if (items.length < limit) {
        const collab = await this.collaborative(userId, engagedIds, seen, limit - items.length);
        collab.forEach((c) => seen.add(c._id));
        items.push(...collab);
      }

      // 3) trending fill
      if (items.length < limit) {
        const trend = await this.trending(limit - items.length, seen);
        items.push(...trend);
      }

      let ranked = items.slice(0, limit);
      // 4) optional LLM re-ranking + personalized reasons
      if (explain && ranked.length) ranked = await this.llmRerank(profile.names, ranked);

      result = { strategy: "personalized", items: ranked, cached: false };
    }

    await redis.set(cacheKey, result, { ex: PERSONAL_TTL });
    return result;
  };

  /** Aggregated per-product engagement weight for a user (events only for now). */
  private userEngagement = async (
    userId: string
  ): Promise<{ _id: any; weight: number }[]> => {
    return this.eventModel.aggregate([
      { $match: { userId: shapeIntoMongooseObjectId(userId), productId: { $ne: null } } },
      {
        $group: {
          _id: "$productId",
          weight: {
            $sum: {
              $switch: {
                branches: [
                  { case: { $eq: ["$eventType", "PURCHASE"] }, then: 3 },
                  { case: { $eq: ["$eventType", "ADD_TO_CART"] }, then: 2 },
                  { case: { $eq: ["$eventType", "CLICK"] }, then: 1.5 },
                  { case: { $eq: ["$eventType", "VIEW"] }, then: 1 },
                ],
                default: 0,
              },
            },
          },
        },
      },
      { $sort: { weight: -1 } },
      { $limit: 50 },
    ]);
  };

  /** Weighted average of engaged products' embeddings → a taste vector. */
  private profileVector = async (
    engaged: { _id: any; weight: number }[]
  ): Promise<{ vector: number[] | null; topName: string; names: string[] }> => {
    const ids = engaged.map((e) => e._id);
    const products: any[] = await this.productModel
      .find({ _id: { $in: ids }, productStatus: ProductStatus.ACTIVE })
      .select("+productEmbedding productName")
      .lean()
      .exec();

    const weightOf = new Map(engaged.map((e) => [String(e._id), e.weight]));
    let acc: number[] | null = null;
    let totalWeight = 0;
    let topName = "your recent activity";
    let topWeight = -1;

    for (const p of products) {
      const w = weightOf.get(String(p._id)) ?? 0;
      if (w > topWeight) {
        topWeight = w;
        topName = p.productName;
      }
      if (!p.productEmbedding?.length || w <= 0) continue;
      if (!acc) acc = new Array(p.productEmbedding.length).fill(0);
      for (let i = 0; i < acc.length; i++) acc[i] += p.productEmbedding[i] * w;
      totalWeight += w;
    }

    if (acc && totalWeight > 0) for (let i = 0; i < acc.length; i++) acc[i] /= totalWeight;

    const names = [...products]
      .sort((a, b) => (weightOf.get(String(b._id)) ?? 0) - (weightOf.get(String(a._id)) ?? 0))
      .map((p) => p.productName);

    return { vector: acc, topName, names };
  };

  /**
   * Opt-in: re-orders candidates and writes a short personalized reason per item
   * using a cheap model. Falls back to the base order if budget is hit or it errors.
   */
  private llmRerank = async (
    interests: string[],
    items: RecommendedProduct[]
  ): Promise<RecommendedProduct[]> => {
    if (await this.costService.budgetExceeded()) return items;
    try {
      const list = items
        .map(
          (it, i) =>
            `${i}. ${it.productName} (${it.productCategory}, $${it.productPrice}; tags: ${it.productTags.join(", ")})`
        )
        .join("\n");
      const prompt = `The shopper has shown interest in: ${interests.slice(0, 6).join(", ") || "general browsing"}.
Candidate products:
${list}

Re-order the candidates from most to least relevant for this shopper and give each a short reason (max ~12 words). Respond ONLY as JSON: {"ranked":[{"index":<candidate number>,"reason":"<reason>"}]} using only the indices above.`;

      const res = await openai.chat.completions.create({
        model: env.OPENAI_INTENT_MODEL,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You are a personalization re-ranking engine for e-commerce." },
          { role: "user", content: prompt },
        ],
      });
      await this.costService.record(
        env.OPENAI_INTENT_MODEL,
        res.usage?.prompt_tokens ?? 0,
        res.usage?.completion_tokens ?? 0
      );

      const parsed = JSON.parse(res.choices[0]?.message?.content || "{}");
      const ranked = Array.isArray(parsed.ranked) ? parsed.ranked : [];
      const out: RecommendedProduct[] = [];
      const used = new Set<number>();
      for (const r of ranked) {
        const idx = Number(r.index);
        if (items[idx] && !used.has(idx)) {
          used.add(idx);
          out.push({ ...items[idx], reason: String(r.reason || items[idx].reason) });
        }
      }
      items.forEach((it, i) => {
        if (!used.has(i)) out.push(it);
      });
      return out.length ? out : items;
    } catch (error) {
      logger.warn("LLM re-rank failed; using base ordering", error);
      return items;
    }
  };

  /** "Users who engaged with what you did also engaged with…" */
  private collaborative = async (
    userId: string,
    engagedIds: any[],
    exclude: Set<string>,
    limit: number
  ): Promise<RecommendedProduct[]> => {
    const peers = await this.eventModel.distinct("userId", {
      productId: { $in: engagedIds },
      userId: { $nin: [shapeIntoMongooseObjectId(userId), null] },
    });
    if (!peers.length) return [];

    const rows: any[] = await this.eventModel.aggregate([
      {
        $match: {
          userId: { $in: peers },
          productId: { $ne: null, $nin: engagedIds },
        },
      },
      { $group: { _id: "$productId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit * 3 },
    ]);

    const ids = rows.map((r) => r._id).filter((id) => !exclude.has(String(id)));
    const products = await this.loadOrdered(ids, limit);
    return products.map((p) =>
      this.toRec(p, "Popular with shoppers like you", "collaborative", 0)
    );
  };

  /** Most-engaged products recently; falls back to newest if no events. */
  private trending = async (
    limit: number,
    exclude: Set<string>
  ): Promise<RecommendedProduct[]> => {
    const rows: any[] = await this.eventModel.aggregate([
      { $match: { productId: { $ne: null } } },
      { $group: { _id: "$productId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit * 3 },
    ]);

    let ids = rows.map((r) => r._id).filter((id) => !exclude.has(String(id)));
    let products = await this.loadOrdered(ids, limit);

    if (!products.length) {
      products = await this.productModel
        .find({ productStatus: ProductStatus.ACTIVE, _id: { $nin: [...exclude] } })
        .select(PROJECTION)
        .sort({ productRatingAvg: -1, createdAt: -1 })
        .limit(limit)
        .lean()
        .exec();
    }
    return products.map((p) => this.toRec(p, "Trending now", "trending", 0));
  };

  private coldStart = async (
    limit: number,
    excludeIds: any[]
  ): Promise<RecommendedProduct[]> =>
    this.trending(limit, new Set(excludeIds.map(String)));

  /** Loads products by id, preserving the given id ordering. */
  private loadOrdered = async (ids: any[], limit: number): Promise<any[]> => {
    if (!ids.length) return [];
    const docs: any[] = await this.productModel
      .find({ _id: { $in: ids }, productStatus: ProductStatus.ACTIVE })
      .select(PROJECTION)
      .lean()
      .exec();
    const byId = new Map(docs.map((d) => [String(d._id), d]));
    return ids
      .map((id) => byId.get(String(id)))
      .filter(Boolean)
      .slice(0, limit);
  };

  private toRec = (
    d: any,
    reason: string,
    source: RecommendationSource,
    score: number
  ): RecommendedProduct => ({
    _id: String(d._id),
    productName: d.productName,
    productDescription: d.productDescription,
    productCategory: d.productCategory,
    productPrice: d.productPrice,
    productCurrency: d.productCurrency,
    productTags: d.productTags ?? [],
    score,
    reason,
    source,
  });
}

export default RecommendationService;
