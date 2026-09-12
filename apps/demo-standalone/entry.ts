/**
 * Browser bundle entry — exposes the REAL deterministic finance engine
 * (packages/domain + packages/finance-engine) as window.SAIEngine so the
 * standalone demo runs entirely in the browser with no server.
 */
export * from "@salary-ai/domain";
export {
  calculateMonthPlan,
  calculateSafeToSpend,
  detectBudgetVariance,
  calculateEmergencyFundStatus,
  projectGoal,
  forecastRecurringCosts,
  learnCategoryWeights,
  monthlyEquivalent,
  requiredMonthlyPaceMinor,
} from "@salary-ai/finance-engine";
export {
  addPeriods,
  daysInMonth,
  daysRemainingInPeriod,
  periodOf,
} from "@salary-ai/finance-engine";
