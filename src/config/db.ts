import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "../libs/utils/logger";

export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(env.MONGODB_URI, { dbName: env.MONGODB_DB_NAME });
    logger.info(`MongoDB connected → db "${env.MONGODB_DB_NAME}"`);
  } catch (error) {
    logger.error("MongoDB connection failed", error);
    throw error;
  }

  mongoose.connection.on("disconnected", () =>
    logger.warn("MongoDB disconnected")
  );
  mongoose.connection.on("error", (err) =>
    logger.error("MongoDB connection error", err)
  );
};
