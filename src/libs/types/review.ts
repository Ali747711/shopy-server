import { ObjectId } from "mongoose";

export interface Review {
  _id: ObjectId;
  productId: ObjectId;
  userId: ObjectId;
  userName: string;
  rating: number;
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewInput {
  rating: number;
  comment?: string;
}

export interface ReviewInquiry {
  page: number;
  limit: number;
}
