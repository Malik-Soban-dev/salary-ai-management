/**
 * Money — integer minor units only.
 *
 * Architecture rule (04_TECHNICAL_ARCHITECTURE §5):
 * "Use integer minor units or fixed-precision numeric for money; never binary
 * floating point for persisted money calculations."
 *
 * All engine arithmetic goes through this module so the rule is enforceable in
 * one place. Amounts are signed integers of `currency` minor units.
 */
import { getCurrencyInfo, type CurrencyCode } from "./currency.js";

export interface Money {
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
}

export class CurrencyMismatchError extends Error {
  constructor(a: CurrencyCode, b: CurrencyCode) {
    super(`Currency mismatch: ${a} vs ${b}`);
    this.name = "CurrencyMismatchError";
  }
}

export function money(amountMinor: number, currency: CurrencyCode): Money {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new RangeError(`Money must be a safe integer in minor units, got ${amountMinor}`);
  }
  return { amountMinor, currency };
}

/** Converts a user-entered major amount (e.g. 1250.50) to minor units with half-up rounding. */
export function moneyFromMajor(major: number, currency: CurrencyCode): Money {
  const { minorUnits } = getCurrencyInfo(currency);
  const scaled = Math.round(major * 10 ** minorUnits);
  return money(scaled, currency);
}

export function toMajor(m: Money): number {
  const { minorUnits } = getCurrencyInfo(m.currency);
  return m.amountMinor / 10 ** minorUnits;
}

export function zero(currency: CurrencyCode): Money {
  return { amountMinor: 0, currency };
}

function assertSame(a: Money, b: Money): void {
  if (a.currency !== b.currency) throw new CurrencyMismatchError(a.currency, b.currency);
}

export function add(a: Money, b: Money): Money {
  assertSame(a, b);
  return { amountMinor: a.amountMinor + b.amountMinor, currency: a.currency };
}

export function sub(a: Money, b: Money): Money {
  assertSame(a, b);
  return { amountMinor: a.amountMinor - b.amountMinor, currency: a.currency };
}

export function isNegative(m: Money): boolean {
  return m.amountMinor < 0;
}

export function cmp(a: Money, b: Money): -1 | 0 | 1 {
  assertSame(a, b);
  return a.amountMinor < b.amountMinor ? -1 : a.amountMinor > b.amountMinor ? 1 : 0;
}

export function min(a: Money, b: Money): Money {
  return cmp(a, b) <= 0 ? a : b;
}

export function max(a: Money, b: Money): Money {
  return cmp(a, b) >= 0 ? a : b;
}

export function sum(amounts: readonly Money[], currency: CurrencyCode): Money {
  return amounts.reduce<Money>(
    (acc, m) => add(acc, m),
    zero(currency),
  );
}

/** Scales by a non-negative rational factor (num/den) with floor rounding. */
export function scaleFloor(m: Money, num: number, den: number = 1): Money {
  if (den === 0) throw new RangeError("scale denominator must not be 0");
  return { amountMinor: Math.floor((m.amountMinor * num) / den), currency: m.currency };
}

/**
 * Splits `total` into `weights.length` parts proportional to `weights`, using the
 * largest-remainder method. Deterministic, sum-preserving, and tie-broken by
 * input order so the same inputs always produce the same plan.
 */
export function allocateByWeights(total: Money, weights: readonly number[]): Money[] {
  const n = weights.length;
  if (n === 0) return [];
  if (weights.some((w) => w < 0 || !Number.isFinite(w))) {
    throw new RangeError("weights must be finite and non-negative");
  }
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum === 0) {
    // No signal: distribute evenly (largest remainder with equal weights).
    return allocateByWeights(total, new Array(n).fill(1));
  }
  const exact = weights.map((w) => (total.amountMinor * w) / weightSum);
  const floors = exact.map((v) => Math.floor(v));
  let remainder = total.amountMinor - floors.reduce((a, b) => a + b, 0);
  // Order by largest fractional part; input order breaks ties.
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  const result = floors.slice();
  for (const { i } of order) {
    if (remainder <= 0) break;
    result[i]! += 1;
    remainder -= 1;
  }
  return result.map((amountMinor) => ({ amountMinor, currency: total.currency }));
}

/** Compact human format, e.g. "Rs 1,250.50". Locale-aware Intl formatting stays a client concern. */
export function formatMoney(m: Money): string {
  const { symbol, minorUnits } = getCurrencyInfo(m.currency);
  const abs = Math.abs(m.amountMinor) / 10 ** minorUnits;
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: minorUnits,
    maximumFractionDigits: minorUnits,
  });
  const sign = m.amountMinor < 0 ? "-" : "";
  return `${sign}${symbol ? symbol + " " : ""}${formatted}`;
}
