import crypto from "crypto";
import { openai } from "../../config/openai";
import { redis } from "../../config/redis";
import { env } from "../../config/env";
import { ProductInput } from "../../libs/types/product";
import CostService from "./cost.service";

const EMB_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days — embeddings are stable

export class EmbeddingService {
  private readonly costService = new CostService();

  private cacheKey = (text: string): string =>
    `emb:${env.OPENAI_EMBED_MODEL}:${crypto
      .createHash("sha256")
      .update(text)
      .digest("hex")}`;

  /** Embeds text, returning a cached vector when the same text was seen before. */
  public embed = async (text: string): Promise<number[]> => {
    const key = this.cacheKey(text);
    const cached = await redis.get<number[]>(key);
    if (Array.isArray(cached) && cached.length) return cached;

    const res = await openai.embeddings.create({
      model: env.OPENAI_EMBED_MODEL,
      input: text,
    });
    const vector = res.data[0].embedding;
    await this.costService.record(
      env.OPENAI_EMBED_MODEL,
      res.usage?.total_tokens ?? 0
    );
    await redis.set(key, vector, { ex: EMB_TTL_SECONDS });
    return vector;
  };

  /** Canonical text representation of a product for embedding. */
  public productText = (
    p: Pick<
      ProductInput,
      "productName" | "productDescription" | "productCategory" | "productTags"
    >
  ): string =>
    [
      p.productName,
      p.productCategory,
      (p.productTags ?? []).join(", "),
      p.productDescription,
    ]
      .filter(Boolean)
      .join(". ");
}

export default EmbeddingService;
