import { CookieOptions, NextFunction, Response } from "express";
import { env } from "../config/env";
import { P } from "../libs/types/common";
import {
  AuthTokens,
  ExtendedRequest,
  UserInput,
  UserLoginInput,
} from "../libs/types/user";
import { UserType } from "../libs/enums/user.enum";
import Errors, { HttpCode, Message } from "../libs/Errors";
import { ok } from "../libs/utils/apiResponse";
import { catchHttp } from "../libs/utils/httpCatch";
import { logger } from "../libs/utils/logger";
import UserService from "../services/user.service";
import AuthService from "../services/auth.service";

const userService = new UserService();
const authService = new AuthService();

const ACCESS_MAX_AGE = 15 * 60 * 1000; // 15m
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7d

const baseCookie: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: env.NODE_ENV === "production" ? "none" : "lax",
};

const setAuthCookies = (res: Response, tokens: AuthTokens) => {
  res.cookie("accessToken", tokens.accessToken, {
    ...baseCookie,
    maxAge: ACCESS_MAX_AGE,
  });
  res.cookie("refreshToken", tokens.refreshToken, {
    ...baseCookie,
    maxAge: REFRESH_MAX_AGE,
    path: "/api/auth",
  });
};

const userController: P = {};

userController.register = async (req: ExtendedRequest, res: Response) => {
  try {
    logger.info("User controller [register]");
    const input: UserInput = req.body;
    const { user, tokens } = await userService.signup(input);
    setAuthCookies(res, tokens);
    res.status(HttpCode.CREATED).json(ok({ user, ...tokens }));
  } catch (error) {
    logger.error("User controller [register] failed", error);
    catchHttp(res, error);
  }
};

userController.login = async (req: ExtendedRequest, res: Response) => {
  try {
    logger.info("User controller [login]");
    const input: UserLoginInput = req.body;
    const { user, tokens } = await userService.login(input);
    setAuthCookies(res, tokens);
    res.status(HttpCode.OK).json(ok({ user, ...tokens }));
  } catch (error) {
    logger.error("User controller [login] failed", error);
    catchHttp(res, error);
  }
};

userController.refresh = async (req: ExtendedRequest, res: Response) => {
  try {
    logger.info("User controller [refresh]");
    const token = req.body?.refreshToken || req.cookies?.refreshToken;
    if (!token) throw new Errors(HttpCode.UNAUTHORIZED, Message.NOT_AUTHENTICATED);
    const tokens = await userService.refresh(token);
    setAuthCookies(res, tokens);
    res.status(HttpCode.OK).json(ok(tokens));
  } catch (error) {
    logger.error("User controller [refresh] failed", error);
    catchHttp(res, error);
  }
};

userController.logout = async (req: ExtendedRequest, res: Response) => {
  try {
    logger.info("User controller [logout]");
    const token = req.body?.refreshToken || req.cookies?.refreshToken;
    await userService.logout(String(req.user!._id), token);
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken", { path: "/api/auth" });
    res.status(HttpCode.OK).json(ok({ loggedOut: true }));
  } catch (error) {
    logger.error("User controller [logout] failed", error);
    catchHttp(res, error);
  }
};

userController.me = async (req: ExtendedRequest, res: Response) => {
  try {
    logger.info("User controller [me]");
    const user = await userService.getMe(String(req.user!._id));
    res.status(HttpCode.OK).json(ok({ user }));
  } catch (error) {
    logger.error("User controller [me] failed", error);
    catchHttp(res, error);
  }
};

userController.verifyAuth = async (
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    let token: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) token = authHeader.substring(7);
    if (!token && req.cookies?.accessToken) token = req.cookies.accessToken;
    if (!token) throw new Errors(HttpCode.UNAUTHORIZED, Message.NOT_AUTHENTICATED);

    const payload = authService.verifyAccessToken(token);
    req.user = { _id: payload._id, userRole: payload.userRole } as any;
    next();
  } catch (error) {
    catchHttp(res, error);
  }
};

userController.optionalAuth = async (
  req: ExtendedRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    let token: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) token = authHeader.substring(7);
    if (!token && req.cookies?.accessToken) token = req.cookies.accessToken;
    if (token) {
      const payload = authService.verifyAccessToken(token);
      req.user = { _id: payload._id, userRole: payload.userRole } as any;
    }
  } catch {
    // ignore invalid token — proceed as anonymous
  }
  next();
};

userController.verifyAdmin = async (
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.user?.userRole !== UserType.ADMIN)
      throw new Errors(HttpCode.FORBIDDEN, Message.NOT_AUTHORIZED);
    next();
  } catch (error) {
    catchHttp(res, error);
  }
};

export default userController;
