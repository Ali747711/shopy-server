import { describe, it, expect, vi, beforeEach } from "vitest";

const orderAggregate = vi.fn();
const orderFind = vi.fn();
const productCount = vi.fn();

function chain(result: any) {
  const c: any = {};
  c.sort = () => c;
  c.limit = () => c;
  c.lean = () => c;
  c.exec = () => Promise.resolve(result);
  return c;
}

vi.mock("../../schemas/order.schema", () => ({
  default: {
    aggregate: (...a: any[]) => Promise.resolve(orderAggregate(...a)),
    find: (...a: any[]) => chain(orderFind(...a)),
  },
}));
vi.mock("../../schemas/product.schema", () => ({
  default: { countDocuments: (...a: any[]) => Promise.resolve(productCount(...a)) },
}));

import AdminService from "../admin.service";

let svc: AdminService;
beforeEach(() => {
  svc = new AdminService();
  orderAggregate.mockReset();
  orderFind.mockReset();
  productCount.mockReset();
});

describe("AdminService.getStats", () => {
  it("shapes the facet aggregation into a stats summary", async () => {
    orderAggregate.mockReturnValue([
      {
        byStatus: [
          { _id: "PAID", count: 5 },
          { _id: "PENDING", count: 3 },
        ],
        revenue: [
          { _id: "USD", total: 1200 },
          { _id: "EUR", total: 300 },
        ],
        totalOrders: [{ count: 8 }],
      },
    ]);
    orderFind.mockReturnValue([{ _id: "o1" }]);
    productCount.mockReturnValueOnce(42).mockReturnValueOnce(4); // total, lowStock

    const stats = await svc.getStats();

    expect(stats.totalOrders).toBe(8);
    expect(stats.ordersByStatus).toMatchObject({ PAID: 5, PENDING: 3 });
    expect(stats.revenueByCurrency).toMatchObject({ USD: 1200, EUR: 300 });
    expect(stats.totalProducts).toBe(42);
    expect(stats.lowStockCount).toBe(4);
    expect(stats.recentOrders).toHaveLength(1);
  });

  it("handles an empty store without throwing", async () => {
    orderAggregate.mockReturnValue([
      { byStatus: [], revenue: [], totalOrders: [] },
    ]);
    orderFind.mockReturnValue([]);
    productCount.mockReturnValueOnce(0).mockReturnValueOnce(0);

    const stats = await svc.getStats();

    expect(stats.totalOrders).toBe(0);
    expect(stats.ordersByStatus).toEqual({});
    expect(stats.revenueByCurrency).toEqual({});
    expect(stats.recentOrders).toEqual([]);
  });
});
