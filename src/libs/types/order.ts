import { ObjectId } from "mongoose";
import { Currency } from "../enums/currency.enum";
import { OrderStatus, PaymentMethod, PaymentStatus } from "../enums/order.enum";

export interface OrderItem {
  productId: ObjectId;
  productName: string;
  qty: number;
  priceAtPurchase: number; // in the order's currency, locked at purchase time
}

export interface Order {
  _id: ObjectId;
  userId: ObjectId;
  orderItems: OrderItem[];
  orderTotal: number;
  orderCurrency: Currency;
  orderStatus: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItemInput {
  productId: string;
  qty: number;
}

export interface OrderInput {
  items: OrderItemInput[];
  currency?: Currency;
  paymentMethod?: PaymentMethod;
}

export interface OrderInquiry {
  page: number;
  limit: number;
  status?: OrderStatus;
}
