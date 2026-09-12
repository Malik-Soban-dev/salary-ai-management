/**
 * Insight service — month-end learning inputs, deterministic first.
 * The AI layer explains these structured facts; it never computes them.
 */
import type { FinancialProfile, PlanPeriod } from "@salary-ai/domain";
import {
  calculateEmergencyFundStatus,
  detectBudgetVariance,
  forecastRecurringCosts,
  periodOf,
} from "@salary-ai/finance-engine";
import { store } from "../store.js";
import { safeToSpend } from "./planService.js";

export function monthlyInsights(profile: FinancialProfile, today: string) {
  const period: PlanPeriod = periodOf(today);
  const plan = store.currentPlan(profile.userId, period);
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

  const recurring = forecastRecurringCosts(profile.commitments, period, profile.currency);

  const essentialMonthly = recurring.lines
    .filter((l) => profile.commitments.find((c) => c.id === l.recurringItemId)?.essential)
    .reduce((acc, l) => acc + l.expected.amountMinor, 0);

  const emergency = calculateEmergencyFundStatus({
    currency: profile.currency,
    currentAmountMinor: profile.emergency.currentAmountMinor,
    targetAmountMinor: profile.emergency.targetAmountMinor,
    monthlyContributionMinor: plan?.allocations.emergency.amountMinor ?? 0,
    averageMonthlyEssentialsMinor: essentialMonthly,
  });

  // Simple overspend pattern: categories over budget, largest first.
  const overspending = (variance?.lines ?? [])
    .filter((l) => l.status === "over" || l.status === "at_risk")
    .sort((a, b) => b.percentUsed - a.percentUsed);

  const { safeToSpend: sts } = safeToSpend(profile, today);

  return {
    period,
    currency: profile.currency,
    hasPlan: plan != null,
    planStatus: plan?.status,
    variance,
    emergency,
    recurring,
    overspending,
    safeToSpend: sts,
    transactionCount: transactions.filter(
      (t) => periodOf(t.date).year === period.year && periodOf(t.date).month === period.month,
    ).length,
  };
}
