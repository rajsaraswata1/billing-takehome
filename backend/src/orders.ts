import { DateTime } from "luxon";
import { menuBySku, shopsById, orderStore } from "./data.js";
import { centsToMoney, parseMoneyToCents, roundHalfUpToCent } from "./money.js";
import type { CreateOrderRequest, OrderResponse, StoredOrder } from "./types.js";

export class ValidationError extends Error {
  status = 400;
}
export class NotFoundError extends Error {
  status = 404;
}
export class InvariantError extends Error {
  status = 422;
}

const DUAL_PRICING_RATE = 0.04; // CARD only, baked into item prices
const CONVENIENCE_FEE_RATE = 0.029; // CARD only
const CONVENIENCE_FEE_FLAT_CENTS = 30; // $0.30, CARD only

export function createOrder(body: CreateOrderRequest): OrderResponse {
  if (!body || typeof body !== "object") {
    throw new ValidationError("Request body must be a JSON object");
  }
  const { shop_id, items, tip, discount, payment_type, placed_at } = body;

  if (typeof shop_id !== "string" || !shopsById.has(shop_id)) {
    throw new ValidationError(`Unknown shop_id: ${JSON.stringify(shop_id)}`);
  }
  if (payment_type !== "CARD" && payment_type !== "CASH") {
    throw new ValidationError('payment_type must be "CARD" or "CASH"');
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new ValidationError("items must be a non-empty array");
  }

  // Resolve each line item against the menu fixture up front so an unknown
  // sku fails fast with a 400, before any money math happens.
  const lines = items.map((line) => {
    if (!line || typeof line.sku !== "string") {
      throw new ValidationError("Each item needs a sku");
    }
    const menuItem = menuBySku.get(line.sku);
    if (!menuItem) {
      throw new ValidationError(`Unknown sku: ${JSON.stringify(line.sku)}`);
    }
    if (!Number.isInteger(line.qty) || line.qty <= 0) {
      throw new ValidationError(`qty for ${line.sku} must be a positive integer`);
    }
    return { sku: line.sku, qty: line.qty, unitCents: parseMoneyToCents(menuItem.price) };
  });

  let tipCents: number;
  let discountCents: number;
  try {
    tipCents = parseMoneyToCents(tip);
    discountCents = parseMoneyToCents(discount);
  } catch (err) {
    throw new ValidationError((err as Error).message);
  }
  if (tipCents < 0) throw new ValidationError("tip must not be negative");
  if (discountCents < 0) throw new ValidationError("discount must not be negative");

  const isCard = payment_type === "CARD";

  // Pre-surcharge subtotal, used only to report how much of the subtotal
  // the dual-pricing surcharge accounts for.
  const preSurchargeSubtotalCents = lines.reduce((sum, l) => sum + l.unitCents * l.qty, 0);

  // Dual pricing is applied per unit (each item's price bumped 4%) and
  // rounded to the cent BEFORE multiplying by qty and summing — rounding
  // the line total instead would let large quantities of cheap items drift
  // by several cents from what a receipt showing a per-unit price implies.
  let subtotalCents = 0;
  for (const line of lines) {
    const dualUnitCents = isCard
      ? roundHalfUpToCent(line.unitCents * (1 + DUAL_PRICING_RATE))
      : line.unitCents;
    subtotalCents += dualUnitCents * line.qty;
  }
  const dualPricingSurchargeCents = isCard ? subtotalCents - preSurchargeSubtotalCents : 0;

  const convenienceFeeCents = isCard
    ? roundHalfUpToCent(subtotalCents * CONVENIENCE_FEE_RATE) + CONVENIENCE_FEE_FLAT_CENTS
    : 0;

  const preDiscountTotalCents = subtotalCents + convenienceFeeCents + tipCents;
  if (discountCents > preDiscountTotalCents) {
    throw new ValidationError("discount cannot exceed the pre-discount total");
  }

  const totalCents = preDiscountTotalCents - discountCents;

  // Defensive invariant check. With the formula above this can never
  // actually drift, but the contract calls for a 422 guard, and keeping it
  // means a future refactor that breaks the identity fails loudly (as a
  // client-visible 422) instead of silently shipping wrong totals.
  const recomputed = subtotalCents + convenienceFeeCents + tipCents - discountCents;
  if (Math.abs(recomputed - totalCents) > 1) {
    throw new InvariantError("subtotal + convenience_fee + tip - discount != total");
  }

  const resolvedPlacedAt = resolvePlacedAt(placed_at);

  const stored: StoredOrder = orderStore.create({
    shop_id,
    payment_type,
    placed_at: resolvedPlacedAt.iso,
    placed_at_utc_ms: resolvedPlacedAt.utcMs,
    items: lines.map((l) => ({ sku: l.sku, qty: l.qty })),
    subtotal_cents: subtotalCents,
    convenience_fee_cents: convenienceFeeCents,
    dual_pricing_surcharge_cents: dualPricingSurchargeCents,
    tip_cents: tipCents,
    discount_cents: discountCents,
    total_cents: totalCents,
  });

  return toResponse(stored);
}

function resolvePlacedAt(placedAt: string | undefined): { iso: string; utcMs: number } {
  if (placedAt === undefined) {
    const now = DateTime.utc();
    return { iso: now.toISO()!, utcMs: now.toMillis() };
  }
  // Require an explicit offset (per contract: "ISO-8601 with offset") so
  // an instant is unambiguous — a bare local time with no offset can't be
  // placed on a UTC timeline, which report grouping depends on.
  const dt = DateTime.fromISO(placedAt, { setZone: true });
  if (!dt.isValid || dt.offset === undefined || !/[Zz]|[+-]\d{2}:?\d{2}$/.test(placedAt)) {
    throw new ValidationError(`placed_at must be a valid ISO-8601 timestamp with an offset: ${placedAt}`);
  }
  return { iso: placedAt, utcMs: dt.toMillis() };
}

export function toResponse(order: StoredOrder): OrderResponse {
  return {
    id: order.id,
    shop_id: order.shop_id,
    payment_type: order.payment_type,
    placed_at: order.placed_at,
    subtotal: centsToMoney(order.subtotal_cents),
    convenience_fee: centsToMoney(order.convenience_fee_cents),
    dual_pricing_surcharge: centsToMoney(order.dual_pricing_surcharge_cents),
    tip: centsToMoney(order.tip_cents),
    discount: centsToMoney(order.discount_cents),
    total: centsToMoney(order.total_cents),
  };
}

export function getOrderOrThrow(id: string): StoredOrder {
  const order = orderStore.get(id);
  if (!order) throw new NotFoundError(`No order with id ${JSON.stringify(id)}`);
  return order;
}
