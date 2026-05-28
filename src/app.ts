import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import compression from "compression";
import cookieParser from "cookie-parser";

import { env } from "./config/env";
import { MORGAN_FORMAT } from "./libs/configs";
import healthRouter from "./routes/health.route";
import userRouter from "./routes/user.route";
import productRouter from "./routes/product.route";
import eventRouter from "./routes/event.route";
import aiRouter from "./routes/ai.route";
import recommendationRouter from "./routes/recommendation.route";
import orderRouter from "./routes/order.route";
import paymentRouter from "./routes/payment.route";
import { errorHandler, notFound } from "./middlewares/error.middleware";
import { requestId } from "./middlewares/requestId.middleware";
import { aiRateLimiter, globalRateLimiter } from "./middlewares/rateLimit.middleware";

const app = express();

// Behind a proxy (Render/Railway) so req.ip reflects the real client.
app.set("trust proxy", 1);

morgan.token("id", (req: any) => req.id);

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN.split(",").map((o) => o.trim()),
    credentials: true,
  })
);
// Stripe webhook needs the raw body for signature verification — must run
// before express.json so the body isn't consumed/parsed as JSON.
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());
app.use(requestId);
app.use(morgan(MORGAN_FORMAT));

// Health is intentionally not rate-limited (monitoring/uptime probes).
app.use("/health", healthRouter);

// Payments mounted before the rate limiter so Stripe webhooks are never throttled.
app.use("/api/payments", paymentRouter);

// Per-IP guard across the API; AI endpoints get an extra tight limiter.
app.use("/api", globalRateLimiter);
app.use("/api/ai", aiRateLimiter);

app.use("/api/auth", userRouter);
app.use("/api/products", productRouter);
app.use("/api/events", eventRouter);
app.use("/api/ai", aiRouter);
app.use("/api/recommendations", recommendationRouter);
app.use("/api/orders", orderRouter);

// Fallbacks
app.use(notFound);
app.use(errorHandler);

export default app;
