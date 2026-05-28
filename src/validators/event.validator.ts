import { z } from "zod";
import { EventType } from "../libs/enums/event.enum";

export const createEventSchema = z.object({
  eventType: z.nativeEnum(EventType),
  sessionId: z.string().optional(),
  productId: z.string().optional(),
  eventQuery: z.string().optional(),
  eventMetadata: z.record(z.unknown()).optional(),
});
