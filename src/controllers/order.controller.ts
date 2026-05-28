import { Response } from "express";
import { P } from "../libs/types/common";
import { ExtendedRequest } from "../libs/types/user";
import { OrderInput } from "../libs/types/order";
import { HttpCode } from "../libs/Errors";
import { ok } from "../libs/utils/apiResponse";
import { catchHttp } from "../libs/utils/httpCatch";
import { logger } from "../libs/utils/logger";
import OrderService from "../services/order.service";

const orderService = new OrderService();
const orderController: P = {};

orderController.createOrder = async (req: ExtendedRequest, res: Response) => {
  try {
    logger.info("Order controller [createOrder]");
    const input: OrderInput = req.body;
    const order = await orderService.createOrder(String(req.user!._id), input);
    res.status(HttpCode.CREATED).json(ok({ order }));
  } catch (error) {
    logger.error("Order controller [createOrder] failed", error);
    catchHttp(res, error);
  }
};

orderController.getMyOrders = async (req: ExtendedRequest, res: Response) => {
  try {
    logger.info("Order controller [getMyOrders]");
    const inquiry = req.query as any;
    const { list, total } = await orderService.getMyOrders(
      String(req.user!._id),
      inquiry
    );
    res
      .status(HttpCode.OK)
      .json(ok(list, { total, page: inquiry.page, limit: inquiry.limit }));
  } catch (error) {
    logger.error("Order controller [getMyOrders] failed", error);
    catchHttp(res, error);
  }
};

orderController.getOrder = async (req: ExtendedRequest, res: Response) => {
  try {
    logger.info("Order controller [getOrder]");
    const order = await orderService.getOrder(
      String(req.params.id),
      String(req.user!._id),
      req.user!.userRole
    );
    res.status(HttpCode.OK).json(ok({ order }));
  } catch (error) {
    logger.error("Order controller [getOrder] failed", error);
    catchHttp(res, error);
  }
};

orderController.updateStatus = async (req: ExtendedRequest, res: Response) => {
  try {
    logger.info("Order controller [updateStatus]");
    const order = await orderService.updateStatus(
      String(req.params.id),
      req.body.orderStatus
    );
    res.status(HttpCode.OK).json(ok({ order }));
  } catch (error) {
    logger.error("Order controller [updateStatus] failed", error);
    catchHttp(res, error);
  }
};

export default orderController;
