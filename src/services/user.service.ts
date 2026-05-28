import bcrypt from "bcryptjs";
import { env } from "../config/env";
import { shapeIntoMongooseObjectId } from "../libs/configs";
import Errors, { HttpCode, Message } from "../libs/Errors";
import { UserStatus } from "../libs/enums/user.enum";
import {
  AuthPayload,
  AuthTokens,
  User,
  UserInput,
  UserLoginInput,
} from "../libs/types/user";
import UserModel from "../schemas/user.schema";
import AuthService from "./auth.service";

class UserService {
  private readonly userModel;
  private readonly authService;

  constructor() {
    this.userModel = UserModel;
    this.authService = new AuthService();
  }

  public signup = async (
    input: UserInput
  ): Promise<{ user: User; tokens: AuthTokens }> => {
    const salt = await bcrypt.genSalt(env.BCRYPT_SALT_ROUNDS);
    const userPassword = await bcrypt.hash(input.userPassword, salt);
    try {
      const created: any = await this.userModel.create({
        ...input,
        userPassword,
      });
      const tokens = await this.issueTokens(created);
      return { user: this.sanitize(created), tokens };
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new Errors(HttpCode.CONFLICT, Message.USED_EMAIL);
      }
      throw new Errors(HttpCode.BAD_REQUEST, Message.CREATE_FAILED);
    }
  };

  public login = async (
    input: UserLoginInput
  ): Promise<{ user: User; tokens: AuthTokens }> => {
    const user: any = await this.userModel
      .findOne({ userEmail: input.userEmail.toLowerCase() })
      .select("+userPassword +refreshTokens")
      .exec();

    if (!user) throw new Errors(HttpCode.NOT_FOUND, Message.NO_MEMBER_NICK);
    if (user.userStatus === UserStatus.BLOCK)
      throw new Errors(HttpCode.FORBIDDEN, Message.BLOCKED_USER);

    const matched = await bcrypt.compare(input.userPassword, user.userPassword);
    if (!matched) throw new Errors(HttpCode.UNAUTHORIZED, Message.WRONG_PASSWORD);

    const tokens = await this.issueTokens(user);
    return { user: this.sanitize(user), tokens };
  };

  public refresh = async (refreshToken: string): Promise<AuthTokens> => {
    const payload = this.authService.verifyRefreshToken(refreshToken);
    const user: any = await this.userModel
      .findById(payload._id)
      .select("+refreshTokens")
      .exec();
    if (!user) throw new Errors(HttpCode.UNAUTHORIZED, Message.NOT_AUTHENTICATED);

    const hash = this.authService.hashToken(refreshToken);
    const now = new Date();
    const exists = (user.refreshTokens || []).some(
      (t: any) => t.tokenHash === hash && t.expiresAt > now
    );
    if (!exists)
      throw new Errors(HttpCode.UNAUTHORIZED, Message.NOT_AUTHENTICATED);

    // rotation: drop the used token, then issue a fresh pair
    user.refreshTokens = user.refreshTokens.filter(
      (t: any) => t.tokenHash !== hash
    );
    return this.issueTokens(user);
  };

  public logout = async (userId: string, refreshToken?: string): Promise<void> => {
    const _id = shapeIntoMongooseObjectId(userId);
    if (!refreshToken) {
      await this.userModel.updateOne({ _id }, { $set: { refreshTokens: [] } });
      return;
    }
    const hash = this.authService.hashToken(refreshToken);
    await this.userModel.updateOne(
      { _id },
      { $pull: { refreshTokens: { tokenHash: hash } } }
    );
  };

  public getMe = async (userId: string): Promise<User> => {
    const _id = shapeIntoMongooseObjectId(userId);
    const user: any = await this.userModel
      .findOne({ _id, userStatus: { $ne: UserStatus.DELETE } })
      .exec();
    if (!user) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
    return this.sanitize(user);
  };

  /** Creates a token pair, persists the hashed refresh token, returns the pair. */
  private issueTokens = async (user: any): Promise<AuthTokens> => {
    const payload: AuthPayload = {
      _id: String(user._id),
      userRole: user.userRole,
    };
    const accessToken = this.authService.createAccessToken(payload);
    const refreshToken = this.authService.createRefreshToken(payload);

    user.refreshTokens = user.refreshTokens || [];
    user.refreshTokens.push({
      tokenHash: this.authService.hashToken(refreshToken),
      expiresAt: this.authService.tokenExpiry(refreshToken),
      createdAt: new Date(),
    });
    await user.save();

    return { accessToken, refreshToken };
  };

  private sanitize = (user: any): User => {
    const obj = typeof user.toObject === "function" ? user.toObject() : user;
    delete obj.userPassword;
    delete obj.refreshTokens;
    return obj as User;
  };
}

export default UserService;
