import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../config/env";
import Errors, { HttpCode, Message } from "../libs/Errors";
import { AuthPayload } from "../libs/types/user";

class AuthService {
  public createAccessToken = (payload: AuthPayload): string => {
    try {
      return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
        expiresIn: env.JWT_ACCESS_TTL,
      } as any);
    } catch {
      throw new Errors(HttpCode.BAD_REQUEST, Message.TOKEN_CREATION_FAILED);
    }
  };

  public createRefreshToken = (payload: AuthPayload): string => {
    try {
      return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
        expiresIn: env.JWT_REFRESH_TTL,
      } as any);
    } catch {
      throw new Errors(HttpCode.BAD_REQUEST, Message.TOKEN_CREATION_FAILED);
    }
  };

  public verifyAccessToken = (token: string): AuthPayload => {
    try {
      return jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthPayload;
    } catch {
      throw new Errors(HttpCode.UNAUTHORIZED, Message.NOT_AUTHENTICATED);
    }
  };

  public verifyRefreshToken = (token: string): AuthPayload => {
    try {
      return jwt.verify(token, env.JWT_REFRESH_SECRET) as AuthPayload;
    } catch {
      throw new Errors(HttpCode.UNAUTHORIZED, Message.NOT_AUTHENTICATED);
    }
  };

  /** Deterministic hash so a presented refresh token can be looked up + revoked. */
  public hashToken = (token: string): string =>
    crypto.createHash("sha256").update(token).digest("hex");

  /** Reads the `exp` claim off a freshly signed token to persist its expiry. */
  public tokenExpiry = (token: string): Date => {
    const decoded = jwt.decode(token) as { exp?: number } | null;
    return decoded?.exp ? new Date(decoded.exp * 1000) : new Date();
  };
}

export default AuthService;
