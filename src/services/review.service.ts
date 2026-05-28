import { shapeIntoMongooseObjectId } from "../libs/configs";
import Errors, { HttpCode, Message } from "../libs/Errors";
import { ProductStatus } from "../libs/enums/product.enum";
import { Review, ReviewInput, ReviewInquiry } from "../libs/types/review";
import ProductModel from "../schemas/product.schema";
import ReviewModel from "../schemas/review.schema";
import UserModel from "../schemas/user.schema";

class ReviewService {
  private readonly reviewModel = ReviewModel;
  private readonly productModel = ProductModel;
  private readonly userModel = UserModel;

  /** Create or update the caller's single review for a product. */
  public upsertReview = async (
    userId: string,
    productId: string,
    input: ReviewInput
  ): Promise<Review> => {
    const pId = shapeIntoMongooseObjectId(productId);
    const product = await this.productModel
      .exists({ _id: pId, productStatus: { $ne: ProductStatus.DELETE } });
    if (!product) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);

    const user: any = await this.userModel
      .findById(shapeIntoMongooseObjectId(userId))
      .select("userName")
      .lean()
      .exec();
    if (!user) throw new Errors(HttpCode.UNAUTHORIZED, Message.NOT_AUTHENTICATED);
    const userName = user.userName;

    const review: any = await this.reviewModel
      .findOneAndUpdate(
        { userId: shapeIntoMongooseObjectId(userId), productId: pId },
        { $set: { rating: input.rating, comment: input.comment, userName } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      )
      .lean()
      .exec();

    await this.recomputeRatings(productId);
    return review;
  };

  public listReviews = async (
    productId: string,
    inquiry: ReviewInquiry
  ): Promise<{ list: Review[]; total: number }> => {
    const match = { productId: shapeIntoMongooseObjectId(productId) };
    const [list, total] = await Promise.all([
      this.reviewModel
        .find(match)
        .sort({ createdAt: -1 })
        .skip((inquiry.page - 1) * inquiry.limit)
        .limit(inquiry.limit)
        .lean()
        .exec(),
      this.reviewModel.countDocuments(match),
    ]);
    return { list: list as any, total };
  };

  public deleteReview = async (userId: string, productId: string): Promise<void> => {
    const res = await this.reviewModel.deleteOne({
      userId: shapeIntoMongooseObjectId(userId),
      productId: shapeIntoMongooseObjectId(productId),
    });
    if (res.deletedCount === 0)
      throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
    await this.recomputeRatings(productId);
  };

  /** Recomputes a product's average rating + count from its reviews. */
  private recomputeRatings = async (productId: string): Promise<void> => {
    const pId = shapeIntoMongooseObjectId(productId);
    const [agg] = await this.reviewModel.aggregate([
      { $match: { productId: pId } },
      { $group: { _id: "$productId", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);
    await this.productModel.updateOne(
      { _id: pId },
      {
        $set: {
          productRatingAvg: agg ? Math.round(agg.avg * 10) / 10 : 0,
          productRatingCount: agg ? agg.count : 0,
        },
      }
    );
  };
}

export default ReviewService;
