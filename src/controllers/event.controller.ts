import { Response } from "express";
import { P } from "../libs/types/common";
import { ExtendedRequest } from "../libs/types/user";
import { EventInput } from "../libs/types/event";
import { HttpCode } from "../libs/Errors";
import { ok } from "../libs/utils/apiResponse";
import { catchHttp } from "../libs/utils/httpCatch";
import { logger } from "../libs/utils/logger";
import EventService from "../services/event.service";

const eventService = new EventService();
const eventController: P = {};

eventController.track = async (req: ExtendedRequest, res: Response) => {
  try {
    logger.info("Event controller [track]");
    const input: EventInput = req.body;
    const userId = req.user?._id ? String(req.user._id) : undefined;
    const event = await eventService.track(input, userId);
    res.status(HttpCode.CREATED).json(ok({ event }));
  } catch (error) {
    logger.error("Event controller [track] failed", error);
    catchHttp(res, error);
  }
};

export default eventController;
