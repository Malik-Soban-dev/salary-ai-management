/**
 * Ledger service — transaction capture and the deterministic text/voice parser.
 *
 * The MVP parser is rule-based (transparent, testable, zero data leaves the
 * server). The AI classifier can take over later through the same interface
 * with confidence values; corrections always win over inferences (01_PRD rule 2).
 */
import { randomUUID } from "node:crypto";
import {
  getCurrencyInfo,
  moneyFromMajor,
  type CurrencyCode,
  type Transaction,
} from "@salary-ai/domain";
import { store, type FinancialProfile } from "../store.js";

export interface ParsedDraft {
  amountMajor: number | null;
  merchantGuess: string;
  categoryId: string | null;
  date: string | null;
  confidence: number;
  notes: string[];
}

/**
 * Parses phrases like:
 *   "Spent 950 on dinner"          → 950 • dining
 *   "Aaj petrol pe 3000 kharch"    → 3000 • transport
 *   "yesterday 250 coffee"         → 250 • dining, yesterday
 * Roman Urdu keywords are part of the seed table; the table is configuration.
 */
const KEYWORD_CATEGORIES: Array<{ categoryId: string; keywords: string[] }> = [
  { categoryId: "cat-groceries", keywords: ["grocery", "groceries", "supermarket", "sabzi", "kirana"] },
  { categoryId: "cat-transport", keywords: ["petrol", "fuel", "gas", "uber", "careem", "bus", "train", "taxi", "metro"] },
  { categoryId: "cat-dining", keywords: ["dinner", "lunch", "breakfast", "coffee", "restaurant", "cafe", "chai", "food"] },
  { categoryId: "cat-shopping", keywords: ["shoes", "clothes", "shopping", "amazon", "mall", "kurta"] },
  { categoryId: "cat-health", keywords: ["pharmacy", "medicine", "doctor", "clinic", "hospital"] },
  { categoryId: "cat-fun", keywords: ["movie", "cinema", "game", "concert", "netflix"] },
];

export function parseTransactionText(text: string, today: string): ParsedDraft {
  const notes: string[] = [];
  const lower = text.toLowerCase();

  // Amount: prefer the first number in the string (supports "1,250.50" and "1250").
  const amountMatch = /([0-9][0-9,]*(?:\.[0-9]+)?)/.exec(text.replace(/rs\.?\s*/gi, ""));
  const amountMajor = amountMatch ? Number(amountMatch[1]!.replace(/,/g, "")) : null;
  if (amountMajor == null) notes.push("No amount found.");

  // Date words.
  let date: string | null = today;
  if (/\byesterday\b|kal\b/i.test(lower)) {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    date = d.toISOString().slice(0, 10);
    notes.push("Date interpreted as yesterday.");
  } else if (/\btoday\b|aaj\b/i.test(lower)) {
    date = today;
  }

  // Merchant: strip amount/date/verb filler words, take what's left.
  let merchantGuess = lower
    .replace(/([0-9][0-9,]*(?:\.[0-9]+)?)/g, " ")
    .replace(/\b(spent|spend|paid|pay|kharch|kharcha|hua|huwa|on|pe|par|for|aaj|kal|yesterday|today|rs|pkr|usd|inr|eur|usd)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (merchantGuess.length === 0) merchantGuess = "Expense";
  if (merchantGuess.length > 40) {
    merchantGuess = merchantGuess.slice(0, 40);
    notes.push("Merchant name truncated.");
  }

  // Category by keyword; confidence reflects match strength.
  let categoryId: string | null = null;
  let confidence = 0.35;
  for (const entry of KEYWORD_CATEGORIES) {
    if (entry.keywords.some((k) => lower.includes(k))) {
      categoryId = entry.categoryId;
      confidence = 0.8;
      break;
    }
  }
  if (!categoryId) notes.push("Category uncertain — confirm or correct to teach the system.");

  return { amountMajor, merchantGuess, categoryId, date, confidence, notes };
}

export function createTransaction(
  profile: FinancialProfile,
  input: {
    amount: number;
    currency?: string;
    date?: string;
    merchant: string;
    categoryId?: string;
    source: Transaction["source"];
    notes?: string;
    confidence?: number;
  },
  today: string,
): Transaction {
  const currency = (input.currency ?? profile.currency).toUpperCase() as CurrencyCode;
  getCurrencyInfo(currency); // validates known codes fall back gracefully
  const tx: Transaction = {
    id: randomUUID(),
    userId: profile.userId,
    amount: moneyFromMajor(input.amount, currency),
    date: input.date ?? today,
    merchant: input.merchant,
    categoryId: input.categoryId,
    source: input.source,
    confidence: input.confidence ?? 1,
    notes: input.notes,
    createdAt: new Date().toISOString(),
  };
  store.transactionsOf(profile.userId).push(tx);
  return tx;
}

/** Corrections teach the system: category + confidence update, audit-safe. */
export function correctTransaction(
  userId: string,
  transactionId: string,
  patch: { categoryId?: string; merchant?: string; notes?: string },
): Transaction | undefined {
  const tx = store.transactionsOf(userId).find((t) => t.id === transactionId);
  if (!tx) return undefined;
  if (patch.categoryId) {
    tx.categoryId = patch.categoryId;
    tx.confidence = 1;
    tx.source = "manual";
  }
  if (patch.merchant) tx.merchant = patch.merchant;
  if (patch.notes) tx.notes = patch.notes;
  return tx;
}
