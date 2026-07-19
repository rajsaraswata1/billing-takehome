export type PaymentType = "CARD" | "CASH";

export interface MenuItem {
  sku: string;
  name: string;
  price: string;
}

export interface Shop {
  id: string;
  name: string;
  timezone: string;
  currency: string;
}

export interface CartLine {
  sku: string;
  qty: number;
}

export interface OrderResponse {
  id: string;
  shop_id: string;
  payment_type: PaymentType;
  placed_at: string;
  subtotal: string;
  convenience_fee: string;
  dual_pricing_surcharge: string;
  tip: string;
  discount: string;
  total: string;
}

export interface SplitResponse {
  order_id: string;
  total: string;
  shares: string[];
}

export interface DailyReportResponse {
  date: string;
  tz: string;
  order_count: number;
  orders: { id: string; placed_at: string; total: string }[];
  gross_total: string;
  card_fees_total: string;
}

export interface ApiErrorBody {
  error: string;
}
