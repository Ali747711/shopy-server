import type { Server } from "http";
import mongoose from "mongoose";
import app from "./app";
import { env } from "./config/env";
import { connectDB } from "./config/db";
import { pingRedis } from "./config/redis";
import { logger } from "./libs/utils/logger";

let server: Server;

const bootstrap = async (): Promise<void> => {
  await connectDB();
  await pingRedis();

  server = app.listen(env.PORT, () => {
    logger.info(`Shopy backend listening on http://localhost:${env.PORT}`);
    logger.info(`Environment: ${env.NODE_ENV}`);
  });
};

const shutdown = async (signal: string): Promise<void> => {
  logger.info(`${signal} received — shutting down gracefully`);
  server?.close(async () => {
    await mongoose.disconnect();
    logger.info("HTTP server closed, MongoDB disconnected");
    process.exit(0);
  });
  // Hard-exit safety net if connections don't drain in time.
  setTimeout(() => process.exit(1), 10_000).unref();
};

bootstrap().catch((error) => {
  logger.error("Fatal: failed to start server", error);
  process.exit(1);
});

["SIGTERM", "SIGINT"].forEach((sig) =>
  process.on(sig, () => shutdown(sig))
);

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", reason);
});
