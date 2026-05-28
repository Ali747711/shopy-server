import { ObjectId } from "mongoose";
import { ProductSort, ProductStatus } from "../enums/product.enum";

export interface ProductImage {
  url: string;
  alt?: string;
}

export interface Product {
  _id: ObjectId;
  productName: string;
  productDescription: string;
  productCategory: string;
  productTags: string[];
  productPrice: number;
  productCurrency: string;
  productStock: number;
  productImages: ProductImage[];
  productAttributes: Record<string, unknown>;
  productStatus: ProductStatus;
  productRatingAvg: number;
  productRatingCount: number;
  // Phase 2 (vector search)
  productEmbedding?: number[];
  productEmbeddingModel?: string;
  productEmbeddedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductInput {
  productName: string;
  productDescription: string;
  productCategory: string;
  productTags?: string[];
  productPrice: number;
  productCurrency?: string;
  productStock?: number;
  productImages?: ProductImage[];
  productAttributes?: Record<string, unknown>;
}

export interface ProductUpdateInput extends Partial<ProductInput> {
  productStatus?: ProductStatus;
}

export interface ProductInquiry {
  page: number;
  limit: number;
  category?: string;
  tags?: string[];
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  sort?: ProductSort;
}
