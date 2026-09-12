import { describe, expect, it } from "vitest";
import {
  CurrencyMismatchError,
  add,
  allocateByWeights,
  cmp,
  formatMoney,
  money,
  moneyFromMajor,
  scaleFloor,
  sub,
  toMajor,
} from "@salary-ai/domain";

describe("money", () => {
  it("stores integer minor units and rejects fractions", () => {
    expect(money(1250, "PKR")).toEqual({ amountMinor: 1250, currency: "PKR" });
    expect(() => money(10.5, "PKR")).toThrow(RangeError);
  });

  it("converts major to minor with half-up rounding", () => {
    expect(moneyFromMajor(1250.5, "PKR").amountMinor).toBe(125050);
    expect(moneyFromMajor(1250.505, "PKR").amountMinor).toBe(125051); // float-safe rounding
    expect(moneyFromMajor(320, "JPY").amountMinor).toBe(320); // zero-decimal
  });

  it("guards currency mismatch", () => {
    expect(() => add(money(100, "PKR"), money(100, "USD"))).toThrow(CurrencyMismatchError);
  });

  it("adds, subtracts and compares", () => {
    expect(add(money(100, "USD"), money(250, "USD")).amountMinor).toBe(350);
    expect(sub(money(100, "USD"), money(250, "USD")).amountMinor).toBe(-150);
    expect(cmp(money(100, "USD"), money(99, "USD"))).toBe(1);
  });

  it("scales with floor", () => {
    expect(scaleFloor(money(999, "USD"), 90, 100).amountMinor).toBe(899);
  });

  it("major conversion respects minor-unit digits", () => {
    expect(toMajor(money(125050, "PKR"))).toBe(1250.5);
    expect(toMajor(money(125050, "KWD"))).toBeCloseTo(125.05, 5); // 3 decimal places
  });
});

describe("allocateByWeights (largest remainder)", () => {
  it("sums exactly to the total", () => {
    const total = money(1000, "PKR");
    const parts = allocateByWeights(total, [1, 1, 1]);
    expect(parts.reduce((a, p) => a + p.amountMinor, 0)).toBe(1000);
  });

  it("is proportional and deterministic", () => {
    const total = money(10_000, "USD");
    const a = allocateByWeights(total, [4, 2, 2, 1]);
    const b = allocateByWeights(total, [4, 2, 2, 1]);
    expect(a).toEqual(b);
    expect(a.map((p) => p.amountMinor)).toEqual([4445, 2222, 2222, 1111]); // 10,000 × (4,2,2,1)/9, remainder to largest fraction
  });

  it("gives remainders to the largest fractional parts in order", () => {
    const total = money(100, "USD");
    const parts = allocateByWeights(total, [1, 1, 1]);
    expect(parts.map((p) => p.amountMinor)).toEqual([34, 33, 33]);
  });

  it("handles zero weights with an even split", () => {
    const parts = allocateByWeights(money(90, "USD"), [0, 0, 0]);
    expect(parts.map((p) => p.amountMinor)).toEqual([30, 30, 30]);
  });

  it("handles a single category", () => {
    expect(allocateByWeights(money(777, "USD"), [5]).map((p) => p.amountMinor)).toEqual([777]);
  });
});

describe("formatMoney", () => {
  it("formats with currency symbol and minor digits", () => {
    expect(formatMoney(money(125050, "PKR"))).toBe("Rs 1,250.50");
    expect(formatMoney(money(-9900, "USD"))).toBe("-$ 99.00");
    expect(formatMoney(money(320000, "JPY"))).toBe("¥ 320,000");
  });
});
