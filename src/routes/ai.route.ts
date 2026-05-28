import { Router } from "express";
import aiController from "../controllers/ai.controller";
import userController from "../controllers/user.controller";
import { validate } from "../middlewares/validate.middleware";
import { aiSearchSchema } from "../validators/ai.validator";

const aiRouter = Router();

aiRouter.post(
  "/search",
  userController.optionalAuth,
  validate(aiSearchSchema),
  aiController.search
);

aiRouter.post(
  "/search/stream",
  userController.optionalAuth,
  validate(aiSearchSchema),
  aiController.searchStream
);

export default aiRouter;
