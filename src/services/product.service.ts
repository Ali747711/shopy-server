import { env } from "../config/env";
import { shapeIntoMongooseObjectId } from "../libs/configs";
import Errors, { HttpCode, Message } from "../libs/Errors";
import { ProductSort, ProductStatus } from "../libs/enums/product.enum";
import {
  Product,
  ProductInput,
  ProductInquiry,
  ProductUpdateInput,
} from "../libs/types/product";
import { logger } from "../libs/utils/logger";
import ProductModel from "../schemas/product.schema";
import EmbeddingService from "./ai/embedding.service";

const EMBED_FIELDS = [
  "productName",
  "productDescription",
  "productCategory",
  "productTags",
] as const;

class ProductService {
  private readonly productModel;
  private readonly embeddingService;

  constructor() {
    this.productModel = ProductModel;
    this.embeddingService = new EmbeddingService();
  }

  public createProduct = async (input: ProductInput): Promise<Product> => {
    const payload: any = { ...input };
    await this.attachEmbedding(payload, input);
    try {
      const created: any = await this.productModel.create(payload);
      return this.stripEmbedding(created.toObject());
    } catch {
      throw new Errors(HttpCode.BAD_REQUEST, Message.CREATE_FAILED);
    }
  };

  public getProduct = async (id: string): Promise<Product> => {
    const _id = shapeIntoMongooseObjectId(id);
    const product: any = await this.productModel
      .findOne({ _id, productStatus: { $ne: ProductStatus.DELETE } })
      .select("-productEmbedding")
      .exec();
    if (!product) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
    return product.toObject();
  };

  public getProducts = async (
    inquiry: ProductInquiry
  ): Promise<{ list: Product[]; total: number }> => {
    const match: any = { productStatus: ProductStatus.ACTIVE };
    if (inquiry.category) match.productCategory = inquiry.category;
    if (inquiry.tags?.length) match.productTags = { $in: inquiry.tags };
    if (inquiry.minPrice != null || inquiry.maxPrice != null) {
      match.productPrice = {};
      if (inquiry.minPrice != null) match.productPrice.$gte = inquiry.minPrice;
      if (inquiry.maxPrice != null) match.productPrice.$lte = inquiry.maxPrice;
    }
    if (inquiry.search) {
      const regex = new RegExp(inquiry.search, "i");
      match.$or = [{ productName: regex }, { productDescription: regex }];
    }

    const result: any = await this.productModel
      .aggregate([
        { $match: match },
        { $sort: this.buildSort(inquiry.sort) },
        {
          $facet: {
            list: [
              { $skip: (inquiry.page - 1) * inquiry.limit },
              { $limit: inquiry.limit },
              { $project: { productEmbedding: 0 } },
            ],
            total: [{ $count: "count" }],
          },
        },
      ])
      .exec();

    return {
      list: result[0]?.list ?? [],
      total: result[0]?.total?.[0]?.count ?? 0,
    };
  };

  public updateProduct = async (
    id: string,
    input: ProductUpdateInput
  ): Promise<Product> => {
    const _id = shapeIntoMongooseObjectId(id);
    const set: any = { ...input };

    // Re-embed only when a searchable field changed; merge with current doc
    // so a partial update still produces complete embedding text.
    if (EMBED_FIELDS.some((f) => f in input)) {
      const current: any = await this.productModel
        .findOne({ _id, productStatus: { $ne: ProductStatus.DELETE } })
        .exec();
      if (!current) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
      const merged = {
        productName: input.productName ?? current.productName,
        productDescription: input.productDescription ?? current.productDescription,
        productCategory: input.productCategory ?? current.productCategory,
        productTags: input.productTags ?? current.productTags,
      };
      await this.attachEmbedding(set, merged);
    }

    const updated: any = await this.productModel
      .findOneAndUpdate(
        { _id, productStatus: { $ne: ProductStatus.DELETE } },
        { $set: set },
        { new: true, runValidators: true }
      )
      .select("-productEmbedding")
      .exec();
    if (!updated) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
    return updated.toObject();
  };

  public deleteProduct = async (id: string): Promise<void> => {
    const _id = shapeIntoMongooseObjectId(id);
    const updated = await this.productModel.updateOne(
      { _id, productStatus: { $ne: ProductStatus.DELETE } },
      { $set: { productStatus: ProductStatus.DELETE } }
    );
    if (updated.matchedCount === 0)
      throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
  };

  /** Best-effort: embeds searchable text onto a write payload; never blocks the write. */
  private attachEmbedding = async (
    target: any,
    source: Pick<
      ProductInput,
      "productName" | "productDescription" | "productCategory" | "productTags"
    >
  ): Promise<void> => {
    try {
      const text = this.embeddingService.productText(source);
      target.productEmbedding = await this.embeddingService.embed(text);
      target.productEmbeddingModel = env.OPENAI_EMBED_MODEL;
      target.productEmbeddedAt = new Date();
    } catch (error) {
      logger.warn(
        "Embedding generation failed; product saved without embedding",
        error
      );
    }
  };

  private stripEmbedding = (obj: any): Product => {
    delete obj.productEmbedding;
    return obj as Product;
  };

  private buildSort = (sort?: ProductSort): Record<string, 1 | -1> => {
    switch (sort) {
      case ProductSort.PRICE_ASC:
        return { productPrice: 1 };
      case ProductSort.PRICE_DESC:
        return { productPrice: -1 };
      case ProductSort.RATING:
        return { productRatingAvg: -1 };
      default:
        return { createdAt: -1 };
    }
  };
}

export default ProductService;
