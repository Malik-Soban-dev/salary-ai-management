/**
 * Currency metadata.
 *
 * World-neutral principle (00_MASTER_HANDOFF §2A): no currency or country is the
 * product default. Currency is user configuration; formatting adapts via locale.
 * Minor-unit digits follow ISO 4217 so money is always stored as integers.
 */

export type CurrencyCode = string; // ISO 4217 alpha-3, e.g. "PKR", "USD", "JPY"

export interface CurrencyInfo {
  readonly code: CurrencyCode;
  /** Digits after the decimal point per ISO 4217 (JPY=0, USD=2, KWD=3). */
  readonly minorUnits: number;
  /** Symbol or short label used in compact UI display; locale-aware formatting happens in the client. */
  readonly symbol: string;
}

/** A pragmatic subset. Unknown codes fall back to 2 minor units with a warning path in `getCurrencyInfo`. */
const CURRENCIES: Readonly<Record<string, CurrencyInfo>> = {
  PKR: { code: "PKR", minorUnits: 2, symbol: "Rs" },
  USD: { code: "USD", minorUnits: 2, symbol: "$" },
  EUR: { code: "EUR", minorUnits: 2, symbol: "€" },
  GBP: { code: "GBP", minorUnits: 2, symbol: "£" },
  INR: { code: "INR", minorUnits: 2, symbol: "₹" },
  AED: { code: "AED", minorUnits: 2, symbol: "AED" },
  SAR: { code: "SAR", minorUnits: 2, symbol: "SAR" },
  JPY: { code: "JPY", minorUnits: 0, symbol: "¥" },
  KWD: { code: "KWD", minorUnits: 3, symbol: "KD" },
  BDT: { code: "BDT", minorUnits: 2, symbol: "Tk" },
  NGN: { code: "NGN", minorUnits: 2, symbol: "₦" },
  ZAR: { code: "ZAR", minorUnits: 2, symbol: "R" },
  CAD: { code: "CAD", minorUnits: 2, symbol: "C$" },
  AUD: { code: "AUD", minorUnits: 2, symbol: "A$" },
  TRY: { code: "TRY", minorUnits: 2, symbol: "₺" },
  BRL: { code: "BRL", minorUnits: 2, symbol: "R$" },
};

export const DEFAULT_CURRENCY_INFO: CurrencyInfo = {
  code: "XXX",
  minorUnits: 2,
  symbol: "",
};

export function getCurrencyInfo(code: CurrencyCode): CurrencyInfo {
  return CURRENCIES[code] ?? { ...DEFAULT_CURRENCY_INFO, code };
}

export function isKnownCurrency(code: CurrencyCode): boolean {
  return Object.prototype.hasOwnProperty.call(CURRENCIES, code);
}

/** Normalizes user-entered currency codes ("pkr" → "PKR"). */
export function normalizeCurrencyCode(input: string): CurrencyCode {
  return input.trim().toUpperCase();
}
