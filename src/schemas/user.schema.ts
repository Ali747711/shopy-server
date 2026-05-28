import mongoose, { Schema } from "mongoose";
import { PriceSensitivity, UserStatus, UserType } from "../libs/enums/user.enum";

const refreshTokenSchema = new Schema(
  {
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    userName: { type: String, required: true },
    userEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: { unique: true },
    },
    userPassword: { type: String, required: true, select: false },
    userRole: { type: String, enum: UserType, default: UserType.USER },
    userStatus: { type: String, enum: UserStatus, default: UserStatus.ACTIVE },
    userPreferences: {
      categories: { type: [String], default: [] },
      priceSensitivity: {
        type: String,
        enum: PriceSensitivity,
        default: PriceSensitivity.MEDIUM,
      },
    },
    refreshTokens: { type: [refreshTokenSchema], default: [], select: false },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
