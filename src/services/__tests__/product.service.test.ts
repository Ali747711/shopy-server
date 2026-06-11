import { describe, it, expect, vi, beforeEach } from "vitest";

const aggregate = vi.fn();

vi.mock("../../schemas/product.schema", () => ({
  default: { aggregate: (...a: any[]) => ({ exec: () => aggregate(...a) }) },
}));
vi.mock("./ai/embedding.service", () => ({ default: class {} }));
vi.mock("../../libs/configs", () => ({
  shapeIntoMongooseObjectId: (x: string) => x,
}));

import ProductService from "../product.service";
import { ProductStatus } from "../../libs/enums/product.enum";

let svc: ProductService;
beforeEach(() => {
  svc = new ProductService();
  aggregate.mockReset();
  aggregate.mockResolvedValue([{ list: [{ _id: "p1" }], total: [{ count: 1 }] }]);
});

/** Pull the $match stage out of the pipeline passed to aggregate. */
const matchOf = () => aggregate.mock.calls[0][0][0].$match;

describe("ProductService.getAllProducts (admin)", () => {
  it("excludes only DELETE products when no status filter is given", async () => {
    await svc.getAllProducts({ page: 1, limit: 20 });
    expect(matchOf()).toMatchObject({
      productStatus: { $ne: ProductStatus.DELETE },
    });
  });

  it("filters to an exact status when provided", async () => {
    await svc.getAllProducts({ page: 1, limit: 20, status: ProductStatus.PAUSE });
    expect(matchOf()).toMatchObject({ productStatus: ProductStatus.PAUSE });
  });

  it("still applies search and category filters", async () => {
    await svc.getAllProducts({
      page: 1,
      limit: 20,
      category: "shoes",
      search: "nike",
    });
    const match = matchOf();
    expect(match.productCategory).toBe("shoes");
    expect(match.$or).toBeDefined();
  });
});

describe("ProductService.getProducts (public) still forces ACTIVE", () => {
  it("only returns ACTIVE products", async () => {
    await svc.getProducts({ page: 1, limit: 20 } as any);
    expect(matchOf()).toMatchObject({ productStatus: ProductStatus.ACTIVE });
  });
});
