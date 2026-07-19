/**
 * All monetary math happens in integer cents. We never do arithmetic on
 * floats/strings representing dollars — floats can't represent money
 * exactly (0.1 + 0.2 !== 0.3), and repeated string math is error-prone.
 * We convert dollar-strings to integer cents at the boundary, do all math
 * as integers, and format back to a "X.XX" string only when we respond.
 */

const MONEY_STRING_RE = /^\d+\.\d{2}$/;

export class InvalidMoneyError extends Error {}

/** Parses a "12.30"-style dollar string into integer cents (1230). */
export function parseMoneyToCents(value: string): number {
  if (typeof value !== "string" || !MONEY_STRING_RE.test(value)) {
    throw new InvalidMoneyError(
      `Expected a money string with exactly 2 decimals (e.g. "12.30"), got: ${JSON.stringify(value)}`
    );
  }
  const [dollars, cents] = value.split(".");
  return Number(dollars) * 100 + Number(cents);
}

/** Formats integer cents back into a "12.30"-style string. */
export function centsToMoney(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const dollars = Math.floor(abs / 100);
  const rem = abs % 100;
  return `${negative ? "-" : ""}${dollars}.${String(rem).padStart(2, "0")}`;
}

/**
 * Round-half-up to the nearest integer cent. Used for percentage-based fees
 * (dual pricing, convenience fee) where the raw result is fractional cents.
 * Half-up (rather than banker's rounding) is the common convention for
 * customer-facing money and matches what most POS/payment processors do.
 */
export function roundHalfUpToCent(fractionalCents: number): number {
  return Math.floor(fractionalCents + 0.5);
}

/**
 * Splits `totalCents` into `ways` non-negative integer shares that sum
 * back to exactly `totalCents`, with the spread between the largest and
 * smallest share never exceeding 1 cent.
 *
 * Approach: integer division for the base share, then distribute the
 * leftover cents one-by-one to the first `remainder` shares. This is
 * deterministic and guarantees exactness (no float drift, no invented or
 * lost cents) unlike splitting dollar-strings or using toFixed().
 */
export function splitCentsExact(totalCents: number, ways: number): number[] {
  const base = Math.floor(totalCents / ways);
  const remainder = totalCents - base * ways; // 0 <= remainder < ways
  const shares: number[] = [];
  for (let i = 0; i < ways; i++) {
    shares.push(base + (i < remainder ? 1 : 0));
  }
  return shares;
}
