/**
 * calculateSafeToSpend — the key daily decision number.
 *
 * Definition (documented default, configurable at the service layer):
 *   flexible remaining   = approved flexible budget − flexible spending so far
 *   reserved             = unpaid essential obligations due later this period
 *   available now        = max(0, flexible remaining − reserved)
 *   daily recommended    = floor(available now / days remaining incl. today)
 *
 * Protected money (obligations, emergency, goals, buffer) is never counted as
 * spendable. If the user already overspent flexible money, availableNow is 0
 * and the overspend is surfaced honestly.
 */
import {
  FINANCE_ENGINE_VERSION,
  type CurrencyCode,
  type PlanPeriod,
  type SafeToSpendBreakdown,
  type SafeToSpendResult,
  type Transaction,
  max,
  money,
  scaleFloor,
  sub,
  zero,
} from "./deps.js";
import { daysRemainingInPeriod, periodOf } from "./period.js";

export interface SafeToSpendInput {
  today: string; // ISODate
  period: PlanPeriod;
  currency: CurrencyCode;
  /** Approved plan's flexible allocations. */
  flexibleBudget: ReadonlyArray<{ categoryId: string; plannedMinor: number }>;
  /** Committed transactions dated within the period. */
  transactions: readonly Transaction[];
  /** Essential obligations for the period not yet paid. */
  upcomingObligations: ReadonlyArray<{ recurringItemId: string; amountMinor: number; dueDay?: number }>;
}

export function calculateSafeToSpend(input: SafeToSpendInput): SafeToSpendResult {
  const cur = input.currency;
  const flexBudgetTotal = input.flexibleBudget.reduce(
    (acc, b) => acc + Math.max(0, b.plannedMinor),
    0,
  );

  const inPeriod = input.transactions.filter((t) => samePeriod(t.date, input.period));
  const flexibleCategoryIds = new Set(input.flexibleBudget.map((b) => b.categoryId));
  const flexibleSpent = inPeriod
    .filter((t) => t.categoryId != null && flexibleCategoryIds.has(t.categoryId))
    .reduce((acc, t) => acc + Math.abs(t.amount.amountMinor), 0);

  const flexibleRemaining = flexBudgetTotal - flexibleSpent;
  const reserved = input.upcomingObligations.reduce((acc, o) => acc + Math.max(0, o.amountMinor), 0);

  const overspend = max(zero(cur), money(-flexibleRemaining, cur));
  const availableNow = max(zero(cur), money(Math.min(flexibleRemaining, flexibleRemaining - reserved), cur));
  const daysRemaining = Math.max(1, daysRemainingInPeriod(input.today, input.period));
  const dailyRecommended = scaleFloor(availableNow, 1, daysRemaining);

  const breakdown: SafeToSpendBreakdown = {
    flexibleBudgetTotal: money(flexBudgetTotal, cur),
    flexibleSpent: money(flexibleSpent, cur),
    flexibleRemaining: money(Math.max(0, flexibleRemaining), cur),
    reservedForUpcomingObligations: money(reserved, cur),
    overspend,
  };

  return {
    asOf: input.today,
    period: input.period,
    currency: cur,
    availableNow,
    dailyRecommended,
    daysRemaining: daysRemainingInPeriod(input.today, input.period),
    breakdown,
    calculationVersion: FINANCE_ENGINE_VERSION,
  };
}

/** A simplified variant used before a plan is approved: expected plan, not zeros (02_UX §11). */
export function calculateExpectedDailySpend(
  today: string,
  period: PlanPeriod,
  expectedFlexibleMinor: number,
  currency: CurrencyCode,
): SafeToSpendResult {
  const cur = currency;
  const daysRemaining = Math.max(1, daysRemainingInPeriod(today, period));
  const available = money(Math.max(0, expectedFlexibleMinor), cur);
  return {
    asOf: today,
    period,
    currency: cur,
    availableNow: available,
    dailyRecommended: scaleFloor(available, 1, daysRemaining),
    daysRemaining: daysRemainingInPeriod(today, period),
    breakdown: {
      flexibleBudgetTotal: money(expectedFlexibleMinor, cur),
      flexibleSpent: zero(cur),
      flexibleRemaining: money(expectedFlexibleMinor, cur),
      reservedForUpcomingObligations: zero(cur),
      overspend: zero(cur),
    },
    calculationVersion: FINANCE_ENGINE_VERSION,
  };
}

function samePeriod(date: string, period: PlanPeriod): boolean {
  const p = periodOf(date);
  return p.year === period.year && p.month === period.month;
}


