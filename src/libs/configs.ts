import mongoose from "mongoose";
import Errors, { HttpCode, Message } from "./Errors";

export const MORGAN_FORMAT =
  ":method :url [:status] :response-time ms | req::id";

/**
 * Normalizes an incoming id to an ObjectId. Throws a typed 400 for malformed
 * strings so callers get a clean validation error instead of a cast-driven 500.
 */
export const shapeIntoMongooseObjectId = (target: any) => {
  if (typeof target !== "string") return target;
  if (!mongoose.Types.ObjectId.isValid(target)) {
    throw new Errors(HttpCode.BAD_REQUEST, Message.INVALID_ID);
  }
  return new mongoose.Types.ObjectId(target);
};
