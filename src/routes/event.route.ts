import { Router } from "express";
import eventController from "../controllers/event.controller";
import userController from "../controllers/user.controller";
import { validate } from "../middlewares/validate.middleware";
import { createEventSchema } from "../validators/event.validator";

const eventRouter = Router();

eventRouter.post(
  "/",
  userController.optionalAuth,
  validate(createEventSchema),
  eventController.track
);

export default eventRouter;
