import { DateTime } from "luxon";
import { orderStore } from "./data.js";
import { centsToMoney } from "./money.js";
import { ValidationError } from "./orders.js";

export interface DailyReportResponse {
  date: string;
  tz: string;
  order_count: number;
  orders: { id: string; placed_at: string; total: string }[];
  gross_total: string;
  card_fees_total: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidTimeZone(tz: string): boolean {
  try {
    // Luxon validates the zone name against the ICU/IANA database.
    return DateTime.now().setZone(tz).isValid;
  } catch {
    return false;
  }
}

export function dailyReport(dateParam: unknown, tzParam: unknown): DailyReportResponse {
  if (typeof dateParam !== "string" || !DATE_RE.test(dateParam)) {
    throw new ValidationError('date must be in YYYY-MM-DD format');
  }
  if (typeof tzParam !== "string" || !isValidTimeZone(tzParam)) {
    throw new ValidationError(`Invalid IANA timezone: ${JSON.stringify(tzParam)}`);
  }
  // A genuinely malformed calendar date (e.g. 2026-02-30) should also 400
  // rather than silently rolling over to March.
  const parsedDate = DateTime.fromISO(dateParam, { zone: tzParam });
  if (!parsedDate.isValid) {
    throw new ValidationError(`Invalid date: ${JSON.stringify(dateParam)}`);
  }

  // An order belongs to `date` if its UTC instant, viewed in `tz`, falls on
  // that calendar day. We resolve placed_at to a UTC instant once at write
  // time (placed_at_utc_ms) and re-project it into the requested tz here —
  // this is what correctly handles the Berlin DST-fold sample orders
  // (same local wall clock, different UTC instant) and the Chicago
  // "23:30 belongs to the 5th, 00:15 belongs to the 6th" boundary case.
  const matching = orderStore
    .all()
    .filter((order) => {
      const localDate = DateTime.fromMillis(order.placed_at_utc_ms, { zone: tzParam }).toISODate();
      return localDate === dateParam;
    })
    .sort((a, b) => a.placed_at_utc_ms - b.placed_at_utc_ms);

  const grossTotalCents = matching.reduce((sum, o) => sum + o.total_cents, 0);
  const cardFeesTotalCents = matching.reduce((sum, o) => sum + o.convenience_fee_cents, 0);

  return {
    date: dateParam,
    tz: tzParam,
    order_count: matching.length,
    orders: matching.map((o) => ({
      id: o.id,
      placed_at: o.placed_at,
      total: centsToMoney(o.total_cents),
    })),
    gross_total: centsToMoney(grossTotalCents),
    card_fees_total: centsToMoney(cardFeesTotalCents),
  };
}
