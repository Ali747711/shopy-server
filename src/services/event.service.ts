import { shapeIntoMongooseObjectId } from "../libs/configs";
import Errors, { HttpCode, Message } from "../libs/Errors";
import { Event, EventInput } from "../libs/types/event";
import EventModel from "../schemas/event.schema";

class EventService {
  private readonly eventModel;

  constructor() {
    this.eventModel = EventModel;
  }

  public track = async (
    input: EventInput,
    userId?: string
  ): Promise<Event> => {
    try {
      const created: any = await this.eventModel.create({
        ...input,
        userId: userId ? shapeIntoMongooseObjectId(userId) : null,
        productId: input.productId
          ? shapeIntoMongooseObjectId(input.productId)
          : null,
      });
      return created.toObject();
    } catch {
      throw new Errors(HttpCode.BAD_REQUEST, Message.CREATE_FAILED);
    }
  };
}

export default EventService;
