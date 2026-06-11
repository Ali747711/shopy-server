import { Schema } from "mongoose";

/** Bare shipping fields — embedded on orders as an immutable snapshot. */
export const addressFieldsSchema = new Schema(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    address1: { type: String, required: true },
    address2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true },
  },
  { _id: false }
);

/** A saved address (address book entry) — has its own _id, label, default flag. */
export const savedAddressSchema = new Schema(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    address1: { type: String, required: true },
    address2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true },
    label: { type: String },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);
