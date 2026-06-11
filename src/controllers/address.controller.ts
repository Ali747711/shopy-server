import { Response } from "express";
import { P } from "../libs/types/common";
import { ExtendedRequest } from "../libs/types/user";
import { HttpCode } from "../libs/Errors";
import { ok } from "../libs/utils/apiResponse";
import { catchHttp } from "../libs/utils/httpCatch";
import { logger } from "../libs/utils/logger";
import AddressService from "../services/address.service";

const addressService = new AddressService();
const addressController: P = {};

addressController.list = async (req: ExtendedRequest, res: Response) => {
  try {
    logger.info("Address controller [list]");
    const addresses = await addressService.list(String(req.user!._id));
    res.status(HttpCode.OK).json(ok({ addresses }));
  } catch (error) {
    logger.error("Address controller [list] failed", error);
    catchHttp(res, error);
  }
};

addressController.create = async (req: ExtendedRequest, res: Response) => {
  try {
    logger.info("Address controller [create]");
    const addresses = await addressService.add(String(req.user!._id), req.body);
    res.status(HttpCode.CREATED).json(ok({ addresses }));
  } catch (error) {
    logger.error("Address controller [create] failed", error);
    catchHttp(res, error);
  }
};

addressController.update = async (req: ExtendedRequest, res: Response) => {
  try {
    logger.info("Address controller [update]");
    const addresses = await addressService.update(
      String(req.user!._id),
      String(req.params.id),
      req.body
    );
    res.status(HttpCode.OK).json(ok({ addresses }));
  } catch (error) {
    logger.error("Address controller [update] failed", error);
    catchHttp(res, error);
  }
};

addressController.remove = async (req: ExtendedRequest, res: Response) => {
  try {
    logger.info("Address controller [remove]");
    const addresses = await addressService.remove(
      String(req.user!._id),
      String(req.params.id)
    );
    res.status(HttpCode.OK).json(ok({ addresses }));
  } catch (error) {
    logger.error("Address controller [remove] failed", error);
    catchHttp(res, error);
  }
};

addressController.setDefault = async (req: ExtendedRequest, res: Response) => {
  try {
    logger.info("Address controller [setDefault]");
    const addresses = await addressService.setDefault(
      String(req.user!._id),
      String(req.params.id)
    );
    res.status(HttpCode.OK).json(ok({ addresses }));
  } catch (error) {
    logger.error("Address controller [setDefault] failed", error);
    catchHttp(res, error);
  }
};

export default addressController;
