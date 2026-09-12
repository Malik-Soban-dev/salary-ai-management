/**
 * Calendar-period helpers.
 *
 * The engine is pure: the current date is always an explicit argument, never a
 * hidden clock. Periods are identified by {year, month}; day math is done on
 * plain dates. Timezone conversion happens at the service boundary (users have
 * a timezone setting); the engine works in "user-local calendar dates".
 */
import type { ISODate, PlanPeriod } from "@salary-ai/domain";

export function daysInMonth(period: PlanPeriod): number {
  return new Date(Date.UTC(period.year, period.month, 0)).getUTCDate();
}

/** Parses YYYY-MM-DD into UTC-anchored date parts. */
export function parseISODate(date: ISODate): { year: number; month: number; day: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new RangeError(`Invalid ISODate: ${date}`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export function toISODate(year: number, month: number, day: number): ISODate {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function periodOf(date: ISODate): PlanPeriod {
  const { year, month } = parseISODate(date);
  return { year, month };
}

/** Whole days remaining in the period including `today`. */
export function daysRemainingInPeriod(today: ISODate, period: PlanPeriod): number {
  const p = parseISODate(today);
  if (p.year !== period.year || p.month !== period.month) return 0;
  return daysInMonth(period) - p.day + 1;
}

export function comparePeriods(a: PlanPeriod, b: PlanPeriod): -1 | 0 | 1 {
  const ka = a.year * 12 + a.month;
  const kb = b.year * 12 + b.month;
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

export function addPeriods(p: PlanPeriod, months: number): PlanPeriod {
  const total = p.year * 12 + (p.month - 1) + months;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

/** Whole months between two periods (positive if target is in the future). */
export function monthsBetween(from: PlanPeriod, to: PlanPeriod): number {
  return to.year * 12 + to.month - (from.year * 12 + from.month);
}

/** 1-based index of the month (1 = January). */
export function monthIndex(p: PlanPeriod): number {
  return p.month;
}

/**
 * Fraction (0..1] of the period elapsed BEFORE the given day, used to derive a
 * prorated expected pace. Day 1 → ~0, last day → ~1.
 */
export function elapsedFraction(today: ISODate, period: PlanPeriod): number {
  const p = parseISODate(today);
  if (p.year !== period.year || p.month !== period.month) return 1;
  const total = daysInMonth(period);
  return (p.day - 1) / total;
}
