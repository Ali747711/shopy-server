import { redis } from "../../config/redis";
import { env } from "../../config/env";
import { logger } from "../../libs/utils/logger";

/** USD per 1M tokens. Approximate OpenAI list prices; adjust if pricing changes. */
const PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "text-embedding-3-small": { input: 0.02, output: 0 },
  "text-embedding-3-large": { input: 0.13, output: 0 },
};

const dayKey = () => `ai:spend:${new Date().toISOString().slice(0, 10)}`;
const TTL_SECONDS = 60 * 60 * 36; // keep ~1.5 days

export class CostService {
  /** Estimated USD already spent today. */
  public spentToday = async (): Promise<number> => {
    const raw = await redis.get<number>(dayKey());
    return typeof raw === "number" ? raw : Number(raw ?? 0);
  };

  /** True when today's estimated spend is at/over the configured budget. */
  public budgetExceeded = async (): Promise<boolean> => {
    return (await this.spentToday()) >= env.AI_DAILY_BUDGET_USD;
  };

  public costOf = (
    model: string,
    inputTokens: number,
    outputTokens = 0
  ): number => {
    const p = PRICING[model];
    if (!p) return 0;
    return (
      (inputTokens / 1_000_000) * p.input +
      (outputTokens / 1_000_000) * p.output
    );
  };

  /** Records spend for a call and returns the new daily total. */
  public record = async (
    model: string,
    inputTokens: number,
    outputTokens = 0
  ): Promise<number> => {
    const cost = this.costOf(model, inputTokens, outputTokens);
    if (cost <= 0) return this.spentToday();
    const key = dayKey();
    const total = await redis.incrbyfloat(key, cost);
    await redis.expire(key, TTL_SECONDS);
    logger.info(
      `AI spend +$${cost.toFixed(6)} (${model}) → today $${Number(total).toFixed(4)}`
    );
    return Number(total);
  };
}

export default CostService;
