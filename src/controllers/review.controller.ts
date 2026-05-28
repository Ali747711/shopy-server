import { Request, Response } from "express";
import { P } from "../libs/types/common";
import { ExtendedRequest } from "../libs/types/user";
import { ReviewInput } from "../libs/types/review";
import { HttpCode } from "../libs/Errors";
import { ok } from "../libs/utils/apiResponse";
import { catchHttp } from "../libs/utils/httpCatch";
import { logger } from "../libs/utils/logger";
import ReviewService from "../services/review.service";

const reviewService = new ReviewService();
const reviewController: P = {};

reviewController.upsert = async (req: ExtendedRequest, res: Response) => {
  try {
    logger.info("Review controller [upsert]");
    const input: ReviewInput = req.body;
    const review = await reviewService.upsertReview(
      String(req.user!._id),
      String(req.params.id),
      input
    );
    res.status(HttpCode.CREATED).json(ok({ review }));
  } catch (error) {
    logger.error("Review controller [upsert] failed", error);
    catchHttp(res, error);
  }
};

reviewController.list = async (req: Request, res: Response) => {
  try {
    logger.info("Review controller [list]");
    const inquiry = req.query as any;
    const { list, total } = await reviewService.listReviews(
      String(req.params.id),
      inquiry
    );
    res
      .status(HttpCode.OK)
      .json(ok(list, { total, page: inquiry.page, limit: inquiry.limit }));
  } catch (error) {
    logger.error("Review controller [list] failed", error);
    catchHttp(res, error);
  }
};

reviewController.remove = async (req: ExtendedRequest, res: Response) => {
  try {
    logger.info("Review controller [remove]");
    await reviewService.deleteReview(String(req.user!._id), String(req.params.id));
    res.status(HttpCode.OK).json(ok({ deleted: true }));
  } catch (error) {
    logger.error("Review controller [remove] failed", error);
    catchHttp(res, error);
  }
};

export default reviewController;
