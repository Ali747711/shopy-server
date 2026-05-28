import app from "./app";
import { env } from "./config/env";
import { connectDB } from "./config/db";
import { pingRedis } from "./config/redis";
import { logger } from "./libs/utils/logger";

const bootstrap = async (): Promise<void> => {
  await connectDB();
  await pingRedis();

  app.listen(env.PORT, () => {
    logger.info(`Shopy backend listening on http://localhost:${env.PORT}`);
    logger.info(`Environment: ${env.NODE_ENV}`);
  });
};

bootstrap().catch((error) => {
  logger.error("Fatal: failed to start server", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", reason);
});
