import { centsToMoney, splitCentsExact } from "./money.js";
import { getOrderOrThrow } from "./orders.js";
import { ValidationError } from "./orders.js";

export interface SplitResponse {
  order_id: string;
  total: string;
  shares: string[];
}

export function splitOrder(orderId: string, ways: unknown): SplitResponse {
  if (!Number.isInteger(ways) || (ways as number) < 2 || (ways as number) > 20) {
    throw new ValidationError("ways must be an integer between 2 and 20");
  }
  const order = getOrderOrThrow(orderId); // throws NotFoundError if missing

  const shareCents = splitCentsExact(order.total_cents, ways as number);

  return {
    order_id: order.id,
    total: centsToMoney(order.total_cents),
    shares: shareCents.map(centsToMoney),
  };
}
