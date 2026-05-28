import { Response } from "express";
import Errors, { Message } from "../Errors";
import { fail } from "./apiResponse";

/** Maps a caught error to the standard response envelope. */
export const catchHttp = (res: Response, error: unknown): void => {
  if (error instanceof Errors) {
    res.status(error.code).json(fail(error.code, error.message));
    return;
  }
  res
    .status(Errors.standard.code)
    .json(fail(Errors.standard.code, Message.SOMETHING_WENT_WRONG));
};
