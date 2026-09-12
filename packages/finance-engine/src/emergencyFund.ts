/**
 * calculateEmergencyFundStatus — safety-net progress in months of essentials covered.
 */
import {
  FINANCE_ENGINE_VERSION,
  type EmergencyFundStatus,
  money,
} from "./deps.js";

export interface EmergencyInput {
  currency: string;
  currentAmountMinor: number;
  targetAmountMinor: number;
  /** This month's planned contribution (from the plan when available). */
  monthlyContributionMinor: number;
  /** Average monthly essential cost estimate (obligations + typical flexible). */
  averageMonthlyEssentialsMinor: number;
}

export function calculateEmergencyFundStatus(input: EmergencyInput): EmergencyFundStatus {
  const cur = input.currency;
  const current = money(input.currentAmountMinor, cur);
  const target = money(Math.max(0, input.targetAmountMinor), cur);
  const progressPercent =
    target.amountMinor === 0 ? 0 : Math.min(100, (current.amountMinor / target.amountMinor) * 100);
  const essentials = Math.max(1, input.averageMonthlyEssentialsMinor);
  return {
    currency: cur,
    current,
    target,
    progressPercent: Math.round(progressPercent * 10) / 10,
    essentialsCoverageMonths: Math.round((current.amountMinor / essentials) * 10) / 10,
    monthlyContribution: money(Math.max(0, input.monthlyContributionMinor), cur),
    calculationVersion: FINANCE_ENGINE_VERSION,
  };
}

