import { z } from "zod";

export const checkoutSchema = z.object({
  orderId: z.string().min(1),
});
