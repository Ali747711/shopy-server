import mongoose, { Schema } from "mongoose";
import { EventType } from "../libs/enums/event.enum";

const eventSchema = new Schema(
  {
    eventType: { type: String, enum: EventType, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    sessionId: { type: String, index: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", default: null, index: true },
    eventQuery: { type: String },
    eventMetadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

eventSchema.index({ createdAt: -1 });

export default mongoose.model("Event", eventSchema);
