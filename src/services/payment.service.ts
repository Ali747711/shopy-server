import type Stripe from "stripe";
import { stripe, isStripeConfigured } from "../config/stripe";
import { env } from "../config/env";
import { toStripeMinorUnits } from "../config/currency";
import { shapeIntoMongooseObjectId } from "../libs/configs";
import Errors, { HttpCode, Message } from "../libs/Errors";
import { Currency } from "../libs/enums/currency.enum";
import { OrderStatus, PaymentMethod, PaymentStatus } from "../libs/enums/order.enum";
import { logger } from "../libs/utils/logger";
import OrderModel from "../schemas/order.schema";

class PaymentService {
  private readonly orderModel = OrderModel;

  /** Creates a Stripe Checkout Session for a STRIPE order and returns its URL. */
  public createCheckoutSession = async (
    orderId: string,
    userId: string
  ): Promise<{ url: string | null; sessionId: string }> => {
    if (!isStripeConfigured())
      throw new Errors(HttpCode.SERVICE_UNAVAILABLE, Message.PAYMENTS_NOT_CONFIGURED);

    const order: any = await this.orderModel
      .findById(shapeIntoMongooseObjectId(orderId))
      .exec();
    if (!order) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
    if (String(order.userId) !== String(userId))
      throw new Errors(HttpCode.FORBIDDEN, Message.NOT_AUTHORIZED);
    if (order.paymentMethod !== PaymentMethod.STRIPE)
      throw new Errors(HttpCode.BAD_REQUEST, Message.NOT_STRIPE_ORDER);
    if (order.paymentStatus === PaymentStatus.PAID)
      throw new Errors(HttpCode.BAD_REQUEST, Message.ORDER_ALREADY_PAID);

    const currency = order.orderCurrency as Currency;
    const lineItems = order.orderItems.map((i: any) => ({
      price_data: {
        currency: currency.toLowerCase(),
        product_data: { name: i.productName },
        unit_amount: toStripeMinorUnits(i.priceAtPurchase, currency),
      },
      quantity: i.qty,
    }));

    const session = await stripe!.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: `${env.CHECKOUT_SUCCESS_URL}?order=${order._id}`,
      cancel_url: `${env.CHECKOUT_CANCEL_URL}?order=${order._id}`,
      client_reference_id: String(order._id),
      metadata: { orderId: String(order._id) },
    });

    order.stripeSessionId = session.id;
    await order.save();
    return { url: session.url, sessionId: session.id };
  };

  /** Verifies + processes a Stripe webhook (expects the raw request body). */
  public handleWebhook = async (
    rawBody: Buffer,
    signature: string | undefined
  ): Promise<void> => {
    if (!isStripeConfigured() || !env.STRIPE_WEBHOOK_SECRET)
      throw new Errors(HttpCode.SERVICE_UNAVAILABLE, Message.PAYMENTS_NOT_CONFIGURED);

    let event: Stripe.Event;
    try {
      event = stripe!.webhooks.constructEvent(
        rawBody,
        signature ?? "",
        env.STRIPE_WEBHOOK_SECRET
      );
    } catch (error) {
      logger.warn("Stripe webhook signature verification failed", error);
      throw new Errors(HttpCode.BAD_REQUEST, Message.WEBHOOK_INVALID);
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await this.markPaid(session);
        break;
      }
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await this.markFailed(session);
        break;
      }
      default:
        logger.info(`Unhandled Stripe event: ${event.type}`);
    }
  };

  private orderIdOf = (session: Stripe.Checkout.Session): string | undefined =>
    session.metadata?.orderId || session.client_reference_id || undefined;

  private markPaid = async (session: Stripe.Checkout.Session): Promise<void> => {
    const orderId = this.orderIdOf(session);
    if (!orderId) return;
    await this.orderModel.updateOne(
      { _id: shapeIntoMongooseObjectId(orderId) },
      {
        $set: {
          paymentStatus: PaymentStatus.PAID,
          orderStatus: OrderStatus.PAID,
          stripePaymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id,
        },
      }
    );
    logger.info(`Order ${orderId} marked PAID via Stripe`);
  };

  private markFailed = async (session: Stripe.Checkout.Session): Promise<void> => {
    const orderId = this.orderIdOf(session);
    if (!orderId) return;
    await this.orderModel.updateOne(
      { _id: shapeIntoMongooseObjectId(orderId), paymentStatus: { $ne: PaymentStatus.PAID } },
      { $set: { paymentStatus: PaymentStatus.FAILED } }
    );
    logger.info(`Order ${orderId} payment failed/expired`);
  };
}

export default PaymentService;
