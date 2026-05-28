import { Request, Response } from "express";
import { env } from "../config/env";
import { isStripeConfigured } from "../config/stripe";
import { P } from "../libs/types/common";
import { ExtendedRequest } from "../libs/types/user";
import Errors, { HttpCode, Message } from "../libs/Errors";
import { ok, fail } from "../libs/utils/apiResponse";
import { catchHttp } from "../libs/utils/httpCatch";
import { logger } from "../libs/utils/logger";
import PaymentService from "../services/payment.service";

const paymentService = new PaymentService();
const paymentController: P = {};

paymentController.config = async (_req: Request, res: Response) => {
  res.status(HttpCode.OK).json(
    ok({
      enabled: isStripeConfigured(),
      publishableKey: env.STRIPE_PUBLISHABLE_KEY ?? null,
    })
  );
};

paymentController.createCheckout = async (req: ExtendedRequest, res: Response) => {
  try {
    logger.info("Payment controller [createCheckout]");
    const result = await paymentService.createCheckoutSession(
      req.body.orderId,
      String(req.user!._id)
    );
    res.status(HttpCode.OK).json(ok(result));
  } catch (error) {
    logger.error("Payment controller [createCheckout] failed", error);
    catchHttp(res, error);
  }
};

// Raw body (Buffer) is required here for Stripe signature verification.
paymentController.webhook = async (req: Request, res: Response) => {
  try {
    await paymentService.handleWebhook(
      req.body as Buffer,
      req.headers["stripe-signature"] as string | undefined
    );
    res.status(HttpCode.OK).json({ received: true });
  } catch (error) {
    const code = error instanceof Errors ? error.code : HttpCode.BAD_REQUEST;
    const message = error instanceof Errors ? error.message : Message.WEBHOOK_INVALID;
    res.status(code).json(fail(code, message));
  }
};

export default paymentController;
