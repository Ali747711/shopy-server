import { Redis } from "@upstash/redis";
import { env } from "./env";
import { logger } from "../libs/utils/logger";

export const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

export const pingRedis = async (): Promise<boolean> => {
  try {
    const pong = await redis.ping();
    logger.info(`Redis connected → ${pong}`);
    return true;
  } catch (error) {
    logger.error("Redis ping failed", error);
    return false;
  }
};
