import { describe, it, expect, beforeEach } from "vitest";
import { createOrder, ValidationError } from "../src/orders.js";
import { dailyReport } from "../src/reports.js";
import { orderStore } from "../src/data.js";

beforeEach(() => orderStore.clear());

describe("dailyReport — timezone business-day boundary", () => {
  it("puts 23:30 Chicago-local on the 5th, and 00:15 Chicago-local on the 6th", () => {
    const order5th = createOrder({
      shop_id: "shop_chicago",
      items: [{ sku: "PIZZA_M", qty: 1 }],
      tip: "0.00",
      discount: "0.00",
      payment_type: "CARD",
      placed_at: "2026-07-05T23:30:00-05:00",
    });
    const order6th = createOrder({
      shop_id: "shop_chicago",
      items: [{ sku: "SODA", qty: 1 }],
      tip: "0.00",
      discount: "0.00",
      payment_type: "CASH",
      placed_at: "2026-07-06T00:15:00-05:00",
    });

    const july5 = dailyReport("2026-07-05", "America/Chicago");
    expect(july5.orders.map((o) => o.id)).toEqual([order5th.id]);

    const july6 = dailyReport("2026-07-06", "America/Chicago");
    expect(july6.orders.map((o) => o.id)).toEqual([order6th.id]);
  });

  it("re-projects into the REQUESTED report tz, not the shop's own tz", () => {
    // 23:30 CDT (-05:00) on July 5th is 04:30 UTC on July 6th.
    const order = createOrder({
      shop_id: "shop_chicago",
      items: [{ sku: "PIZZA_M", qty: 1 }],
      tip: "0.00",
      discount: "0.00",
      payment_type: "CARD",
      placed_at: "2026-07-05T23:30:00-05:00",
    });

    const asUtc = dailyReport("2026-07-06", "UTC");
    expect(asUtc.orders.map((o) => o.id)).toEqual([order.id]);

    const notOnUtcJuly5 = dailyReport("2026-07-05", "UTC");
    expect(notOnUtcJuly5.orders).toHaveLength(0);
  });
});

describe("dailyReport — DST fall-back fold (Berlin, Oct 25 2026)", () => {
  it("groups both the pre- and post-fold 02:30 orders on the same Berlin calendar day", () => {
    // Clocks in Europe/Berlin fall back from 03:00 CEST to 02:00 CET at
    // 2026-10-25 01:00 UTC, so local time 02:30 occurs twice that night —
    // once at +02:00 (before the fold) and once at +01:00 (after). Both
    // instants are still within Oct 25 local time, so both belong to the
    // same business day. This only works if placed_at is parsed as an
    // absolute instant (offset respected) rather than as a naive wall-clock
    // string with the offset ignored.
    const preFold = createOrder({
      shop_id: "shop_berlin",
      items: [{ sku: "WINGS_6", qty: 1 }],
      tip: "0.00",
      discount: "0.00",
      payment_type: "CARD",
      placed_at: "2026-10-25T02:30:00+02:00",
    });
    const postFold = createOrder({
      shop_id: "shop_berlin",
      items: [{ sku: "SALAD_G", qty: 1 }],
      tip: "0.00",
      discount: "0.00",
      payment_type: "CARD",
      placed_at: "2026-10-25T02:30:00+01:00",
    });

    const report = dailyReport("2026-10-25", "Europe/Berlin");
    const ids = report.orders.map((o) => o.id);
    expect(ids).toContain(preFold.id);
    expect(ids).toContain(postFold.id);
    expect(report.order_count).toBe(2);

    // And they really are different instants an hour apart, not duplicates.
    expect(preFold.id).not.toBe(postFold.id);
  });
});

describe("dailyReport — validation and totals", () => {
  it("rejects an invalid IANA timezone with 400", () => {
    expect(() => dailyReport("2026-07-05", "Mars/OlympusMons")).toThrow(ValidationError);
  });

  it("rejects a malformed date with 400", () => {
    expect(() => dailyReport("07-05-2026", "UTC")).toThrow(ValidationError);
    expect(() => dailyReport("2026-02-30", "UTC")).toThrow(ValidationError);
  });

  it("sums gross_total and card_fees_total only over matching orders", () => {
    createOrder({
      shop_id: "shop_berlin",
      items: [{ sku: "ESPRESSO", qty: 1 }],
      tip: "0.00",
      discount: "0.00",
      payment_type: "CARD",
      placed_at: "2026-01-01T10:00:00+01:00",
    });
    createOrder({
      shop_id: "shop_berlin",
      items: [{ sku: "ESPRESSO", qty: 1 }],
      tip: "0.00",
      discount: "0.00",
      payment_type: "CASH",
      placed_at: "2026-01-02T10:00:00+01:00", // different day — must be excluded
    });

    const report = dailyReport("2026-01-01", "Europe/Berlin");
    expect(report.order_count).toBe(1);
    expect(report.gross_total).not.toBe("0.00");
    expect(parseFloat(report.card_fees_total)).toBeGreaterThan(0);
  });
});
