import { Order } from "./order";

export interface AdminStats {
  totalOrders: number;
  /** order count keyed by OrderStatus, e.g. { PAID: 5, PENDING: 3 } */
  ordersByStatus: Record<string, number>;
  /** completed-order revenue keyed by currency, e.g. { USD: 1200 } */
  revenueByCurrency: Record<string, number>;
  totalProducts: number;
  lowStockCount: number;
  recentOrders: Order[];
}
