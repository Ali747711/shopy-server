import { ObjectId } from "mongoose";
import { OrderStatus } from "../enums/order.enum";

export interface OrderItem {
  productId: ObjectId;
  productName: string;
  qty: number;
  priceAtPurchase: number;
}

export interface Order {
  _id: ObjectId;
  userId: ObjectId;
  orderItems: OrderItem[];
  orderTotal: number;
  orderCurrency: string;
  orderStatus: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItemInput {
  productId: string;
  qty: number;
}

export interface OrderInput {
  items: OrderItemInput[];
}

export interface OrderInquiry {
  page: number;
  limit: number;
  status?: OrderStatus;
}
