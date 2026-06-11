import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Fake mongoose DocumentArray helpers -------------------------------
function makeArray(initial: any[] = []) {
  const arr: any = [];
  const attach = (doc: any) => {
    doc.set = (patch: any) => Object.assign(doc, patch);
    doc.deleteOne = () => {
      const i = arr.indexOf(doc);
      if (i >= 0) arr.splice(i, 1);
    };
    return doc;
  };
  arr.id = (id: string) =>
    arr.find((a: any) => String(a._id) === String(id)) ?? null;
  arr.push = (data: any) => {
    const doc = attach({ _id: `id${arr.length + 1}`, ...data });
    Array.prototype.push.call(arr, doc);
    return arr.length;
  };
  initial.forEach((d) => Array.prototype.push.call(arr, attach({ ...d })));
  return arr;
}

function makeUser(addresses: any[] = []) {
  return {
    _id: "u1",
    addresses: makeArray(addresses),
    save: vi.fn().mockResolvedValue(true),
  };
}

// --- Mock the model BEFORE importing the service -----------------------
const findById = vi.fn();
vi.mock("../../schemas/user.schema", () => ({
  default: { findById: (...a: any[]) => ({ exec: () => findById(...a) }) },
}));
vi.mock("../../libs/configs", () => ({
  shapeIntoMongooseObjectId: (x: string) => x,
}));

import AddressService from "../address.service";

const valid = {
  fullName: "John Doe",
  phone: "+1 555 0000",
  address1: "123 Main St",
  city: "NY",
  state: "NY",
  postalCode: "10001",
  country: "United States",
};

let svc: AddressService;
beforeEach(() => {
  svc = new AddressService();
  findById.mockReset();
});

describe("AddressService.add", () => {
  it("first address becomes default", async () => {
    const user = makeUser();
    findById.mockResolvedValue(user);
    const list = await svc.add("u1", { ...valid });
    expect(list).toHaveLength(1);
    expect(list[0].isDefault).toBe(true);
  });

  it("adding isDefault clears the previous default", async () => {
    const user = makeUser([{ _id: "id1", ...valid, isDefault: true }]);
    findById.mockResolvedValue(user);
    const list = await svc.add("u1", { ...valid, isDefault: true });
    const defaults = list.filter((a: any) => a.isDefault);
    expect(defaults).toHaveLength(1);
    expect(String(defaults[0]._id)).not.toBe("id1");
  });

  it("a non-default second address does not steal the default", async () => {
    const user = makeUser([{ _id: "id1", ...valid, isDefault: true }]);
    findById.mockResolvedValue(user);
    const list = await svc.add("u1", { ...valid });
    expect(list.find((a: any) => a._id === "id1").isDefault).toBe(true);
    expect(list.filter((a: any) => a.isDefault)).toHaveLength(1);
  });
});

describe("AddressService.setDefault", () => {
  it("moves the default to the chosen address", async () => {
    const user = makeUser([
      { _id: "id1", ...valid, isDefault: true },
      { _id: "id2", ...valid, isDefault: false },
    ]);
    findById.mockResolvedValue(user);
    const list = await svc.setDefault("u1", "id2");
    expect(list.find((a: any) => a._id === "id2").isDefault).toBe(true);
    expect(list.find((a: any) => a._id === "id1").isDefault).toBe(false);
  });

  it("throws 404 for an unknown id", async () => {
    findById.mockResolvedValue(
      makeUser([{ _id: "id1", ...valid, isDefault: true }])
    );
    await expect(svc.setDefault("u1", "nope")).rejects.toMatchObject({
      code: 404,
    });
  });
});

describe("AddressService.remove", () => {
  it("promotes a new default when the default is removed", async () => {
    const user = makeUser([
      { _id: "id1", ...valid, isDefault: true },
      { _id: "id2", ...valid, isDefault: false },
    ]);
    findById.mockResolvedValue(user);
    const list = await svc.remove("u1", "id1");
    expect(list).toHaveLength(1);
    expect(list[0].isDefault).toBe(true);
  });
});
