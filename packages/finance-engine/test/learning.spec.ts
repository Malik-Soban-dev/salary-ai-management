import { describe, expect, it } from "vitest";
import { money, type Transaction } from "@salary-ai/domain";
import { learnCategoryWeights } from "../src/learning.js";

const PERIOD = { year: 2026, month: 9 };

function tx(minor: number, categoryId: string, day = 5): Transaction {
  return {
    id: `t-${categoryId}-${day}-${minor}`,
    userId: "u1",
    amount: money(minor, "PKR"),
    date: `2026-09-${String(day).padStart(2, "0")}`,
    merchant: "M",
    categoryId,
    source: "manual",
    confidence: 1,
    createdAt: "2026-09-05T00:00:00Z",
  };
}

describe("learnCategoryWeights", () => {
  const categories = [
    { id: "x", name: "X", baselineWeight: 1 },
    { id: "y", name: "Y", baselineWeight: 3 },
  ];

  it("blends observed shares toward actual behavior with the damping factor", () => {
    // Observed: X 315, Y 129 of 444 → shares .7095/.2905; old shares .25/.75.
    // damping 0.5 → blended shares × old sum 4 → 1.92 / 2.08 (sum preserved).
    const result = learnCategoryWeights({
      period: PERIOD,
      categories,
      plannedMinor: [
        { categoryId: "x", plannedMinor: 100 },
        { categoryId: "y", plannedMinor: 300 },
      ],
      transactions: [tx(300, "x"), tx(100, "y"), tx(10, "x", 6), tx(20, "y", 7), tx(5, "x", 8), tx(9, "y", 9)],
      policy: { damping: 0.5, minTransactions: 4 },
    });

    expect(result.evidence.sufficient).toBe(true);
    expect(result.weights.x).toBe(1.92);
    expect(result.weights.y).toBe(2.08);
    expect(result.changes).toHaveLength(2);
    expect(result.changes[0]!.material).toBe(true); // X nearly doubled
    expect(result.changes[0]!.reason).toContain("71% of flexible spend");
  });

  it("refuses to learn from insufficient evidence", () => {
    const result = learnCategoryWeights({
      period: PERIOD,
      categories,
      plannedMinor: [],
      transactions: [tx(5000, "x")],
      policy: { minTransactions: 4 },
    });
    expect(result.evidence.sufficient).toBe(false);
    expect(result.changes).toEqual([]);
    expect(result.weights).toEqual({});
  });

  it("respects the weight floor so categories never collapse to zero", () => {
    const result = learnCategoryWeights({
      period: PERIOD,
      categories: [
        { id: "a", name: "A", baselineWeight: 8 },
        { id: "b", name: "B", baselineWeight: 1 },
      ],
      plannedMinor: [
        { categoryId: "a", plannedMinor: 900 },
        { categoryId: "b", plannedMinor: 100 },
      ],
      transactions: [tx(100, "b", 1), tx(100, "b", 2), tx(100, "b", 3), tx(100, "b", 4), tx(100, "b", 5)],
      policy: { damping: 0.9, minTransactions: 4, minWeightFractionOfMean: 0.25 },
    });
    // B takes nearly everything; A must stay at or above 0.25 × mean(4.5) = 1.125
    expect(result.weights.a).toBeGreaterThanOrEqual(1.125);
  });

  it("ignores transactions from other periods and uncategorized spend", () => {
    const result = learnCategoryWeights({
      period: PERIOD,
      categories,
      plannedMinor: [],
      transactions: [
        tx(100, "x"),
        tx(100, "x"),
        tx(100, "x"),
        tx(100, "x"),
        { ...tx(999, "x"), date: "2026-08-20" },
        { ...tx(999, undefined as unknown as string) },
      ],
      policy: { minTransactions: 4 },
    });
    expect(result.evidence.transactionsInPeriod).toBe(5); // in-period count includes uncategorized
    expect(result.evidence.categorizedInPeriod).toBe(4);
    expect(result.evidence.observedFlexibleMinor).toBe(400);
  });

  it("is deterministic", () => {
    const args = {
      period: PERIOD,
      categories,
      plannedMinor: [] as Array<{ categoryId: string; plannedMinor: number }>,
      transactions: [tx(300, "x"), tx(100, "y"), tx(50, "x", 6), tx(25, "y", 7)],
      policy: { damping: 0.5, minTransactions: 4 },
    };
    expect(learnCategoryWeights(args)).toEqual(learnCategoryWeights(args));
  });
});
