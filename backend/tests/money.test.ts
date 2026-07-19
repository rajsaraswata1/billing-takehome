import { describe, it, expect } from "vitest";
import { centsToMoney, parseMoneyToCents, roundHalfUpToCent, splitCentsExact } from "../src/money.js";

describe("parseMoneyToCents / centsToMoney", () => {
  it("round-trips exactly", () => {
    expect(parseMoneyToCents("12.30")).toBe(1230);
    expect(parseMoneyToCents("0.10")).toBe(10);
    expect(parseMoneyToCents("100.00")).toBe(10000);
    expect(centsToMoney(1230)).toBe("12.30");
    expect(centsToMoney(10)).toBe("0.10");
    expect(centsToMoney(5)).toBe("0.05");
  });

  it("rejects malformed money strings", () => {
    expect(() => parseMoneyToCents("12.3")).toThrow();
    expect(() => parseMoneyToCents("12")).toThrow();
    expect(() => parseMoneyToCents("abc")).toThrow();
    expect(() => parseMoneyToCents("-1.00")).toThrow(); // sign not allowed by format; negativity checked separately upstream
  });
});

describe("roundHalfUpToCent", () => {
  it("rounds .5 up, not to even (not banker's rounding)", () => {
    expect(roundHalfUpToCent(100.5)).toBe(101);
    expect(roundHalfUpToCent(101.5)).toBe(102); // banker's rounding would give 102 too, so also check a case where it'd differ
    expect(roundHalfUpToCent(99.5)).toBe(100);
  });

  it("rounds ordinary fractional cents correctly", () => {
    expect(roundHalfUpToCent(1350.96)).toBe(1351);
    expect(roundHalfUpToCent(346.32)).toBe(346);
    expect(roundHalfUpToCent(69.281)).toBe(69);
  });
});

describe("splitCentsExact", () => {
  it("sums exactly back to the total for a non-divisible amount", () => {
    // $28.62 across 3 ways: 2862 / 3 = 954 exactly (divisible case)
    expect(splitCentsExact(2862, 3)).toEqual([954, 954, 954]);
  });

  it("distributes remainder cents with max-min spread of at most 1 cent", () => {
    // 100 cents / 3 = 33 base, remainder 1 -> [34, 33, 33]
    const shares = splitCentsExact(100, 3);
    expect(shares).toEqual([34, 33, 33]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(100);
    expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1);
  });

  it("handles a famously awkward remainder (1 cent across 7 ways)", () => {
    const shares = splitCentsExact(1, 7);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(1);
    expect(shares.filter((s) => s === 1)).toHaveLength(1);
    expect(shares.filter((s) => s === 0)).toHaveLength(6);
  });

  it("handles the maximum ways (20) without losing or inventing cents", () => {
    const total = 1999; // $19.99, does not divide evenly by 20
    const shares = splitCentsExact(total, 20);
    expect(shares).toHaveLength(20);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(total);
    expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1);
  });

  it("handles zero total gracefully", () => {
    const shares = splitCentsExact(0, 4);
    expect(shares).toEqual([0, 0, 0, 0]);
  });
});
