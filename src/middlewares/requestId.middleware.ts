import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";

/** Assigns/propagates a correlation id per request and echoes it back. */
export const requestId = (req: Request, res: Response, next: NextFunction) => {
  const incoming = req.headers["x-request-id"];
  const id = (Array.isArray(incoming) ? incoming[0] : incoming) || randomUUID();
  (req as any).id = id;
  res.setHeader("X-Request-Id", id);
  next();
};
