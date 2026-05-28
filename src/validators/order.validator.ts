import { z } from "zod";
import { Currency } from "../libs/enums/currency.enum";
import { OrderStatus, PaymentMethod } from "../libs/enums/order.enum";

export const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        qty: z.number().int().positive().max(999),
      })
    )
    .min(1)
    .max(50),
  currency: z.nativeEnum(Currency).optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
});

export const updateOrderStatusSchema = z.object({
  orderStatus: z.nativeEnum(OrderStatus),
});

export const orderInquirySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.nativeEnum(OrderStatus).optional(),
});
