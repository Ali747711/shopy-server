export enum HttpCode {
  OK = 200,
  CREATED = 201,
  NOT_MODIFIED = 304,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500,
  SERVICE_UNAVAILABLE = 503,
}

export enum Message {
  SOMETHING_WENT_WRONG = "Something went wrong",
  NO_DATA_FOUND = "No data found",
  CREATE_FAILED = "Create failed!",
  UPDATE_FAILED = "Update failed!",
  DELETE_FAILED = "Delete failed!",
  NOT_AUTHENTICATED = "You are not authenticated, please login first!",
  NO_MEMBER_NICK = "No member with that nick!",
  WRONG_PASSWORD = "Wrong password, please try again!",
  USED_EMAIL = "You are inserting an already used email!",
  TOKEN_CREATION_FAILED = "Token creation has failed!",
  BLOCKED_USER = "You have been blocked, contact the admin!",
  NOT_AUTHORIZED = "You are not authorized to perform this action!",
  TOO_MANY_REQUESTS = "Too many requests, please slow down!",
  VALIDATION_FAILED = "Request validation failed!",
  INVALID_ID = "Invalid id format!",
  INSUFFICIENT_STOCK = "Insufficient stock for one or more items!",
  PAYMENTS_NOT_CONFIGURED = "Online payments are not configured!",
  WEBHOOK_INVALID = "Invalid webhook signature!",
  ORDER_ALREADY_PAID = "This order is already paid!",
  NOT_STRIPE_ORDER = "This order is not set up for online payment!",
}

class Errors extends Error {
  public code: HttpCode;
  public message: Message;

  static standard = {
    code: HttpCode.INTERNAL_SERVER_ERROR,
    message: Message.SOMETHING_WENT_WRONG,
  };

  constructor(statusCode: HttpCode, statusMessage: Message) {
    super();
    this.code = statusCode;
    this.message = statusMessage;
  }
}

export default Errors;
