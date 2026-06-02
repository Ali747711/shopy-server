import { z } from "zod";

export const aiSearchSchema = z.object({
  query: z.string().trim().min(2).max(500),
});

export const aiChatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(2000),
      })
    )
    .min(1)
    .max(20),
});
