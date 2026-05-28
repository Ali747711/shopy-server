import { Router } from "express";
import orderController from "../controllers/order.controller";
import userController from "../controllers/user.controller";
import { validate } from "../middlewares/validate.middleware";
import {
  createOrderSchema,
  orderInquirySchema,
  updateOrderStatusSchema,
} from "../validators/order.validator";

const orderRouter = Router();

orderRouter.post(
  "/",
  userController.verifyAuth,
  validate(createOrderSchema),
  orderController.createOrder
);
orderRouter.get(
  "/",
  userController.verifyAuth,
  validate(orderInquirySchema, "query"),
  orderController.getMyOrders
);
orderRouter.get("/:id", userController.verifyAuth, orderController.getOrder);
orderRouter.patch(
  "/:id/status",
  userController.verifyAuth,
  userController.verifyAdmin,
  validate(updateOrderStatusSchema),
  orderController.updateStatus
);

export default orderRouter;
