import { shapeIntoMongooseObjectId } from "../libs/configs";
import Errors, { HttpCode, Message } from "../libs/Errors";
import { ProductSort, ProductStatus } from "../libs/enums/product.enum";
import {
  Product,
  ProductInput,
  ProductInquiry,
  ProductUpdateInput,
} from "../libs/types/product";
import ProductModel from "../schemas/product.schema";

class ProductService {
  private readonly productModel;

  constructor() {
    this.productModel = ProductModel;
  }

  public createProduct = async (input: ProductInput): Promise<Product> => {
    try {
      const created: any = await this.productModel.create(input);
      return created.toObject();
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
    const updated: any = await this.productModel
      .findOneAndUpdate(
        { _id, productStatus: { $ne: ProductStatus.DELETE } },
        { $set: input },
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
