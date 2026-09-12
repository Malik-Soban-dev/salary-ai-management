/**
 * Month-end learning + rollover orchestration.
 *
 * The engine proposes (learnCategoryWeights); this service applies proposals to
 * the profile with an audit trail and generates the next month's plan carrying
 * `adaptations` provenance — so the UI can always explain what changed and why
 * (01_PRD rules 5–6).
 */
import { addPeriods, detectBudgetVariance, learnCategoryWeights, periodOf } from "@salary-ai/finance-engine";
import type { PlanAdaptation, PlanPeriod } from "@salary-ai/domain";
import { store, type FinancialProfile } from "../store.js";
import { generatePlan } from "./planService.js";
import { audit } from "../audit.js";

export interface MonthEndPreview {
  ready: boolean;
  reason?: string;
  period: PlanPeriod;
  nextPeriod: PlanPeriod;
  evidence: { transactionsInPeriod: number; categorizedInPeriod: number; observedFlexibleMinor: number; sufficient: boolean };
  proposals: PlanAdaptation[];
  summary: {
    totalPlannedMinor: number | null;
    totalActualMinor: number | null;
    topOver: Array<{ name: string; percentUsed: number }>;
    emergencyContributionMinor: number | null;
  };
}

export function monthEndPreview(profile: FinancialProfile, today: string): MonthEndPreview {
  const period = periodOf(today);
  const nextPeriod = addPeriods(period, 1);
  const plan = store.currentPlan(profile.userId, period);

  const weightOf = (categoryId: string, fallback: number) =>
    profile.categories.find((c) => c.id === categoryId)?.baselineWeight ?? fallback;

  const learning = plan
    ? learnCategoryWeights({
        period,
        categories: plan.allocations.flexible.map((f) => ({
          id: f.categoryId,
          name: f.name,
          baselineWeight: weightOf(f.categoryId, f.weight),
        })),
        plannedMinor: plan.allocations.flexible.map((f) => ({
          categoryId: f.categoryId,
          plannedMinor: f.planned.amountMinor,
        })),
        transactions: store.transactionsOf(profile.userId),
      })
    : undefined;

  const transactions = store.transactionsOf(profile.userId);
  const variance = plan
    ? detectBudgetVariance({
        period,
        currency: profile.currency,
        planned: plan.allocations.flexible.map((f) => ({
          categoryId: f.categoryId,
          name: f.name,
          plannedMinor: f.planned.amountMinor,
        })),
        transactions,
      })
    : undefined;

  const ready = learning?.evidence.sufficient === true;
  return {
    ready,
    reason: ready
      ? undefined
      : plan
        ? `Not enough evidence yet — ${learning?.evidence.categorizedInPeriod ?? 0} categorized transactions this month (need 4+). Keep recording spending; the plan adapts when the signal is real.`
        : "Approve this month's plan first — learning compares your actual behavior against it.",
    period,
    nextPeriod,
    evidence: learning?.evidence ?? { transactionsInPeriod: 0, categorizedInPeriod: 0, observedFlexibleMinor: 0, sufficient: false },
    proposals: learning?.changes ?? [],
    summary: {
      totalPlannedMinor: variance?.totalPlanned.amountMinor ?? null,
      totalActualMinor: variance?.totalActual.amountMinor ?? null,
      topOver: (variance?.lines ?? [])
        .filter((l) => l.status === "over" || l.status === "at_risk")
        .sort((a, b) => b.percentUsed - a.percentUsed)
        .slice(0, 3)
        .map((l) => ({ name: l.name, percentUsed: l.percentUsed })),
      emergencyContributionMinor: plan?.allocations.emergency.amountMinor ?? null,
    },
  };
}

export interface RolloverResult {
  plan: ReturnType<typeof generatePlan>;
  applied: boolean;
  changes: PlanAdaptation[];
  preview: MonthEndPreview;
}

/** Applies learning (when evidence is sufficient) and generates the next month's draft plan. */
export function rolloverToNextPeriod(
  profile: FinancialProfile,
  today: string,
  targetPeriod?: PlanPeriod,
): RolloverResult {
  const preview = monthEndPreview(profile, today);
  const changes = preview.proposals;

  if (preview.ready && changes.length > 0) {
    for (const category of profile.categories) {
      const next = changes.find((c) => c.categoryId === category.id);
      if (next) category.baselineWeight = next.toWeight;
    }
    profile.updatedAt = new Date().toISOString();
    audit(profile.userId, "profile.learning_applied", {
      changes: changes.map((c) => ({ categoryId: c.categoryId, from: c.fromWeight, to: c.toWeight, material: c.material })),
    });
  }

  const plan = generatePlan(profile, today, targetPeriod ?? preview.nextPeriod);
  plan.adaptations = preview.ready ? changes : [];
  audit(profile.userId, "plan.rollover", { planId: plan.id, period: plan.period, applied: preview.ready });

  return { plan, applied: preview.ready, changes, preview };
}
