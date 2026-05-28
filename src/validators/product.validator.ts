import { z } from "zod";
import { ProductSort, ProductStatus } from "../libs/enums/product.enum";

const imageSchema = z.object({
  url: z.string().url(),
  alt: z.string().optional(),
});

export const createProductSchema = z.object({
  productName: z.string().trim().min(2).max(200),
  productDescription: z.string().trim().min(1).max(5000),
  productCategory: z.string().trim().min(1),
  productTags: z.array(z.string()).max(50).optional(),
  productPrice: z.number().nonnegative(),
  productCurrency: z.string().length(3).optional(),
  productStock: z.number().int().nonnegative().optional(),
  productImages: z.array(imageSchema).max(10).optional(),
  productAttributes: z.record(z.unknown()).optional(),
});

export const updateProductSchema = createProductSchema
  .partial()
  .extend({ productStatus: z.nativeEnum(ProductStatus).optional() });

export const productInquirySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  category: z.string().optional(),
  tags: z
    .string()
    .transform((s) => s.split(",").map((t) => t.trim()).filter(Boolean))
    .optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  search: z.string().optional(),
  sort: z.nativeEnum(ProductSort).optional(),
});
