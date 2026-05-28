import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";
import { HttpCode } from "../libs/Errors";
import { fail } from "../libs/utils/apiResponse";

type Target = "body" | "query" | "params";

/**
 * Validates a request segment against a Zod schema and replaces it with the
 * parsed (typed, coerced) value. On failure, responds with the standard
 * envelope including the offending field messages.
 */
export const validate =
  (schema: ZodSchema, target: Target = "body") =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const message = result.error.issues
        .map((i) => `${i.path.join(".") || target}: ${i.message}`)
        .join("; ");
      res.status(HttpCode.BAD_REQUEST).json(fail(HttpCode.BAD_REQUEST, message));
      return;
    }
    // Express 5 exposes req.query as a getter-only property, so it cannot be
    // reassigned directly — redefine it. body/params remain writable.
    if (target === "query") {
      Object.defineProperty(req, "query", {
        value: result.data,
        writable: true,
        configurable: true,
      });
    } else {
      req[target] = result.data;
    }
    next();
  };
