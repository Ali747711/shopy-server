import { OrderStatus } from "../libs/enums/order.enum";
import { AdminStats } from "../libs/types/admin";
import OrderModel from "../schemas/order.schema";
import ProductModel from "../schemas/product.schema";

/** Orders whose revenue counts as "earned" for the dashboard total. */
const EARNED_STATUSES = [
  OrderStatus.PAID,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

/** A product at or below this stock level is surfaced as "low stock". */
const LOW_STOCK_THRESHOLD = 5;
const RECENT_ORDERS_LIMIT = 5;

class AdminService {
  private readonly orderModel = OrderModel;
  private readonly productModel = ProductModel;

  /** Aggregate store-wide metrics for the admin dashboard overview. */
  public getStats = async (): Promise<AdminStats> => {
    const [facet] = await this.orderModel.aggregate([
      {
        $facet: {
          byStatus: [{ $group: { _id: "$orderStatus", count: { $sum: 1 } } }],
          revenue: [
            { $match: { orderStatus: { $in: EARNED_STATUSES } } },
            { $group: { _id: "$orderCurrency", total: { $sum: "$orderTotal" } } },
          ],
          totalOrders: [{ $count: "count" }],
        },
      },
    ]);

    const [totalProducts, lowStockCount, recentOrders] = await Promise.all([
      this.productModel.countDocuments({}),
      this.productModel.countDocuments({
        productStock: { $lte: LOW_STOCK_THRESHOLD },
      }),
      this.orderModel
        .find({})
        .sort({ createdAt: -1 })
        .limit(RECENT_ORDERS_LIMIT)
        .lean()
        .exec(),
    ]);

    const toMap = (rows: Array<{ _id: string; count?: number; total?: number }>) =>
      rows.reduce<Record<string, number>>((acc, r) => {
        acc[r._id] = (r.count ?? r.total) as number;
        return acc;
      }, {});

    return {
      totalOrders: facet?.totalOrders?.[0]?.count ?? 0,
      ordersByStatus: toMap(facet?.byStatus ?? []),
      revenueByCurrency: toMap(facet?.revenue ?? []),
      totalProducts,
      lowStockCount,
      recentOrders: (recentOrders as any) ?? [],
    };
  };
}

export default AdminService;
