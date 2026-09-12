/**
 * detectBudgetVariance — planned vs actual per flexible category.
 *
 * Status thresholds are policy (documented defaults) so the product can tune
 * sensitivity without touching the calculation itself:
 *   percentUsed > overThreshold (default 100)          → "over"
 *   percentUsed > atRiskThreshold (default 85)         → "at_risk"
 *   percentUsed < underThreshold (default 50)          → "under"
 *   else                                               → "on_track"
 */
import {
  FINANCE_ENGINE_VERSION,
  type BudgetVarianceLine,
  type BudgetVarianceResult,
  type PlanPeriod,
  type Transaction,
  money,
  sub,
} from "./deps.js";
import { periodOf } from "./period.js";

export interface VariancePolicy {
  atRiskThresholdPercent: number;
  overThresholdPercent: number;
  underThresholdPercent: number;
}

export const DEFAULT_VARIANCE_POLICY: VariancePolicy = {
  atRiskThresholdPercent: 85,
  overThresholdPercent: 100,
  underThresholdPercent: 50,
};

export interface VarianceInput {
  period: PlanPeriod;
  currency: string;
  /** Planned flexible allocations (from the approved plan when one exists). */
  planned: ReadonlyArray<{ categoryId: string; name: string; plannedMinor: number }>;
  transactions: readonly Transaction[];
  policy?: Partial<VariancePolicy>;
}

export function detectBudgetVariance(input: VarianceInput): BudgetVarianceResult {
  const policy = { ...DEFAULT_VARIANCE_POLICY, ...input.policy };
  const cur = input.currency;
  const actualByCategory = new Map<string, number>();
  for (const t of input.transactions) {
    if (!t.categoryId) continue;
    const p = periodOf(t.date);
    if (p.year !== input.period.year || p.month !== input.period.month) continue;
    actualByCategory.set(t.categoryId, (actualByCategory.get(t.categoryId) ?? 0) + Math.abs(t.amount.amountMinor));
  }

  const lines: BudgetVarianceLine[] = input.planned.map((row) => {
    const planned = money(Math.max(0, row.plannedMinor), cur);
    const actual = money(actualByCategory.get(row.categoryId) ?? 0, cur);
    const percentUsed = planned.amountMinor === 0
      ? actual.amountMinor > 0
        ? Number.POSITIVE_INFINITY
        : 0
      : (actual.amountMinor / planned.amountMinor) * 100;
    const status: BudgetVarianceLine["status"] =
      percentUsed > policy.overThresholdPercent
        ? "over"
        : percentUsed > policy.atRiskThresholdPercent
          ? "at_risk"
          : percentUsed < policy.underThresholdPercent
            ? "under"
            : "on_track";
    return {
      categoryId: row.categoryId,
      name: row.name,
      planned,
      actual,
      delta: sub(planned, actual),
      percentUsed: Number.isFinite(percentUsed) ? Math.round(percentUsed * 10) / 10 : percentUsed,
      status,
    };
  });

  const totalPlanned = input.planned.reduce(
    (acc, r) => (acc = addMinor(acc, Math.max(0, r.plannedMinor))),
    0,
  );
  const totalActual = lines.reduce((acc, l) => acc + l.actual.amountMinor, 0);

  return {
    period: input.period,
    currency: cur,
    lines,
    totalPlanned: money(totalPlanned, cur),
    totalActual: money(totalActual, cur),
    calculationVersion: FINANCE_ENGINE_VERSION,
  };
}

function addMinor(acc: number, minor: number): number {
  return acc + minor;
}


