import { Request, Response } from "express";
import { P } from "../libs/types/common";
import { ExtendedRequest } from "../libs/types/user";
import { HttpCode } from "../libs/Errors";
import { ok } from "../libs/utils/apiResponse";
import { catchHttp } from "../libs/utils/httpCatch";
import { logger } from "../libs/utils/logger";
import RecommendationService from "../services/recommendation.service";

const recommendationService = new RecommendationService();
const recommendationController: P = {};

recommendationController.forUser = async (req: ExtendedRequest, res: Response) => {
  try {
    logger.info("Recommendation controller [forUser]");
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const result = await recommendationService.forUser(String(req.user!._id), limit);
    res.status(HttpCode.OK).json(ok(result));
  } catch (error) {
    logger.error("Recommendation controller [forUser] failed", error);
    catchHttp(res, error);
  }
};

recommendationController.similar = async (req: Request, res: Response) => {
  try {
    logger.info("Recommendation controller [similar]");
    const limit = Math.min(Number(req.query.limit) || 8, 50);
    const items = await recommendationService.similar(String(req.params.productId), limit);
    res.status(HttpCode.OK).json(ok({ items }));
  } catch (error) {
    logger.error("Recommendation controller [similar] failed", error);
    catchHttp(res, error);
  }
};

export default recommendationController;
