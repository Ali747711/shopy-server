// Dev helper: clears Upstash rate-limit keys so repeated local test runs
// aren't throttled.  Usage: node scripts/clear-ratelimit.mjs
import { Redis } from "@upstash/redis";
import dotenv from "dotenv";

dotenv.config();

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const keys = await redis.keys("rl:*");
if (keys.length) await redis.del(...keys);
console.log(`cleared ${keys.length} rate-limit key(s)`);
