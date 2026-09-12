import { describe, expect, it } from "vitest";
import {
  addPeriods,
  daysInMonth,
  daysRemainingInPeriod,
  elapsedFraction,
  monthsBetween,
  periodOf,
} from "../src/period.js";

describe("period utilities", () => {
  it("counts days in a month", () => {
    expect(daysInMonth({ year: 2026, month: 9 })).toBe(30);
    expect(daysInMonth({ year: 2024, month: 2 })).toBe(29); // leap
    expect(daysInMonth({ year: 2026, month: 2 })).toBe(28);
  });

  it("computes days remaining inclusive of today", () => {
    expect(daysRemainingInPeriod("2026-09-30", { year: 2026, month: 9 })).toBe(1);
    expect(daysRemainingInPeriod("2026-09-01", { year: 2026, month: 9 })).toBe(30);
    expect(daysRemainingInPeriod("2026-10-01", { year: 2026, month: 9 })).toBe(0);
  });

  it("parses and maps dates to periods", () => {
    expect(periodOf("2026-09-11")).toEqual({ year: 2026, month: 9 });
  });

  it("adds periods across year boundaries", () => {
    expect(addPeriods({ year: 2026, month: 11 }, 2)).toEqual({ year: 2027, month: 1 });
    expect(addPeriods({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });

  it("computes month deltas", () => {
    expect(monthsBetween({ year: 2026, month: 9 }, { year: 2027, month: 9 })).toBe(12);
    expect(monthsBetween({ year: 2027, month: 9 }, { year: 2026, month: 9 })).toBe(-12);
  });

  it("computes elapsed fraction", () => {
    expect(elapsedFraction("2026-09-01", { year: 2026, month: 9 })).toBe(0);
    expect(elapsedFraction("2026-09-30", { year: 2026, month: 9 })).toBeCloseTo(29 / 30, 5);
  });
});
