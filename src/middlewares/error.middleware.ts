import { NextFunction, Request, Response } from "express";
import Errors, { HttpCode, Message } from "../libs/Errors";
import { fail } from "../libs/utils/apiResponse";
import { logger } from "../libs/utils/logger";

export const notFound = (req: Request, res: Response) => {
  res
    .status(HttpCode.NOT_FOUND)
    .json(fail(HttpCode.NOT_FOUND, `Route not found: ${req.originalUrl}`));
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof Errors) {
    res.status(err.code).json(fail(err.code, err.message));
    return;
  }
  logger.error("Unhandled error", err);
  res
    .status(Errors.standard.code)
    .json(fail(Errors.standard.code, Message.SOMETHING_WENT_WRONG));
};
