import type { Money } from "./api";

const SYM: Record<string, string> = { PKR: "Rs", USD: "$", EUR: "€", GBP: "£", INR: "₹", AED: "AED", SAR: "SAR", JPY: "¥", CAD: "C$", AUD: "A$" };
const DIGITS: Record<string, number> = { JPY: 0 };

export function fmt(m: Money): string;
export function fmt(minor: number, currency: string): string;
export function fmt(a: Money | number, b?: string): string {
  const minor = typeof a === "number" ? a : a.amountMinor;
  const currency = typeof a === "number" ? (b as string) : a.currency;
  const d = DIGITS[currency] ?? 2;
  const n = (Math.abs(minor) / 10 ** d).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  return `${minor < 0 ? "−" : ""}${SYM[currency] ?? currency} ${n}`;
}

export function monthName(p: { year: number; month: number }): string {
  return new Date(p.year, p.month - 1, 1).toLocaleString("en", { month: "long", year: "numeric" });
}

export const colors = {
  bg: "#0e1116", surface: "#161b23", surface2: "#1d242e", border: "#2a3340",
  text: "#e8edf4", dim: "#94a3b8", accent: "#4ade80", amber: "#fbbf24", red: "#f87171", blue: "#60a5fa",
};
