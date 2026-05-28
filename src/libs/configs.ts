import mongoose from "mongoose";

export const MORGAN_FORMAT =
  ":method :url [:status] :response-time ms | req::id";

export const shapeIntoMongooseObjectId = (target: any) => {
  return typeof target === "string"
    ? new mongoose.Types.ObjectId(target)
    : target;
};
