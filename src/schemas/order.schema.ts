import mongoose, { Schema } from "mongoose";
import { Currency } from "../libs/enums/currency.enum";
import { OrderStatus, PaymentMethod, PaymentStatus } from "../libs/enums/order.enum";

const orderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    priceAtPurchase: { type: Number, required: true },
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    orderItems: { type: [orderItemSchema], required: true },
    orderTotal: { type: Number, required: true },
    orderCurrency: { type: String, enum: Currency, default: Currency.USD },
    orderStatus: {
      type: String,
      enum: OrderStatus,
      default: OrderStatus.PENDING,
    },
    paymentMethod: {
      type: String,
      enum: PaymentMethod,
      default: PaymentMethod.COD,
    },
    paymentStatus: {
      type: String,
      enum: PaymentStatus,
      default: PaymentStatus.UNPAID,
    },
    stripeSessionId: { type: String, index: true },
    stripePaymentIntentId: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("Order", orderSchema);
