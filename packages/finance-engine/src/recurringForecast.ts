/**
 * forecastRecurringCosts — expected recurring spend for a period with honest ranges.
 * Uncertain items are shown as ranges with confidence, never fake precision (02_UX §11).
 */
import {
  FINANCE_ENGINE_VERSION,
  type RecurringForecastLine,
  type RecurringForecastResult,
  type RecurringItem,
  type PlanPeriod,
  money,
} from "./deps.js";

/** Monthly-equivalent conversion, matching the planner. */
export function toMonthlyMinor(amountMinor: number, cadence: RecurringItem["cadence"]): number {
  switch (cadence) {
    case "monthly":
      return amountMinor;
    case "weekly":
      return Math.floor((amountMinor * 52) / 12);
    case "annual":
      return Math.floor(amountMinor / 12);
  }
}

export function forecastRecurringCosts(
  items: readonly RecurringItem[],
  period: PlanPeriod,
  currency: string,
): RecurringForecastResult {
  const lines: RecurringForecastLine[] = items.map((item) => {
    const expected = toMonthlyMinor(item.expectedAmountMinor, item.cadence);
    const low = item.rangeMinor ? toMonthlyMinor(item.rangeMinor.low, item.cadence) : expected;
    const high = item.rangeMinor ? toMonthlyMinor(item.rangeMinor.high, item.cadence) : expected;
    return {
      recurringItemId: item.id,
      name: item.name,
      expected: money(expected, currency),
      range: {
        low: money(Math.min(low, expected), currency),
        high: money(Math.max(high, expected), currency),
      },
      dueDay: item.dueDay,
      confidence: item.confidence,
    };
  });

  const totalExpected = lines.reduce((acc, l) => acc + l.expected.amountMinor, 0);
  const totalLow = lines.reduce((acc, l) => acc + l.range.low.amountMinor, 0);
  const totalHigh = lines.reduce((acc, l) => acc + l.range.high.amountMinor, 0);

  return {
    period,
    currency,
    lines,
    totalExpected: money(totalExpected, currency),
    totalRange: { low: money(totalLow, currency), high: money(totalHigh, currency) },
    calculationVersion: FINANCE_ENGINE_VERSION,
  };
}
