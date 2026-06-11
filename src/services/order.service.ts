import { convertFromUsd, normalizeCurrency } from "../config/currency";
import { shapeIntoMongooseObjectId } from "../libs/configs";
import Errors, { HttpCode, Message } from "../libs/Errors";
import { Currency } from "../libs/enums/currency.enum";
import { EventType } from "../libs/enums/event.enum";
import { OrderStatus, PaymentMethod } from "../libs/enums/order.enum";
import { ProductStatus } from "../libs/enums/product.enum";
import { UserType } from "../libs/enums/user.enum";
import { Order, OrderInput, OrderInquiry } from "../libs/types/order";
import { logger } from "../libs/utils/logger";
import OrderModel from "../schemas/order.schema";
import ProductModel from "../schemas/product.schema";
import EventService from "./event.service";

class OrderService {
  private readonly orderModel = OrderModel;
  private readonly productModel = ProductModel;
  private readonly eventService = new EventService();

  public createOrder = async (
    userId: string,
    input: OrderInput
  ): Promise<Order> => {
    const ids = input.items.map((i) => shapeIntoMongooseObjectId(i.productId));
    const products: any[] = await this.productModel
      .find({ _id: { $in: ids }, productStatus: ProductStatus.ACTIVE })
      .lean()
      .exec();
    const byId = new Map(products.map((p) => [String(p._id), p]));

    const currency: Currency = normalizeCurrency(input.currency);
    const orderItems = input.items.map((item) => {
      const p = byId.get(item.productId);
      if (!p) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
      if (p.productStock < item.qty)
        throw new Errors(HttpCode.CONFLICT, Message.INSUFFICIENT_STOCK);
      return {
        productId: p._id,
        productName: p.productName,
        qty: item.qty,
        // lock the price in the order's currency at purchase time
        priceAtPurchase: convertFromUsd(p.productPrice, currency),
      };
    });

    const orderTotal = orderItems.reduce(
      (sum, i) => sum + i.priceAtPurchase * i.qty,
      0
    );

    const created: any = await this.orderModel.create({
      userId: shapeIntoMongooseObjectId(userId),
      orderItems,
      shippingAddress: input.shippingAddress,
      orderTotal,
      orderCurrency: currency,
      paymentMethod: input.paymentMethod ?? PaymentMethod.COD,
    });

    // Decrement stock
    await this.productModel.bulkWrite(
      orderItems.map((i) => ({
        updateOne: {
          filter: { _id: i.productId },
          update: { $inc: { productStock: -i.qty } },
        },
      }))
    );

    // Feed the recommendation engine: a purchase is the strongest signal.
    for (const i of orderItems) {
      this.eventService
        .track(
          { eventType: EventType.PURCHASE, productId: String(i.productId) },
          userId
        )
        .catch((e) => logger.warn("Failed to log PURCHASE event", e));
    }

    return created.toObject();
  };

  public getMyOrders = async (
    userId: string,
    inquiry: OrderInquiry
  ): Promise<{ list: Order[]; total: number }> => {
    const match: any = { userId: shapeIntoMongooseObjectId(userId) };
    if (inquiry.status) match.orderStatus = inquiry.status;

    const [list, total] = await Promise.all([
      this.orderModel
        .find(match)
        .sort({ createdAt: -1 })
        .skip((inquiry.page - 1) * inquiry.limit)
        .limit(inquiry.limit)
        .lean()
        .exec(),
      this.orderModel.countDocuments(match),
    ]);
    return { list: list as any, total };
  };

  /** Admin: list every order, optionally filtered by status. Not user-scoped. */
  public getAllOrders = async (
    inquiry: OrderInquiry
  ): Promise<{ list: Order[]; total: number }> => {
    const match: any = {};
    if (inquiry.status) match.orderStatus = inquiry.status;

    const [list, total] = await Promise.all([
      this.orderModel
        .find(match)
        .sort({ createdAt: -1 })
        .skip((inquiry.page - 1) * inquiry.limit)
        .limit(inquiry.limit)
        .lean()
        .exec(),
      this.orderModel.countDocuments(match),
    ]);
    return { list: list as any, total };
  };

  public getOrder = async (
    orderId: string,
    userId: string,
    role: UserType
  ): Promise<Order> => {
    const order: any = await this.orderModel
      .findById(shapeIntoMongooseObjectId(orderId))
      .lean()
      .exec();
    if (!order) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
    if (role !== UserType.ADMIN && String(order.userId) !== String(userId))
      throw new Errors(HttpCode.FORBIDDEN, Message.NOT_AUTHORIZED);
    return order;
  };

  public updateStatus = async (
    orderId: string,
    orderStatus: OrderStatus
  ): Promise<Order> => {
    const updated: any = await this.orderModel
      .findByIdAndUpdate(
        shapeIntoMongooseObjectId(orderId),
        { $set: { orderStatus } },
        { new: true, runValidators: true }
      )
      .lean()
      .exec();
    if (!updated) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
    return updated;
  };
}

export default OrderService;
