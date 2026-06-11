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
  // Accept either ?tags=a,b (CSV) or ?tags=a&tags=b (repeated → array).
  tags: z
    .preprocess((v) => {
      if (Array.isArray(v)) return v.map(String);
      if (typeof v === "string")
        return v.split(",").map((t) => t.trim()).filter(Boolean);
      return undefined;
    }, z.array(z.string()).max(50).optional()),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  search: z.string().optional(),
  sort: z.nativeEnum(ProductSort).optional(),
  currency: z.string().optional(),
});

/** Admin product listing: same filters plus an optional status narrow. */
export const adminProductInquirySchema = productInquirySchema.extend({
  status: z.nativeEnum(ProductStatus).optional(),
});
