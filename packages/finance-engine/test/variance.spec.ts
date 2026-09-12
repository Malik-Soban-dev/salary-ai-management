import { describe, expect, it } from "vitest";
import { money, type Transaction } from "@salary-ai/domain";
import { detectBudgetVariance } from "../src/variance.js";

const PERIOD = { year: 2026, month: 9 };

function tx(minor: number, categoryId: string, date: string): Transaction {
  return {
    id: `t-${categoryId}-${date}`,
    userId: "u1",
    amount: money(minor, "PKR"),
    date,
    merchant: "M",
    categoryId,
    source: "manual",
    confidence: 1,
    createdAt: "2026-09-01T00:00:00Z",
  };
}

describe("detectBudgetVariance", () => {
  const planned = [
    { categoryId: "food", name: "Food", plannedMinor: 1_000_000 },
    { categoryId: "transport", name: "Transport", plannedMinor: 400_000 },
    { categoryId: "fun", name: "Fun", plannedMinor: 200_000 },
  ];

  it("classifies over, at-risk, under and on-track categories", () => {
    const result = detectBudgetVariance({
      period: PERIOD,
      currency: "PKR",
      planned,
      transactions: [
        tx(1_200_000, "food", "2026-09-05"), // 120% → over
        tx(360_000, "transport", "2026-09-05"), // 90% → at_risk
        tx(50_000, "fun", "2026-09-05"), // 25% → under
      ],
    });

    const byId = Object.fromEntries(result.lines.map((l) => [l.categoryId, l]));
    expect(byId.food!.status).toBe("over");
    expect(byId.transport!.status).toBe("at_risk");
    expect(byId.fun!.status).toBe("under");
    expect(byId.food!.delta.amountMinor).toBe(-200_000); // planned − actual
    expect(result.totalActual.amountMinor).toBe(1_610_000);
    expect(result.totalPlanned.amountMinor).toBe(1_600_000);
  });

  it("ignores transactions outside the period", () => {
    const result = detectBudgetVariance({
      period: PERIOD,
      currency: "PKR",
      planned,
      transactions: [tx(500_000, "food", "2026-08-31")],
    });
    expect(result.lines[0]!.actual.amountMinor).toBe(0);
  });

  it("reports infinite percentUsed as Infinity when spending into a zero budget", () => {
    const result = detectBudgetVariance({
      period: PERIOD,
      currency: "PKR",
      planned: [{ categoryId: "x", name: "X", plannedMinor: 0 }],
      transactions: [tx(100, "x", "2026-09-02")],
    });
    expect(result.lines[0]!.percentUsed).toBe(Number.POSITIVE_INFINITY);
    expect(result.lines[0]!.status).toBe("over");
  });
});
