import { describe, expect, it } from "vitest";
import { money } from "@salary-ai/domain";
import { calculateMonthPlan, monthlyEquivalent } from "../src/monthPlan.js";
import { jpyMinimalProfile, pkrSalariedProfile, usdFreelanceProfile } from "./fixtures.js";

const PERIOD = { year: 2026, month: 9 };
const CREATED_AT = "2026-09-01T00:00:00Z";

function pkrInput(overrides: Partial<Parameters<typeof calculateMonthPlan>[0]> = {}) {
  return {
    period: PERIOD,
    currency: pkrSalariedProfile.currency,
    incomeSources: pkrSalariedProfile.incomeSources,
    commitments: pkrSalariedProfile.commitments,
    categories: pkrSalariedProfile.categories,
    emergency: pkrSalariedProfile.emergency,
    preferences: pkrSalariedProfile.preferences,
    goals: pkrSalariedProfile.goals,
    planId: "plan-1",
    userId: "user-1",
    createdAt: CREATED_AT,
    ...overrides,
  };
}

describe("calculateMonthPlan — PKR salaried profile", () => {
  const plan = calculateMonthPlan(pkrInput());

  it("protects essential obligations in full", () => {
    const protectedTotal = plan.totals.protected.amountMinor;
    const expected =
      4_500_000 + // rent
      900_000 + // utilities
      2_000_000; // family support
    expect(protectedTotal).toBe(expected);
    expect(plan.allocations.obligations).toHaveLength(3);
    expect(plan.allocations.obligations.every((o) => o.protected)).toBe(true);
  });

  it("allocates everything without going negative", () => {
    const { income, protected: prot, flexible, emergency, goals, buffer, unallocated } = plan.totals;
    expect(prot.amountMinor + flexible.amountMinor + emergency.amountMinor + goals.amountMinor + buffer.amountMinor + unallocated.amountMinor)
      .toBe(income.amountMinor);
    for (const value of [flexible.amountMinor, emergency.amountMinor, goals.amountMinor, buffer.amountMinor]) {
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  it("respects allocation priority: essentials → emergency → goals → buffer → flexible", () => {
    // Income 18,000,000 − essentials 7,400,000 = 10,600,000 remaining
    // Emergency needs 4,000,000 more (target 6m − current 2m), capped at 30% of income (5.4m) → full 4,000,000
    expect(plan.allocations.emergency.amountMinor).toBe(4_000_000);
    // Remaining 6,600,000. Goal pace: (12m−2m)/13 months → ceil(769,230.77) = 769,231
    expect(plan.allocations.goals[0]?.planned.amountMinor).toBe(769_231);
    // Buffer 5% of income = 900,000
    expect(plan.allocations.buffer.amountMinor).toBe(900_000);
    // Flexible = remainder
    expect(plan.totals.flexible.amountMinor).toBe(10_600_000 - 4_000_000 - 769_231 - 900_000);
  });

  it("splits flexible money across categories by weight, summing to the flexible total", () => {
    const sum = plan.allocations.flexible.reduce((a, c) => a + c.planned.amountMinor, 0);
    expect(sum).toBe(plan.totals.flexible.amountMinor);
    const weights = pkrSalariedProfile.categories.map((c) => c.baselineWeight);
    const groceries = plan.allocations.flexible.find((c) => c.categoryId === "cat-groceries")!;
    const shopping = plan.allocations.flexible.find((c) => c.categoryId === "cat-shopping")!;
    expect(groceries.planned.amountMinor / shopping.planned.amountMinor).toBeCloseTo(weights[0]! / weights[3]!, 1);
  });

  it("is deterministic: same inputs → identical plan including inputsHash", () => {
    const again = calculateMonthPlan(pkrInput());
    expect(again).toEqual(plan);
    expect(again.inputsHash).toBe(plan.inputsHash);
    expect(again.calculationVersion).toBe("1.0.0");
  });

  it("flags nothing for a healthy plan", () => {
    expect(plan.warnings).toEqual([]);
  });
});

describe("calculateMonthPlan — variable income haircut (USD freelancer)", () => {
  const plan = calculateMonthPlan({
    period: PERIOD,
    currency: usdFreelanceProfile.currency,
    incomeSources: usdFreelanceProfile.incomeSources,
    commitments: usdFreelanceProfile.commitments,
    categories: usdFreelanceProfile.categories,
    emergency: usdFreelanceProfile.emergency,
    preferences: usdFreelanceProfile.preferences,
    goals: usdFreelanceProfile.goals,
    planId: "plan-2",
    userId: "user-2",
    createdAt: CREATED_AT,
  });

  it("applies the documented 10% haircut to variable income", () => {
    expect(plan.totals.income.amountMinor).toBe(315_000); // 350,000 − 10%
    expect(plan.warnings.some((w) => w.code === "variable_income_haircut_applied")).toBe(true);
  });

  it("respects bufferBeforeGoals ordering", () => {
    // Essentials: 180,000 + 40,000 = 220,000. Remaining 95,000.
    // Buffer first ($200 fixed = 20,000), then emergency up to cap 30% (94,500)... need 460,000 → min(460,000, 94,500) = 94,500? No: remaining after buffer is 75,000 → emergency gets 75,000.
    expect(plan.allocations.buffer.amountMinor).toBe(20_000);
    expect(plan.allocations.emergency.amountMinor).toBe(75_000);
    expect(plan.totals.flexible.amountMinor).toBe(0);
    expect(plan.warnings.some((w) => w.code === "goal_underfunded")).toBe(true);
  });

  it("honors goal priority order when money runs out", () => {
    // Priority 1 (couch) is funded before priority 2 (laptop) — but both have floors (laptop has none) —
    // with 0 remaining after emergency, neither gets past floors; laptop floor unset → 0.
    const couch = plan.allocations.goals.find((g) => g.goalId === "g-couch")!;
    const laptop = plan.allocations.goals.find((g) => g.goalId === "g-laptop")!;
    expect(couch.priority).toBeLessThan(laptop.priority);
    expect(couch.planned.amountMinor).toBe(0);
  });
});

describe("calculateMonthPlan — JPY minimal profile", () => {
  const plan = calculateMonthPlan({
    period: PERIOD,
    currency: jpyMinimalProfile.currency,
    incomeSources: jpyMinimalProfile.incomeSources,
    commitments: jpyMinimalProfile.commitments,
    categories: jpyMinimalProfile.categories,
    emergency: jpyMinimalProfile.emergency,
    preferences: jpyMinimalProfile.preferences,
    goals: jpyMinimalProfile.goals,
    planId: "plan-3",
    userId: "user-3",
    createdAt: CREATED_AT,
  });

  it("works with a zero-decimal currency", () => {
    expect(plan.totals.income.amountMinor % 1).toBe(0);
    expect(plan.totals.flexible.amountMinor % 1).toBe(0);
  });

  it("skips emergency contributions once the target is reached", () => {
    expect(plan.allocations.emergency.amountMinor).toBe(0);
  });

  it("respects the food category floor", () => {
    const food = plan.allocations.flexible.find((c) => c.categoryId === "cat-food")!;
    expect(food.planned.amountMinor).toBeGreaterThanOrEqual(30_000);
  });
});

describe("calculateMonthPlan — scarcity behavior", () => {
  it("warns when income cannot cover essentials and never allocates negatives", () => {
    const plan = calculateMonthPlan(pkrInput({
      incomeSources: [
        { ...pkrSalariedProfile.incomeSources[0]!, expectedAmountMinor: 1_000_000 }, // Rs 10,000
      ],
    }));
    expect(plan.warnings.some((w) => w.code === "income_below_essentials")).toBe(true);
    expect(plan.totals.protected.amountMinor).toBe(7_400_000); // still protected in the ledger view
    expect(plan.totals.flexible.amountMinor).toBe(0);
    expect(plan.totals.buffer.amountMinor).toBe(0);
    expect(plan.totals.unallocated.amountMinor).toBe(0);
  });

  it("unwinds future money to satisfy a lifestyle floor", () => {
    const plan = calculateMonthPlan(pkrInput({
      preferences: {
        ...pkrSalariedProfile.preferences,
        buffer: { kind: "percent_of_income", value: 40 }, // huge buffer first
      },
      policy: { enforceLifestyleFloor: true, lifestyleFloorMinor: 1_000_000 }, // Rs 10,000 minimum life spending
    }));
    // Without the floor, flexible would be ~0; the unwind must reclaim future money.
    expect(plan.totals.flexible.amountMinor).toBe(1_000_000);
    expect(plan.warnings.some((w) => w.code === "income_below_minimum_lifestyle")).toBe(false);
  });

  it("caps emergency contributions at the policy percent of income", () => {
    const plan = calculateMonthPlan(pkrInput({
      emergency: { currentAmountMinor: 0, targetAmountMinor: 100_000_000 },
      policy: { emergencyMaxPercentOfIncome: 5 },
    }));
    expect(plan.allocations.emergency.amountMinor).toBe(900_000); // 5% of 18,000,000
  });
});

describe("monthlyEquivalent", () => {
  it("normalizes cadences to monthly amounts", () => {
    expect(monthlyEquivalent(1_000, "monthly")).toBe(1_000);
    expect(monthlyEquivalent(1_000, "weekly")).toBe(4_333); // 52/12
    expect(monthlyEquivalent(120_000, "annual")).toBe(10_000);
  });
});
