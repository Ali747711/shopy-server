import mongoose from "mongoose";

export const MORGAN_FORMAT =
  "Method: :method | URL: :url | :response-time ms | S-code: [:status] | HTTP/:http-version";

export const shapeIntoMongooseObjectId = (target: any) => {
  return typeof target === "string"
    ? new mongoose.Types.ObjectId(target)
    : target;
};
