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
import { errorHandler, notFound } from "./middlewares/error.middleware";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN.split(",").map((o) => o.trim()),
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());
app.use(morgan(MORGAN_FORMAT));

// Routes
app.use("/health", healthRouter);
app.use("/api/auth", userRouter);
app.use("/api/products", productRouter);
app.use("/api/events", eventRouter);
app.use("/api/ai", aiRouter);

// Fallbacks
app.use(notFound);
app.use(errorHandler);

export default app;
