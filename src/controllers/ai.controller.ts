import { Response } from "express";
import { P } from "../libs/types/common";
import { ExtendedRequest } from "../libs/types/user";
import { EventType } from "../libs/enums/event.enum";
import { HttpCode } from "../libs/Errors";
import { ok } from "../libs/utils/apiResponse";
import { catchHttp } from "../libs/utils/httpCatch";
import { logger } from "../libs/utils/logger";
import AiSearchService from "../services/ai/search.service";
import EventService from "../services/event.service";

const aiSearchService = new AiSearchService();
const eventService = new EventService();
const aiController: P = {};

aiController.search = async (req: ExtendedRequest, res: Response) => {
  try {
    logger.info("AI controller [search]");
    const { query } = req.body;
    const result = await aiSearchService.search(query);

    // Fire-and-forget behavioral signal (don't block the response).
    const userId = req.user?._id ? String(req.user._id) : undefined;
    eventService
      .track({ eventType: EventType.SEARCH, eventQuery: query }, userId)
      .catch((e) => logger.warn("Failed to log search event", e));

    res.status(HttpCode.OK).json(ok(result));
  } catch (error) {
    logger.error("AI controller [search] failed", error);
    catchHttp(res, error);
  }
};

export default aiController;
