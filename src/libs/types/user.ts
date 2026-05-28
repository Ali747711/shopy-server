import { ObjectId, Types } from "mongoose";
import { Request } from "express";
import { PriceSensitivity, UserStatus, UserType } from "../enums/user.enum";

export interface UserPreferences {
  categories: string[];
  priceSensitivity: PriceSensitivity;
}

export interface RefreshTokenRecord {
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface User {
  _id: ObjectId;
  userName: string;
  userEmail: string;
  userPassword?: string;
  userRole: UserType;
  userStatus: UserStatus;
  userPreferences: UserPreferences;
  refreshTokens?: RefreshTokenRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UserInput {
  userName: string;
  userEmail: string;
  userPassword: string;
}

export interface UserLoginInput {
  userEmail: string;
  userPassword: string;
}

export interface UserUpdateInput {
  _id?: Types.ObjectId;
  userName?: string;
  userPreferences?: Partial<UserPreferences>;
}

/** Minimal identity carried inside the access token. */
export interface AuthPayload {
  _id: string;
  userRole: UserType;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface ExtendedRequest extends Request {
  user?: User;
}
