import { z } from "zod";

export const registerSchema = z.object({
  userName: z.string().trim().min(2).max(60),
  userEmail: z.string().trim().email(),
  userPassword: z.string().min(8).max(100),
});

export const loginSchema = z.object({
  userEmail: z.string().trim().email(),
  userPassword: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});
