/**
 * Plan service — orchestrates the deterministic engine around the user's profile.
 * No financial rule lives here; it only maps profile → engine input → persisted plan.
 */
import { randomUUID } from "node:crypto";
import { moneyFromMajor } from "@salary-ai/domain";
import type { MonthlyPlan, PlanPeriod, FinancialProfile } from "@salary-ai/domain";
import { calculateMonthPlan, calculateSafeToSpend, periodOf } from "@salary-ai/finance-engine";
import { store } from "../store.js";

export function currentPeriod(today: string): PlanPeriod {
  return periodOf(today);
}

export function generatePlan(profile: FinancialProfile, today: string): MonthlyPlan {
  const period = currentPeriod(today);
  const plan = calculateMonthPlan({
    period,
    currency: profile.currency,
    incomeSources: profile.incomeSources,
    commitments: profile.commitments,
    categories: profile.categories,
    emergency: {
      currentAmountMinor: profile.emergency.currentAmountMinor,
      targetAmountMinor: profile.emergency.targetAmountMinor,
    },
    preferences: profile.preferences,
    goals: profile.goals,
    planId: randomUUID(),
    userId: profile.userId,
    createdAt: new Date().toISOString(),
  });
  store.plansOf(profile.userId).push(plan);
  return plan;
}

export function approvePlan(userId: string, planId: string): MonthlyPlan | undefined {
  const plan = store.plansOf(userId).find((p) => p.id === planId);
  if (!plan) return undefined;
  // Explicit state machine: draft → approved; previous approved plan in the same
  // period is superseded so exactly one plan governs a period.
  for (const p of store.plansOf(userId)) {
    if (p.period.year === plan.period.year && p.period.month === plan.period.month && p.status === "approved") {
      p.status = "superseded";
    }
  }
  plan.status = "approved";
  plan.approvedAt = new Date().toISOString();
  return plan;
}

/**
 * Essential obligations for the period that are still upcoming (due today or
 * later). Assumption (documented in docs/runbooks/planning.md): due-date-based;
 * paid/unpaid reconciliation arrives with import idempotency work.
 */
export function upcomingObligations(profile: FinancialProfile, today: string, period: PlanPeriod) {
  const dayOfMonth = Number(today.slice(8, 10));
  return profile.commitments
    .filter((c) => c.essential)
    .filter((c) => c.cadence === "monthly" || c.cadence === "annual" || c.cadence === "weekly")
    .map((c) => {
      const monthly =
        c.cadence === "monthly" ? c.expectedAmountMinor
        : c.cadence === "weekly" ? Math.floor((c.expectedAmountMinor * 52) / 12)
        : Math.floor(c.expectedAmountMinor / 12);
      return {
        recurringItemId: c.id,
        name: c.name,
        amountMinor: monthly,
        dueDay: c.dueDay,
        upcoming: c.dueDay == null ? true : c.dueDay >= dayOfMonth,
      };
    })
    .filter((o) => o.upcoming);
}

export function safeToSpend(profile: FinancialProfile, today: string) {
  const period = currentPeriod(today);
  const plan = store.currentPlan(profile.userId, period);
  if (!plan || plan.status !== "approved") {
    return { plan: undefined, safeToSpend: undefined };
  }
  const result = calculateSafeToSpend({
    today,
    period,
    currency: profile.currency,
    flexibleBudget: plan.allocations.flexible.map((f) => ({
      categoryId: f.categoryId,
      plannedMinor: f.planned.amountMinor,
    })),
    transactions: store.transactionsOf(profile.userId),
    upcomingObligations: upcomingObligations(profile, today, period).map((o) => ({
      recurringItemId: o.recurringItemId,
      amountMinor: o.amountMinor,
      dueDay: o.dueDay,
    })),
  });
  return { plan, safeToSpend: result };
}

/** API input (major units) → profile mutation. Original values are preserved per entity. */
export function applyProfileUpdate(
  profile: FinancialProfile,
  update: {
    incomeSources?: Array<{
      id?: string; name: string; expectedAmount: number;
      frequency: "monthly" | "biweekly" | "weekly"; paydayDay?: number;
      reliability: "stable" | "variable";
    }>;
    commitments?: Array<{
      id?: string; name: string; expectedAmount: number; essential: boolean;
      cadence: "monthly" | "weekly" | "annual"; dueDay?: number;
      rangeLow?: number; rangeHigh?: number;
    }>;
    categories?: Array<{ id?: string; name: string; baselineWeight: number; floor?: number }>;
    emergency?: { currentAmount: number; targetAmount: number };
    preferences?: Partial<FinancialProfile["preferences"]>;
  },
  now: string,
): void {
  const cur = profile.currency;
  if (update.incomeSources) {
    profile.incomeSources = update.incomeSources.map((s) => ({
      id: s.id ?? randomUUID(),
      name: s.name,
      expectedAmountMinor: moneyFromMajor(s.expectedAmount, cur).amountMinor,
      currency: cur,
      frequency: s.frequency,
      paydayRule: { kind: "day_of_month", day: s.paydayDay ?? 1 } as const,
      reliability: s.reliability,
    }));
  }
  if (update.commitments) {
    profile.commitments = update.commitments.map((c) => ({
      id: c.id ?? randomUUID(),
      name: c.name,
      essential: c.essential,
      expectedAmountMinor: moneyFromMajor(c.expectedAmount, cur).amountMinor,
      rangeMinor:
        c.rangeLow != null && c.rangeHigh != null
          ? {
              low: moneyFromMajor(c.rangeLow, cur).amountMinor,
              high: moneyFromMajor(c.rangeHigh, cur).amountMinor,
            }
          : undefined,
      cadence: c.cadence,
      dueDay: c.dueDay,
      confidence: 1,
      source: "user",
    }));
  }
  if (update.categories) {
    profile.categories = update.categories.map((c) => ({
      id: c.id ?? randomUUID(),
      name: c.name,
      kind: "flexible" as const,
      baselineWeight: c.baselineWeight,
      floorMinor: c.floor != null ? moneyFromMajor(c.floor, cur).amountMinor : undefined,
    }));
  }
  if (update.emergency) {
    profile.emergency = {
      currentAmountMinor: moneyFromMajor(update.emergency.currentAmount, cur).amountMinor,
      targetAmountMinor: moneyFromMajor(update.emergency.targetAmount, cur).amountMinor,
    };
  }
  if (update.preferences) {
    profile.preferences = { ...profile.preferences, ...update.preferences };
  }
  profile.updatedAt = now;
}
