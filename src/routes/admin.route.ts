import { Router } from "express";
import adminController from "../controllers/admin.controller";
import userController from "../controllers/user.controller";

const adminRouter = Router();

adminRouter.get(
  "/stats",
  userController.verifyAuth,
  userController.verifyAdmin,
  adminController.getStats
);

export default adminRouter;
