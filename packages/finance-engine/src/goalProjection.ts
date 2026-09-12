/**
 * projectGoal — required pace and projected completion for a goal.
 */
import {
  FINANCE_ENGINE_VERSION,
  type GoalProjection,
  type PlanPeriod,
} from "./deps.js";
import { addPeriods, monthsBetween } from "./period.js";

export interface GoalProjectionInput {
  goal: {
    id: string;
    targetAmountMinor: number;
    savedAmountMinor: number;
    targetDate?: string; // YYYY-MM
    priority: number;
  };
  period: PlanPeriod;
  /** Planned monthly contribution (0 when none planned). */
  plannedMonthlyContributionMinor: number;
}

export function projectGoal(input: GoalProjectionInput): GoalProjection {
  const remaining = Math.max(0, input.goal.targetAmountMinor - input.goal.savedAmountMinor);
  const hasDeadline = input.goal.targetDate != null;
  const [y, m] = (input.goal.targetDate ?? "").split("-").map(Number) as [number, number?];
  const deadlinePeriod = hasDeadline ? { year: y, month: m ?? 1 } : undefined;
  const monthsRemaining = deadlinePeriod
    ? Math.max(0, monthsBetween(input.period, deadlinePeriod) + 1)
    : Number.POSITIVE_INFINITY;

  const requiredMonthlyPaceMinor = deadlinePeriod
    ? monthsRemaining <= 0
      ? remaining
      : Math.ceil(remaining / monthsRemaining)
    : 0;

  let projectedCompletion: PlanPeriod | undefined;
  if (remaining === 0) {
    projectedCompletion = input.period;
  } else if (input.plannedMonthlyContributionMinor > 0) {
    const monthsNeeded = Math.ceil(remaining / input.plannedMonthlyContributionMinor);
    projectedCompletion = addPeriods(input.period, monthsNeeded - 1);
  }

  const onTrack = remaining === 0
    ? true
    : !deadlinePeriod
      ? input.plannedMonthlyContributionMinor > 0
      : input.plannedMonthlyContributionMinor >= requiredMonthlyPaceMinor;

  return {
    goalId: input.goal.id,
    requiredMonthlyPaceMinor,
    monthsRemaining: deadlinePeriod ? monthsRemaining : null,
    projectedCompletion,
    onTrack,
    calculationVersion: FINANCE_ENGINE_VERSION,
  };
}
