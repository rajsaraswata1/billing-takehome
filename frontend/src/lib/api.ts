import type {
  ApiErrorBody,
  CartLine,
  DailyReportResponse,
  OrderResponse,
  PaymentType,
  SplitResponse,
} from "./types";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as ApiErrorBody;
      if (body?.error) message = body.error;
    } catch {
      // response wasn't JSON — fall back to statusText
    }
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}

export function createOrder(params: {
  shop_id: string;
  items: CartLine[];
  tip: string;
  discount: string;
  payment_type: PaymentType;
  placed_at?: string;
}): Promise<OrderResponse> {
  return fetch(`${API_BASE}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  }).then((res) => handle<OrderResponse>(res));
}

export function splitOrder(orderId: string, ways: number): Promise<SplitResponse> {
  return fetch(`${API_BASE}/orders/${encodeURIComponent(orderId)}/split`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ways }),
  }).then((res) => handle<SplitResponse>(res));
}

export function dailyReport(date: string, tz: string): Promise<DailyReportResponse> {
  const url = new URL(`${API_BASE}/reports/daily`);
  url.searchParams.set("date", date);
  url.searchParams.set("tz", tz);
  return fetch(url).then((res) => handle<DailyReportResponse>(res));
}
