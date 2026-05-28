import { Router } from "express";
import recommendationController from "../controllers/recommendation.controller";
import userController from "../controllers/user.controller";

const recommendationRouter = Router();

recommendationRouter.get(
  "/",
  userController.verifyAuth,
  recommendationController.forUser
);
recommendationRouter.get("/similar/:productId", recommendationController.similar);

export default recommendationRouter;
