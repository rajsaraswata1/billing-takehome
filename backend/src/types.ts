export type PaymentType = "CARD" | "CASH";

export interface MenuItem {
  sku: string;
  name: string;
  price: string; // dollar string, e.g. "12.99"
}

export interface Shop {
  id: string;
  name: string;
  timezone: string; // IANA tz name
  currency: string;
}

export interface OrderItemRequest {
  sku: string;
  qty: number;
}

export interface CreateOrderRequest {
  shop_id: string;
  items: OrderItemRequest[];
  tip: string;
  discount: string;
  payment_type: PaymentType;
  placed_at?: string;
}

export interface StoredOrder {
  id: string;
  shop_id: string;
  payment_type: PaymentType;
  placed_at: string; // ISO-8601 with offset, as given (or defaulted)
  placed_at_utc_ms: number; // resolved instant, used for report grouping
  items: OrderItemRequest[];
  subtotal_cents: number;
  convenience_fee_cents: number;
  dual_pricing_surcharge_cents: number;
  tip_cents: number;
  discount_cents: number;
  total_cents: number;
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
