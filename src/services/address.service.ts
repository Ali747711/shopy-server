import Errors, { HttpCode, Message } from "../libs/Errors";
import { shapeIntoMongooseObjectId } from "../libs/configs";
import { Address, AddressInput } from "../libs/types/address";
import UserModel from "../schemas/user.schema";

const MAX_ADDRESSES = 20;

class AddressService {
  private readonly userModel = UserModel;

  /** Returns the user doc or throws 404. */
  private loadUser = async (userId: string): Promise<any> => {
    const user = await this.userModel
      .findById(shapeIntoMongooseObjectId(userId))
      .exec();
    if (!user) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
    return user;
  };

  public list = async (userId: string): Promise<Address[]> => {
    const user = await this.loadUser(userId);
    return user.addresses ?? [];
  };

  public add = async (userId: string, input: AddressInput): Promise<Address[]> => {
    const user = await this.loadUser(userId);
    const count = user.addresses?.length ?? 0;

    if (count >= MAX_ADDRESSES)
      throw new Errors(HttpCode.BAD_REQUEST, Message.CREATE_FAILED);

    const isFirst = count === 0;
    const makeDefault = isFirst || input.isDefault === true;

    if (makeDefault) {
      for (const a of user.addresses) a.isDefault = false;
    }
    user.addresses.push({ ...input, isDefault: makeDefault });
    await user.save();
    return user.addresses;
  };

  public update = async (
    userId: string,
    addressId: string,
    input: Partial<AddressInput>
  ): Promise<Address[]> => {
    const user = await this.loadUser(userId);
    const target = user.addresses.id(addressId);
    if (!target) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);

    // If this update sets it default, clear the others first.
    if (input.isDefault === true) {
      for (const a of user.addresses) a.isDefault = false;
    }
    target.set({ ...input });
    // A user must always have a default if they have any addresses.
    this.ensureOneDefault(user);
    await user.save();
    return user.addresses;
  };

  public remove = async (userId: string, addressId: string): Promise<Address[]> => {
    const user = await this.loadUser(userId);
    const target = user.addresses.id(addressId);
    if (!target) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
    const wasDefault = target.isDefault;
    target.deleteOne();
    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }
    await user.save();
    return user.addresses;
  };

  public setDefault = async (
    userId: string,
    addressId: string
  ): Promise<Address[]> => {
    const user = await this.loadUser(userId);
    const target = user.addresses.id(addressId);
    if (!target) throw new Errors(HttpCode.NOT_FOUND, Message.NO_DATA_FOUND);
    for (const a of user.addresses) a.isDefault = false;
    target.isDefault = true;
    await user.save();
    return user.addresses;
  };

  /** Guarantees exactly one default when at least one address exists. */
  private ensureOneDefault = (user: any): void => {
    if (user.addresses.length === 0) return;
    const defaults = user.addresses.filter((a: any) => a.isDefault);
    if (defaults.length === 0) user.addresses[0].isDefault = true;
    else if (defaults.length > 1) {
      defaults.slice(1).forEach((a: any) => (a.isDefault = false));
    }
  };
}

export default AddressService;
