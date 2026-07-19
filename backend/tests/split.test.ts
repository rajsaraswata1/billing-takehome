import { describe, it, expect, beforeEach } from "vitest";
import { createOrder, ValidationError, NotFoundError } from "../src/orders.js";
import { splitOrder } from "../src/split.js";
import { orderStore } from "../src/data.js";
import { parseMoneyToCents } from "../src/money.js";

beforeEach(() => orderStore.clear());

function makeOrder() {
  return createOrder({
    shop_id: "shop_berlin",
    items: [{ sku: "WINGS_6", qty: 1 }, { sku: "TIRAMISU", qty: 2 }],
    tip: "1.11",
    discount: "0.00",
    payment_type: "CARD",
    placed_at: "2026-10-25T02:30:00+02:00",
  });
}

describe("splitOrder", () => {
  it("splits into shares that sum back to the exact total", () => {
    const order = makeOrder();
    const totalCents = parseMoneyToCents(order.total);

    for (const ways of [2, 3, 7, 13, 20]) {
      const result = splitOrder(order.id, ways);
      expect(result.shares).toHaveLength(ways);
      const sumCents = result.shares.reduce((sum, s) => sum + parseMoneyToCents(s), 0);
      expect(sumCents).toBe(totalCents);
      const shareCents = result.shares.map(parseMoneyToCents);
      expect(Math.max(...shareCents) - Math.min(...shareCents)).toBeLessThanOrEqual(1);
    }
  });

  it("rejects ways outside [2, 20]", () => {
    const order = makeOrder();
    expect(() => splitOrder(order.id, 1)).toThrow(ValidationError);
    expect(() => splitOrder(order.id, 21)).toThrow(ValidationError);
    expect(() => splitOrder(order.id, 2.5)).toThrow(ValidationError);
  });

  it("404s for an unknown order id", () => {
    expect(() => splitOrder("does_not_exist", 3)).toThrow(NotFoundError);
  });
});
