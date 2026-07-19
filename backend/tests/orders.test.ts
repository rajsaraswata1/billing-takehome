import { describe, it, expect, beforeEach } from "vitest";
import { createOrder, ValidationError } from "../src/orders.js";
import { orderStore } from "../src/data.js";
import { parseMoneyToCents } from "../src/money.js";

beforeEach(() => orderStore.clear());

describe("createOrder — CARD pricing", () => {
  it("applies 4% dual pricing per unit before summing, and reports it separately", () => {
    const o = createOrder({
      shop_id: "shop_chicago",
      items: [{ sku: "PIZZA_M", qty: 1 }, { sku: "FRIES", qty: 3 }],
      tip: "2.00",
      discount: "0.00",
      payment_type: "CARD",
      placed_at: "2026-07-05T23:30:00-05:00",
    });
    // PIZZA_M 12.99 -> *1.04 = 13.5096 -> rounds to 13.51
    // FRIES    3.33 -> *1.04 = 3.4632  -> rounds to 3.46, x3 = 10.38
    // subtotal = 13.51 + 10.38 = 23.89
    expect(o.subtotal).toBe("23.89");
    expect(o.dual_pricing_surcharge).toBe("0.91"); // 23.89 - (12.99 + 9.99)
    // convenience fee = 2.9% of 23.89 + 0.30 = 0.6928 -> 0.69 + 0.30 = 0.99
    expect(o.convenience_fee).toBe("0.99");
    expect(o.total).toBe("26.88");
  });

  it("satisfies the invariant subtotal + fee + tip - discount = total", () => {
    const o = createOrder({
      shop_id: "shop_berlin",
      items: [{ sku: "WINGS_6", qty: 1 }, { sku: "TIRAMISU", qty: 2 }],
      tip: "1.11",
      discount: "0.00",
      payment_type: "CARD",
      placed_at: "2026-10-25T02:30:00+02:00",
    });
    const lhs =
      parseMoneyToCents(o.subtotal) +
      parseMoneyToCents(o.convenience_fee) +
      parseMoneyToCents(o.tip) -
      parseMoneyToCents(o.discount);
    expect(lhs).toBe(parseMoneyToCents(o.total));
  });
});

describe("createOrder — CASH pricing", () => {
  it("has no dual pricing surcharge and no convenience fee", () => {
    const o = createOrder({
      shop_id: "shop_chicago",
      items: [{ sku: "BURGER_C", qty: 2 }, { sku: "SODA", qty: 10 }],
      tip: "0.00",
      discount: "1.00",
      payment_type: "CASH",
      placed_at: "2026-07-06T00:15:00-05:00",
    });
    // 9.49*2 + 0.10*10 = 18.98 + 1.00 = 19.98
    expect(o.subtotal).toBe("19.98");
    expect(o.dual_pricing_surcharge).toBe("0.00");
    expect(o.convenience_fee).toBe("0.00");
    expect(o.total).toBe("18.98"); // 19.98 - 1.00 discount
  });
});

describe("createOrder — rounding edge cases", () => {
  it("handles a cheap high-quantity item without cent drift (round-per-unit, not per-line)", () => {
    // SODA 0.10 -> *1.04 = 0.104 -> rounds to 0.10 per unit (rounding
    // per-unit keeps this identical to what a receipt would show per item)
    const o = createOrder({
      shop_id: "shop_chicago",
      items: [{ sku: "SODA", qty: 50 }],
      tip: "0.00",
      discount: "0.00",
      payment_type: "CARD",
    });
    expect(o.subtotal).toBe("5.00"); // 50 * 0.10
    expect(o.dual_pricing_surcharge).toBe("0.00"); // 0.104 rounds back down to 0.10
  });
});

describe("createOrder — validation", () => {
  const base = {
    shop_id: "shop_berlin",
    items: [{ sku: "SODA", qty: 1 }],
    tip: "0.00",
    discount: "0.00",
    payment_type: "CARD" as const,
  };

  it("rejects an unknown sku with 400", () => {
    expect(() =>
      createOrder({ ...base, items: [{ sku: "NOT_A_REAL_SKU", qty: 1 }] })
    ).toThrow(ValidationError);
  });

  it("rejects an unknown shop_id with 400", () => {
    expect(() => createOrder({ ...base, shop_id: "shop_atlantis" })).toThrow(ValidationError);
  });

  it("rejects negative tip", () => {
    expect(() => createOrder({ ...base, tip: "-1.00" })).toThrow(ValidationError);
  });

  it("rejects negative discount", () => {
    expect(() => createOrder({ ...base, discount: "-1.00" })).toThrow(ValidationError);
  });

  it("rejects a discount larger than the pre-discount total", () => {
    expect(() => createOrder({ ...base, discount: "999.00" })).toThrow(ValidationError);
  });

  it("rejects placed_at without a UTC offset", () => {
    expect(() => createOrder({ ...base, placed_at: "2026-07-05T23:30:00" })).toThrow(
      ValidationError
    );
  });
});
