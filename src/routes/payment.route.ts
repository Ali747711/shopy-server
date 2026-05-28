import { Router } from "express";
import paymentController from "../controllers/payment.controller";
import userController from "../controllers/user.controller";
import { validate } from "../middlewares/validate.middleware";
import { checkoutSchema } from "../validators/payment.validator";

const paymentRouter = Router();

// Stripe posts here with a raw body (parsed in app.ts before express.json).
paymentRouter.post("/webhook", paymentController.webhook);

paymentRouter.get("/config", paymentController.config);
paymentRouter.post(
  "/checkout",
  userController.verifyAuth,
  validate(checkoutSchema),
  paymentController.createCheckout
);

export default paymentRouter;
