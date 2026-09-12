/**
 * Monthly plan output types — the deterministic engine's contract.
 * Every calculation returns a version so changes are traceable (engineering rule 3).
 */
import type { CurrencyCode } from "./currency.js";
import type { Money } from "./money.js";
import type { PlanPeriod, PlanStatus } from "./entities.js";

export const FINANCE_ENGINE_VERSION = "1.0.0";

export interface ObligationAllocation {
  recurringItemId: string;
  name: string;
  amount: Money;
  dueDay?: number;
  protected: boolean;
}

export interface CategoryAllocation {
  categoryId: string;
  name: string;
  planned: Money;
  weight: number;
}

export interface GoalAllocation {
  goalId: string;
  name: string;
  priority: number;
  planned: Money;
  /** Pace required to hit the target by the deadline, minor units/month. */
  requiredMonthlyPaceMinor?: number;
  fullyFunded: boolean;
}

export interface PlanTotals {
  income: Money;
  protected: Money; // essential obligations
  flexible: Money; // life spending
  emergency: Money;
  goals: Money;
  buffer: Money;
  /** Income minus everything allocated; >= 0 by construction. */
  unallocated: Money;
}

export type PlanWarningCode =
  | "income_below_essentials"
  | "income_below_minimum_lifestyle"
  | "goal_underfunded"
  | "emergency_contribution_capped"
  | "variable_income_haircut_applied"
  | "insufficient_for_buffer";

export interface PlanWarning {
  code: PlanWarningCode;
  message: string;
  /** Related entity, e.g. a goal id. */
  refId?: string;
}

/** Behavioral adaptation applied from the learning loop when this plan was generated. */
export interface PlanAdaptation {
  categoryId: string;
  name: string;
  fromWeight: number;
  toWeight: number;
  reason: string;
  /** True when the weight moved ≥ the material-change threshold — always surfaced to the user. */
  material: boolean;
}

export interface MonthlyPlan {
  id: string;
  userId: string;
  period: PlanPeriod;
  currency: CurrencyCode;
  status: PlanStatus;
  allocations: {
    obligations: ObligationAllocation[];
    flexible: CategoryAllocation[];
    emergency: Money;
    goals: GoalAllocation[];
    buffer: Money;
  };
  totals: PlanTotals;
  warnings: PlanWarning[];
  /** Learning-loop provenance: what changed vs the previous plan and why (01_PRD rule 5). */
  adaptations?: PlanAdaptation[];
  calculationVersion: string;
  /** Hash of the exact engine inputs — reproducibility requirement (01_PRD rule 4). */
  inputsHash: string;
  createdAt: string;
  approvedAt?: string;
}

export interface SafeToSpendBreakdown {
  flexibleBudgetTotal: Money;
  flexibleSpent: Money;
  flexibleRemaining: Money;
  reservedForUpcomingObligations: Money;
  overspend: Money;
}

export interface SafeToSpendResult {
  asOf: string;
  period: PlanPeriod;
  currency: CurrencyCode;
  /** What the user can still spend this period without touching protected money. */
  availableNow: Money;
  /** availableNow spread over the remaining days of the period (floored). */
  dailyRecommended: Money;
  daysRemaining: number;
  breakdown: SafeToSpendBreakdown;
  calculationVersion: string;
}

export interface BudgetVarianceLine {
  categoryId: string;
  name: string;
  planned: Money;
  actual: Money;
  delta: Money; // planned - actual (positive = under budget)
  percentUsed: number;
  status: "under" | "on_track" | "at_risk" | "over";
}

export interface BudgetVarianceResult {
  period: PlanPeriod;
  currency: CurrencyCode;
  lines: BudgetVarianceLine[];
  totalPlanned: Money;
  totalActual: Money;
  calculationVersion: string;
}

export interface EmergencyFundStatus {
  currency: CurrencyCode;
  current: Money;
  target: Money;
  progressPercent: number; // 0..100
  /** Months of average essential costs currently covered. */
  essentialsCoverageMonths: number;
  monthlyContribution: Money;
  calculationVersion: string;
}

export interface GoalProjection {
  goalId: string;
  requiredMonthlyPaceMinor: number;
  /** Whole months until the deadline (inclusive); null when the goal is open-ended. */
  monthsRemaining: number | null;
  /** Projected completion month if the user keeps the planned contribution. */
  projectedCompletion?: PlanPeriod;
  onTrack: boolean;
  calculationVersion: string;
}

export interface RecurringForecastLine {
  recurringItemId: string;
  name: string;
  expected: Money;
  range: { low: Money; high: Money };
  dueDay?: number;
  confidence: number;
}

export interface RecurringForecastResult {
  period: PlanPeriod;
  currency: CurrencyCode;
  lines: RecurringForecastLine[];
  totalExpected: Money;
  totalRange: { low: Money; high: Money };
  calculationVersion: string;
}
