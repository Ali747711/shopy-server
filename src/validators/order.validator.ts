import { z } from "zod";
import { Currency } from "../libs/enums/currency.enum";
import { OrderStatus, PaymentMethod } from "../libs/enums/order.enum";
import { addressInputSchema } from "./address.validator";

/** Just the shipping fields — label/isDefault don't belong on an order snapshot. */
export const shippingAddressSchema = addressInputSchema.pick({
  fullName: true,
  phone: true,
  address1: true,
  address2: true,
  city: true,
  state: true,
  postalCode: true,
  country: true,
});

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
  shippingAddress: shippingAddressSchema,
});

export const updateOrderStatusSchema = z.object({
  orderStatus: z.nativeEnum(OrderStatus),
});

export const orderInquirySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.nativeEnum(OrderStatus).optional(),
});
