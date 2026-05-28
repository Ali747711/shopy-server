import { z } from "zod";

export const aiSearchSchema = z.object({
  query: z.string().trim().min(2).max(500),
});
