import mongoose, { Schema } from "mongoose";
import { ProductStatus } from "../libs/enums/product.enum";

const productImageSchema = new Schema(
  { url: { type: String, required: true }, alt: { type: String } },
  { _id: false }
);

const productSchema = new Schema(
  {
    productName: { type: String, required: true },
    productDescription: { type: String, required: true },
    productCategory: { type: String, required: true, index: true },
    productTags: { type: [String], default: [], index: true },
    productPrice: { type: Number, required: true, index: true },
    productCurrency: { type: String, default: "USD" },
    productStock: { type: Number, default: 0 },
    productImages: { type: [productImageSchema], default: [] },
    productAttributes: { type: Schema.Types.Mixed, default: {} },
    productStatus: {
      type: String,
      enum: ProductStatus,
      default: ProductStatus.ACTIVE,
    },
    productRatingAvg: { type: Number, default: 0 },
    productRatingCount: { type: Number, default: 0 },
    // Phase 2: vector search fields
    productEmbedding: { type: [Number], default: undefined, select: false },
    productEmbeddingModel: { type: String },
    productEmbeddedAt: { type: Date },
  },
  { timestamps: true }
);

// Keyword search across name + description (hybrid search uses this in Phase 2)
productSchema.index({ productName: "text", productDescription: "text" });

export default mongoose.model("Product", productSchema);
