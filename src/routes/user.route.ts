import { Router } from "express";
import userController from "../controllers/user.controller";
import { validate } from "../middlewares/validate.middleware";
import {
  loginSchema,
  refreshSchema,
  registerSchema,
} from "../validators/user.validator";

const userRouter = Router();

userRouter.post("/register", validate(registerSchema), userController.register);
userRouter.post("/login", validate(loginSchema), userController.login);
userRouter.post("/refresh", validate(refreshSchema), userController.refresh);
userRouter.post("/logout", userController.verifyAuth, userController.logout);
userRouter.get("/me", userController.verifyAuth, userController.me);

export default userRouter;
