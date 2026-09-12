import { describe, expect, it } from "vitest";
import type { RecurringItem } from "@salary-ai/domain";
import { calculateEmergencyFundStatus } from "../src/emergencyFund.js";
import { projectGoal } from "../src/goalProjection.js";
import { forecastRecurringCosts } from "../src/recurringForecast.js";

describe("calculateEmergencyFundStatus", () => {
  it("computes progress and months of essentials covered", () => {
    const status = calculateEmergencyFundStatus({
      currency: "PKR",
      currentAmountMinor: 2_000_000,
      targetAmountMinor: 6_000_000,
      monthlyContributionMinor: 500_000,
      averageMonthlyEssentialsMinor: 1_000_000,
    });
    expect(status.progressPercent).toBeCloseTo(33.3, 1);
    expect(status.essentialsCoverageMonths).toBe(2);
  });

  it("clamps progress at 100% and handles a zero target", () => {
    const above = calculateEmergencyFundStatus({
      currency: "JPY", currentAmountMinor: 1_000_000, targetAmountMinor: 540_000,
      monthlyContributionMinor: 0, averageMonthlyEssentialsMinor: 90_000,
    });
    expect(above.progressPercent).toBe(100);
    const zeroTarget = calculateEmergencyFundStatus({
      currency: "JPY", currentAmountMinor: 0, targetAmountMinor: 0,
      monthlyContributionMinor: 0, averageMonthlyEssentialsMinor: 1,
    });
    expect(zeroTarget.progressPercent).toBe(0);
  });
});

describe("projectGoal", () => {
  it("computes required pace from a deadline", () => {
    const p = projectGoal({
      goal: { id: "g", targetAmountMinor: 13_000, savedAmountMinor: 1_000, targetDate: "2027-09", priority: 1 },
      period: { year: 2026, month: 9 },
      plannedMonthlyContributionMinor: 1_000,
    });
    // Sep 2026 … Sep 2027 inclusive = 13 months → ceil(12,000 / 13) = 924
    expect(p.requiredMonthlyPaceMinor).toBe(924);
    expect(p.monthsRemaining).toBe(13);
    expect(p.onTrack).toBe(true); // planned 1,000 ≥ required 924
  });

  it("marks off-track when the plan misses the required pace", () => {
    const p = projectGoal({
      goal: { id: "g", targetAmountMinor: 26_000, savedAmountMinor: 0, targetDate: "2027-09", priority: 1 },
      period: { year: 2026, month: 9 },
      plannedMonthlyContributionMinor: 1_000,
    });
    expect(p.requiredMonthlyPaceMinor).toBe(2_000);
    expect(p.onTrack).toBe(false);
  });

  it("projects completion when no deadline exists but contributions continue", () => {
    const p = projectGoal({
      goal: { id: "g", targetAmountMinor: 10_000, savedAmountMinor: 4_000, priority: 1 },
      period: { year: 2026, month: 9 },
      plannedMonthlyContributionMinor: 1_000,
    });
    expect(p.projectedCompletion).toEqual({ year: 2027, month: 2 }); // 6 contributions: Sep…Feb
    expect(p.monthsRemaining).toBeNull();
    expect(p.onTrack).toBe(true);
  });

  it("is already complete when saved ≥ target", () => {
    const p = projectGoal({
      goal: { id: "g", targetAmountMinor: 100, savedAmountMinor: 100, priority: 1 },
      period: { year: 2026, month: 9 },
      plannedMonthlyContributionMinor: 0,
    });
    expect(p.onTrack).toBe(true);
    expect(p.projectedCompletion).toEqual({ year: 2026, month: 9 });
  });
});

describe("forecastRecurringCosts", () => {
  const items: RecurringItem[] = [
    { id: "r1", name: "Rent", essential: true, expectedAmountMinor: 50_000, cadence: "monthly", dueDay: 1, confidence: 1, source: "user" },
    { id: "r2", name: "Electricity", essential: true, expectedAmountMinor: 8_000, rangeMinor: { low: 6_000, high: 11_000 }, cadence: "monthly", dueDay: 15, confidence: 0.7, source: "inferred" },
    { id: "r3", name: "Insurance", essential: false, expectedAmountMinor: 12_000, cadence: "annual", confidence: 1, source: "user" },
  ];

  it("normalizes cadences to monthly and preserves ranges", () => {
    const result = forecastRecurringCosts(items, { year: 2026, month: 9 }, "PKR");
    expect(result.totalExpected.amountMinor).toBe(50_000 + 8_000 + 1_000);
    expect(result.totalRange.low.amountMinor).toBe(50_000 + 6_000 + 1_000);
    expect(result.totalRange.high.amountMinor).toBe(50_000 + 11_000 + 1_000);
  });

  it("carries confidence per line", () => {
    const result = forecastRecurringCosts(items, { year: 2026, month: 9 }, "PKR");
    expect(result.lines[1]!.confidence).toBe(0.7);
  });
});
