import { ObjectId } from "mongoose";
import { EventType } from "../enums/event.enum";

export interface Event {
  _id: ObjectId;
  eventType: EventType;
  userId?: ObjectId | null;
  sessionId?: string;
  productId?: ObjectId | null;
  eventQuery?: string;
  eventMetadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventInput {
  eventType: EventType;
  sessionId?: string;
  productId?: string;
  eventQuery?: string;
  eventMetadata?: Record<string, unknown>;
}
