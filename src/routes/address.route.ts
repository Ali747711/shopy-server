import { Router } from "express";
import addressController from "../controllers/address.controller";
import userController from "../controllers/user.controller";
import { validate } from "../middlewares/validate.middleware";
import {
  addressInputSchema,
  addressUpdateSchema,
} from "../validators/address.validator";

const addressRouter = Router();

addressRouter.use(userController.verifyAuth);

addressRouter.get("/", addressController.list);
addressRouter.post("/", validate(addressInputSchema), addressController.create);
addressRouter.patch("/:id", validate(addressUpdateSchema), addressController.update);
addressRouter.delete("/:id", addressController.remove);
addressRouter.patch("/:id/default", addressController.setDefault);

export default addressRouter;
