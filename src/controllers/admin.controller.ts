import { Response } from "express";
import { P } from "../libs/types/common";
import { ExtendedRequest } from "../libs/types/user";
import { HttpCode } from "../libs/Errors";
import { ok } from "../libs/utils/apiResponse";
import { catchHttp } from "../libs/utils/httpCatch";
import { logger } from "../libs/utils/logger";
import AdminService from "../services/admin.service";

const adminService = new AdminService();
const adminController: P = {};

adminController.getStats = async (_req: ExtendedRequest, res: Response) => {
  try {
    logger.info("Admin controller [getStats]");
    const stats = await adminService.getStats();
    res.status(HttpCode.OK).json(ok({ stats }));
  } catch (error) {
    logger.error("Admin controller [getStats] failed", error);
    catchHttp(res, error);
  }
};

export default adminController;
