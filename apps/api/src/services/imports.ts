/**
 * CSV import — transparent rules, idempotent rows, honest duplicates (02_UX §11:
 * "Imported duplicate: flag probable duplicate before counting").
 *
 * Documented assumptions:
 *  - Delimiters: comma, semicolon or tab (auto-detected outside quotes).
 *  - Header optional: detected by date/amount/description-like tokens; otherwise
 *    columns are assumed date, amount, merchant.
 *  - Dates: ISO YYYY-MM-DD preferred; DD/MM/YYYY otherwise (day-first assumed and
 *    flagged in notes when ambiguous). Other formats error per-row.
 *  - Amounts: currency symbols/commas stripped; parentheses or minus → expense
 *    (absolute value); negatives are NOT credits in v1.
 *  - Idempotency: sha256(userId|date|amountMinor|merchant) stored on the
 *    transaction; repeated imports skip exact rows. Same date+amount+merchant
 *    against previously manual entries is flagged as a probable duplicate.
 */
import { createHash } from "node:crypto";
import { moneyFromMajor, type Transaction } from "@salary-ai/domain";
import { createTransaction, KEYWORD_CATEGORIES } from "./ledgerService.js";
import type { FinancialProfile } from "../store.js";

export interface CsvImportResult {
  created: Transaction[];
  duplicates: Array<{ row: number; reason: string; merchant?: string }>;
  errors: Array<{ row: number; message: string }>;
  meta: {
    delimiter: string;
    headerDetected: boolean;
    columns: { date: number; amount: number; merchant: number; category?: number };
    rowsTotal: number;
  };
}

/** Minimal CSV line parser handling quotes and escaped quotes. */
function parseCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  const counts: Array<[string, number]> = [
    [",", (firstLine.match(/,/g) ?? []).length],
    [";", (firstLine.match(/;/g) ?? []).length],
    ["\t", (firstLine.match(/\t/g) ?? []).length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0]![1] > 0 ? counts[0]![0] : ",";
}

function parseDateCell(cell: string, today: string): { date: string; note?: string } {
  const c = cell.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(c)) return { date: c };
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(c);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return {
        date: `${dmy[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        note: day <= 12 ? "day-first date assumed" : undefined,
      };
    }
  }
  if (c.toLowerCase() === "today") return { date: today };
  throw new RangeError(`Unrecognized date "${c}"`);
}

function parseAmountCell(cell: string): number {
  const cleaned = cell.replace(/[()]/g, (m) => (m === "(" ? "-" : "")).replace(/[^\d.-]/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) throw new RangeError(`Unrecognized amount "${cell}"`);
  return n;
}

function guessCategory(merchant: string, categoryCell: string | undefined, profile: FinancialProfile): string | undefined {
  if (categoryCell) {
    const lower = categoryCell.toLowerCase();
    const byName = profile.categories.find((c) => c.name.toLowerCase() === lower || c.id === categoryCell);
    if (byName) return byName.id;
  }
  const lower = merchant.toLowerCase();
  for (const entry of KEYWORD_CATEGORIES) {
    if (entry.keywords.some((k) => lower.includes(k))) return entry.categoryId;
  }
  return undefined;
}

function normalizeMerchant(m: string): string {
  return m.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function importCsv(
  profile: FinancialProfile,
  existing: readonly Transaction[],
  csv: string,
  today: string,
): CsvImportResult {
  const delimiter = detectDelimiter(csv);
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  let headerDetected = false;
  let columns = { date: 0, amount: 1, merchant: 2, category: undefined as number | undefined };
  let dataLines = lines;

  if (lines.length > 0) {
    const headerCells = parseCsvLine(lines[0]!, delimiter).map((c) => c.toLowerCase());
    const score = headerCells.filter((c) => /date|amount|value|amt|desc|merchant|payee|narration|particular|categ/.test(c)).length;
    if (score >= 2) {
      headerDetected = true;
      dataLines = lines.slice(1);
      const find = (re: RegExp) => headerCells.findIndex((c) => re.test(c));
      columns = {
        date: find(/date/),
        amount: find(/amount|value|amt|debit/),
        merchant: find(/desc|merchant|payee|narration|particular|detail/),
        category: (() => { const i = find(/categ/); return i >= 0 ? i : undefined; })(),
      };
      if (columns.date < 0 || columns.amount < 0) {
        return {
          created: [], duplicates: [], meta: { delimiter, headerDetected, columns: { date: columns.date, amount: columns.amount, merchant: columns.merchant }, rowsTotal: 0 },
          errors: [{ row: 1, message: "Could not find date and amount columns in the header row." }],
        };
      }
      if (columns.merchant < 0) columns.merchant = columns.date === 0 ? 2 : 0;
    }
  }

  const knownKeys = new Set<string>(
    existing.map((t) => t.importIdempotencyKey ?? rowKey(t.userId, t.date, t.amount.amountMinor, t.merchant)),
  );
  const seenThisImport = new Set<string>();
  const created: Transaction[] = [];
  const duplicates: CsvImportResult["duplicates"] = [];
  const errors: CsvImportResult["errors"] = [];

  dataLines.forEach((line, idx) => {
    const rowNumber = idx + (headerDetected ? 2 : 1);
    try {
      const cells = parseCsvLine(line, delimiter);
      const dateCell = cells[columns.date] ?? "";
      const amountCell = cells[columns.amount] ?? "";
      const merchantCell = (cells[columns.merchant] ?? "").replace(/^"|"$/g, "") || "Imported expense";
      const categoryCell = columns.category != null ? cells[columns.category] : undefined;

      const { date, note } = parseDateCell(dateCell, today);
      const amountMajor = parseAmountCell(amountCell);
      const amountMinor = moneyFromMajor(amountMajor, profile.currency).amountMinor;
      const key = rowKey(profile.userId, date, amountMinor, merchantCell);

      if (knownKeys.has(key) || seenThisImport.has(key)) {
        duplicates.push({ row: rowNumber, reason: "Exact duplicate of an existing transaction (same date, amount, merchant).", merchant: merchantCell });
        return;
      }
      const probable = probableDuplicate(existing, date, amountMinor, normalizeMerchant(merchantCell));
      if (probable) {
        duplicates.push({ row: rowNumber, reason: `Probable duplicate of "${probable.merchant}" (${probable.date}). Not counted — confirm on the Transactions screen.`, merchant: merchantCell });
        return;
      }

      seenThisImport.add(key);
      const tx = createTransaction(
        profile,
        {
          amount: amountMajor,
          date,
          merchant: merchantCell,
          categoryId: guessCategory(merchantCell, categoryCell, profile),
          source: "import",
          confidence: 0.9,
          notes: note,
          importIdempotencyKey: key,
        },
        today,
      );
      created.push(tx);
    } catch (e) {
      errors.push({ row: rowNumber, message: e instanceof Error ? e.message : String(e) });
    }
  });

  return {
    created,
    duplicates,
    errors,
    meta: {
      delimiter,
      headerDetected,
      columns: { date: columns.date, amount: columns.amount, merchant: columns.merchant, category: columns.category },
      rowsTotal: dataLines.length,
    },
  };
}

function rowKey(userId: string, date: string, amountMinor: number, merchant: string): string {
  return createHash("sha256").update(`${userId}|${date}|${amountMinor}|${normalizeMerchant(merchant)}`).digest("hex");
}

function probableDuplicate(
  existing: readonly Transaction[],
  date: string,
  amountMinor: number,
  normalizedMerchant: string,
): { merchant: string; date: string } | undefined {
  return existing
    .filter((t) => t.date === date && t.amount.amountMinor === amountMinor)
    .map((t) => ({ t, score: similarity(normalizedMerchant, normalizeMerchant(t.merchant)) }))
    .filter(({ score }) => score >= 0.6)
    .sort((a, b) => b.score - a.score)
    .map(({ t }) => ({ merchant: t.merchant, date: t.date }))[0];
}

/** Token-containment similarity for duplicate heuristics (deterministic).
 * "Careem" matches "Careem ride" fully — the same date+amount requirement keeps it conservative. */
function similarity(a: string, b: string): number {
  const sa = new Set(a.split(" ").filter(Boolean));
  const sb = new Set(b.split(" ").filter(Boolean));
  if (sa.size === 0 || sb.size === 0) return 0;
  let overlap = 0;
  for (const t of sa) if (sb.has(t)) overlap += 1;
  return overlap / Math.min(sa.size, sb.size);
}
