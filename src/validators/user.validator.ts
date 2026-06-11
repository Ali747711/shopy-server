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

// The refresh token normally arrives via the httpOnly cookie, so the request
// body is often empty. Express 5 leaves `req.body` as `undefined` for bodyless
// POSTs, and `z.object(...)` rejects `undefined`. Defaulting to `{}` lets these
// cookie-only requests through to the controller (which then reads the cookie).
export const refreshSchema = z
  .object({
    refreshToken: z.string().min(1).optional(),
  })
  .default({});
