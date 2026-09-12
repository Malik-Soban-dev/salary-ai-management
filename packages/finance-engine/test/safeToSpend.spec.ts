import { describe, expect, it } from "vitest";
import { money, type Transaction } from "@salary-ai/domain";
import { calculateSafeToSpend } from "../src/safeToSpend.js";

const PERIOD = { year: 2026, month: 9 };

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: partial.id ?? "t",
    userId: "u1",
    amount: partial.amount ?? money(100, "PKR"),
    date: partial.date ?? "2026-09-10",
    merchant: partial.merchant ?? "Shop",
    categoryId: partial.categoryId,
    source: "manual",
    confidence: 1,
    createdAt: "2026-09-10T00:00:00Z",
  };
}

describe("calculateSafeToSpend", () => {
  it("subtracts flexible spending and reserves upcoming obligations", () => {
    const result = calculateSafeToSpend({
      today: "2026-09-10",
      period: PERIOD,
      currency: "PKR",
      flexibleBudget: [
        { categoryId: "food", plannedMinor: 1_000_000 },
        { categoryId: "transport", plannedMinor: 500_000 },
      ],
      transactions: [
        tx({ amount: money(250_000, "PKR"), categoryId: "food" }),
        tx({ amount: money(50_000, "PKR"), categoryId: "unknown-cat" }), // ignored
      ],
      upcomingObligations: [{ recurringItemId: "elec", amountMinor: 200_000, dueDay: 15 }],
    });

    expect(result.breakdown.flexibleBudgetTotal.amountMinor).toBe(1_500_000);
    expect(result.breakdown.flexibleSpent.amountMinor).toBe(250_000);
    expect(result.breakdown.flexibleRemaining.amountMinor).toBe(1_250_000);
    expect(result.breakdown.reservedForUpcomingObligations.amountMinor).toBe(200_000);
    expect(result.availableNow.amountMinor).toBe(1_050_000);
  });

  it("computes a floored daily recommendation over remaining days (inclusive of today)", () => {
    const result = calculateSafeToSpend({
      today: "2026-09-10",
      period: PERIOD,
      currency: "PKR",
      flexibleBudget: [{ categoryId: "food", plannedMinor: 2_100_000 }],
      transactions: [],
      upcomingObligations: [],
    });
    expect(result.daysRemaining).toBe(21); // Sept 10..30
    expect(result.dailyRecommended.amountMinor).toBe(100_000);
  });

  it("never goes negative: overspend clamps availableNow to zero and reports overspend", () => {
    const result = calculateSafeToSpend({
      today: "2026-09-20",
      period: PERIOD,
      currency: "PKR",
      flexibleBudget: [{ categoryId: "food", plannedMinor: 500_000 }],
      transactions: [tx({ amount: money(700_000, "PKR"), categoryId: "food", date: "2026-09-19" })],
      upcomingObligations: [],
    });
    expect(result.availableNow.amountMinor).toBe(0);
    expect(result.breakdown.overspend.amountMinor).toBe(200_000);
    expect(result.dailyRecommended.amountMinor).toBe(0);
  });

  it("ignores transactions outside the period", () => {
    const result = calculateSafeToSpend({
      today: "2026-09-10",
      period: PERIOD,
      currency: "PKR",
      flexibleBudget: [{ categoryId: "food", plannedMinor: 1_000_000 }],
      transactions: [tx({ amount: money(999_000, "PKR"), categoryId: "food", date: "2026-08-31" })],
      upcomingObligations: [],
    });
    expect(result.breakdown.flexibleSpent.amountMinor).toBe(0);
    expect(result.availableNow.amountMinor).toBe(1_000_000);
  });

  it("carries a calculation version", () => {
    const result = calculateSafeToSpend({
      today: "2026-09-10",
      period: PERIOD,
      currency: "PKR",
      flexibleBudget: [],
      transactions: [],
      upcomingObligations: [],
    });
    expect(result.calculationVersion).toBe("1.0.0");
  });
});
