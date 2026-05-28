import { Router } from "express";
import mongoose from "mongoose";
import { pingRedis } from "../config/redis";
import { HttpCode } from "../libs/Errors";

const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  const mongoUp = mongoose.connection.readyState === 1;
  const redisUp = await pingRedis();
  const ok = mongoUp && redisUp;

  res.status(ok ? HttpCode.OK : HttpCode.INTERNAL_SERVER_ERROR).json({
    status: ok ? "ok" : "degraded",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services: {
      mongo: mongoUp ? "up" : "down",
      redis: redisUp ? "up" : "down",
    },
  });
});

export default healthRouter;
