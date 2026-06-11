import { Router } from "express";
import productController from "../controllers/product.controller";
import reviewController from "../controllers/review.controller";
import userController from "../controllers/user.controller";
import { validate } from "../middlewares/validate.middleware";
import {
  adminProductInquirySchema,
  createProductSchema,
  productInquirySchema,
  updateProductSchema,
} from "../validators/product.validator";
import {
  reviewInquirySchema,
  upsertReviewSchema,
} from "../validators/review.validator";

const productRouter = Router();

// Public reads
productRouter.get(
  "/",
  validate(productInquirySchema, "query"),
  productController.getProducts
);
// Admin: list every product (any status). Before "/:id" so it isn't an id.
productRouter.get(
  "/admin",
  userController.verifyAuth,
  userController.verifyAdmin,
  validate(adminProductInquirySchema, "query"),
  productController.getAllProducts
);
productRouter.get("/:id", productController.getProduct);

// Admin writes
productRouter.post(
  "/",
  userController.verifyAuth,
  userController.verifyAdmin,
  validate(createProductSchema),
  productController.createProduct
);
productRouter.patch(
  "/:id",
  userController.verifyAuth,
  userController.verifyAdmin,
  validate(updateProductSchema),
  productController.updateProduct
);
productRouter.delete(
  "/:id",
  userController.verifyAuth,
  userController.verifyAdmin,
  productController.deleteProduct
);

// Reviews (nested under a product)
productRouter.get(
  "/:id/reviews",
  validate(reviewInquirySchema, "query"),
  reviewController.list
);
productRouter.post(
  "/:id/reviews",
  userController.verifyAuth,
  validate(upsertReviewSchema),
  reviewController.upsert
);
productRouter.delete(
  "/:id/reviews",
  userController.verifyAuth,
  reviewController.remove
);

export default productRouter;
