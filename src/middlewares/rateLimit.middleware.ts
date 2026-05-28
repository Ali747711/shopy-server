import { Ratelimit } from "@upstash/ratelimit";
import { NextFunction, Response } from "express";
import { redis } from "../config/redis";
import { env } from "../config/env";
import { ExtendedRequest } from "../libs/types/user";
import { HttpCode, Message } from "../libs/Errors";
import { fail } from "../libs/utils/apiResponse";
import { logger } from "../libs/utils/logger";

interface RateLimitOpts {
  requests: number;
  windowSec: number;
  prefix: string;
}

/**
 * Builds a sliding-window rate-limit middleware backed by Upstash Redis.
 * Identifies callers by user id when authenticated, else by IP.
 */
export const makeRateLimiter = (opts: RateLimitOpts) => {
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(opts.requests, `${opts.windowSec} s`),
    prefix: `rl:${opts.prefix}`,
    analytics: false,
  });

  return async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const identifier = req.user?._id ? `u:${req.user._id}` : `ip:${req.ip}`;
    try {
      const { success, limit, remaining, reset } = await limiter.limit(identifier);
      res.setHeader("X-RateLimit-Limit", String(limit));
      res.setHeader("X-RateLimit-Remaining", String(Math.max(0, remaining)));
      res.setHeader("X-RateLimit-Reset", String(reset));
      if (!success) {
        res.setHeader("Retry-After", String(Math.ceil((reset - Date.now()) / 1000)));
        res
          .status(HttpCode.TOO_MANY_REQUESTS)
          .json(fail(HttpCode.TOO_MANY_REQUESTS, Message.TOO_MANY_REQUESTS));
        return;
      }
      next();
    } catch (error) {
      // Fail open: a rate-limiter outage must not take the API down.
      logger.warn("Rate limiter unavailable; allowing request", error);
      next();
    }
  };
};

const globalWindowSec = Math.max(1, Math.round(env.RATE_LIMIT_WINDOW_MS / 1000));

/** Per-IP guard across the whole API surface (env-tunable). */
export const globalRateLimiter = makeRateLimiter({
  requests: env.RATE_LIMIT_MAX,
  windowSec: globalWindowSec,
  prefix: "global",
});

/** Tight guard on AI endpoints — protects the OpenAI budget. */
export const aiRateLimiter = makeRateLimiter({
  requests: 15,
  windowSec: 60,
  prefix: "ai",
});
