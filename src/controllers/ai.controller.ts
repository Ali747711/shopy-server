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
    logSearch(query, req);
    res.status(HttpCode.OK).json(ok(result));
  } catch (error) {
    logger.error("AI controller [search] failed", error);
    catchHttp(res, error);
  }
};

aiController.searchStream = async (req: ExtendedRequest, res: Response) => {
  logger.info("AI controller [searchStream]");
  const { query } = req.body;
  res.writeHead(HttpCode.OK, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    if (typeof (res as any).flush === "function") (res as any).flush();
  };

  try {
    logSearch(query, req);

    const cached = await aiSearchService.getCached(query);
    if (cached) {
      send("meta", { intent: cached.intent, products: cached.products, degraded: cached.degraded, cached: true });
      if (cached.explanation) send("token", { t: cached.explanation });
      send("done", { explanation: cached.explanation, cached: true });
      return res.end();
    }

    const { intent, products, degraded } = await aiSearchService.resolve(query);
    send("meta", { intent, products, degraded, cached: false });

    let explanation = "";
    if (!degraded && products.length) {
      explanation = await aiSearchService.streamExplanation(query, products, (t) =>
        send("token", { t })
      );
    }
    await aiSearchService.cacheResult({ query, intent, products, explanation, cached: false, degraded });
    send("done", { explanation, cached: false });
    res.end();
  } catch (error) {
    logger.error("AI controller [searchStream] failed", error);
    send("error", { message: "Search failed" });
    res.end();
  }
};

const logSearch = (query: string, req: ExtendedRequest) => {
  const userId = req.user?._id ? String(req.user._id) : undefined;
  eventService
    .track({ eventType: EventType.SEARCH, eventQuery: query }, userId)
    .catch((e) => logger.warn("Failed to log search event", e));
};

export default aiController;
