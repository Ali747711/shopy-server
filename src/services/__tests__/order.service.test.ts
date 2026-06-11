import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mock the models BEFORE importing the service ----------------------
const orderFind = vi.fn();
const orderCount = vi.fn();

function chain(result: any) {
  const c: any = {};
  c.sort = () => c;
  c.skip = () => c;
  c.limit = () => c;
  c.lean = () => c;
  c.exec = () => Promise.resolve(result);
  return c;
}

vi.mock("../../schemas/order.schema", () => ({
  default: {
    find: (...a: any[]) => chain(orderFind(...a)),
    countDocuments: (...a: any[]) => Promise.resolve(orderCount(...a)),
  },
}));
vi.mock("../../schemas/product.schema", () => ({ default: {} }));
vi.mock("../event.service", () => ({ default: class {} }));
vi.mock("../../libs/configs", () => ({
  shapeIntoMongooseObjectId: (x: string) => x,
}));

import OrderService from "../order.service";
import { OrderStatus } from "../../libs/enums/order.enum";

let svc: OrderService;
beforeEach(() => {
  svc = new OrderService();
  orderFind.mockReset();
  orderCount.mockReset();
});

describe("OrderService.getAllOrders", () => {
  it("returns every order with no user filter applied", async () => {
    orderFind.mockReturnValue([{ _id: "o1" }, { _id: "o2" }]);
    orderCount.mockReturnValue(2);

    const { list, total } = await svc.getAllOrders({ page: 1, limit: 20 });

    expect(total).toBe(2);
    expect(list).toHaveLength(2);
    // the match passed to find must NOT scope by userId
    expect(orderFind.mock.calls[0][0]).not.toHaveProperty("userId");
  });

  it("filters by status when provided", async () => {
    orderFind.mockReturnValue([{ _id: "o1" }]);
    orderCount.mockReturnValue(1);

    await svc.getAllOrders({ page: 1, limit: 20, status: OrderStatus.PAID });

    expect(orderFind.mock.calls[0][0]).toMatchObject({
      orderStatus: OrderStatus.PAID,
    });
  });
});
