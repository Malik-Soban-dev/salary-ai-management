/**
 * Learning loop — from observed behavior to the next plan (00_HANDOFF §1.5-6).
 *
 * Deterministic, evidence-gated, gradual (01_PRD rule 6: "Budget suggestions
 * should adapt gradually to avoid wild swings from one unusual month"):
 *
 *   observed share_i = actual spending in category i / total observed flexible spend
 *   new weight_i     = (1 − damping) · old share_i + damping · observed share_i,
 *                      rescaled to the original weight sum, with a floor
 *
 * Below the evidence threshold nothing changes — one unusual month never
 * rewrites the plan. Material moves are flagged so the UI can always answer
 * "why did my plan change?" (01_PRD rule 5).
 */
import type { PlanAdaptation, PlanPeriod, SpendingCategory, Transaction } from "./deps.js";
import { periodOf } from "./period.js";

export interface LearningPolicy {
  /** 0..1 — how fast weights move toward observed behavior per month. */
  damping: number;
  /** Minimum adjusted weight, expressed as a fraction of the mean original weight. */
  minWeightFractionOfMean: number;
  /** Categorized transactions required in the period before any adaptation. */
  minTransactions: number;
  /** Weight change ≥ this relative fraction is flagged as material. */
  materialChangePercent: number;
}

export const DEFAULT_LEARNING_POLICY: LearningPolicy = {
  damping: 0.3,
  minWeightFractionOfMean: 0.25,
  minTransactions: 4,
  materialChangePercent: 0.25,
};

export interface LearningInput {
  period: PlanPeriod;
  /** Flexible categories with their current (planned) weights. */
  categories: readonly Pick<SpendingCategory, "id" | "name" | "baselineWeight">[];
  /** Planned flexible totals per category, for comparing planned vs observed shares. */
  plannedMinor: ReadonlyArray<{ categoryId: string; plannedMinor: number }>;
  transactions: readonly Transaction[];
  policy?: Partial<LearningPolicy>;
}

export interface LearningResult {
  /** Weight proposals keyed by categoryId; only categories that changed are included. */
  weights: Record<string, number>;
  changes: PlanAdaptation[];
  evidence: {
    transactionsInPeriod: number;
    categorizedInPeriod: number;
    observedFlexibleMinor: number;
    sufficient: boolean;
  };
}

/** Rounds to 2 decimals without float drift issues at this magnitude. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function learnCategoryWeights(input: LearningInput): LearningResult {
  const policy = { ...DEFAULT_LEARNING_POLICY, ...input.policy };
  const inPeriod = input.transactions.filter((t) => {
    const p = periodOf(t.date);
    return p.year === input.period.year && p.month === input.period.month;
  });

  const actualByCategory = new Map<string, number>();
  let observedTotal = 0;
  let categorized = 0;
  for (const t of inPeriod) {
    if (!t.categoryId) continue;
    if (!input.categories.some((c) => c.id === t.categoryId)) continue;
    const spend = Math.abs(t.amount.amountMinor);
    actualByCategory.set(t.categoryId, (actualByCategory.get(t.categoryId) ?? 0) + spend);
    observedTotal += spend;
    categorized += 1;
  }

  const evidence = {
    transactionsInPeriod: inPeriod.length,
    categorizedInPeriod: categorized,
    observedFlexibleMinor: observedTotal,
    sufficient: categorized >= policy.minTransactions && observedTotal > 0,
  };

  const weights: Record<string, number> = {};
  const changes: PlanAdaptation[] = [];
  if (!evidence.sufficient || input.categories.length === 0) {
    return { weights, changes, evidence };
  }

  const oldSum = input.categories.reduce((a, c) => a + c.baselineWeight, 0);
  const meanOld = oldSum / input.categories.length;
  const floor = policy.minWeightFractionOfMean * meanOld;
  const plannedTotal = input.plannedMinor.reduce((a, p) => a + Math.max(0, p.plannedMinor), 0);

  for (const c of input.categories) {
    const old = c.baselineWeight;
    const oldShare = oldSum > 0 ? old / oldSum : 1 / input.categories.length;
    const observedShare = observedTotal > 0 ? (actualByCategory.get(c.id) ?? 0) / observedTotal : 0;
    const blendedShare = (1 - policy.damping) * oldShare + policy.damping * observedShare;
    let next = Math.max(floor, round2(blendedShare * oldSum));

    const plannedShare =
      plannedTotal > 0
        ? (input.plannedMinor.find((p) => p.categoryId === c.id)?.plannedMinor ?? 0) / plannedTotal
        : oldShare;
    const observedPercent = Math.round(observedShare * 100);
    const plannedPercent = Math.round(plannedShare * 100);

    if (next !== old) {
      const relativeChange = old > 0 ? Math.abs(next - old) / old : 1;
      const direction = next > old ? "up" : "down";
      changes.push({
        categoryId: c.id,
        name: c.name,
        fromWeight: old,
        toWeight: next,
        reason: `Observed ${observedPercent}% of flexible spend vs ${plannedPercent}% planned share — weight adjusted ${direction} from ${old} to ${next}.`,
        material: relativeChange >= policy.materialChangePercent,
      });
      weights[c.id] = next;
    }
  }

  return { weights, changes, evidence };
}
