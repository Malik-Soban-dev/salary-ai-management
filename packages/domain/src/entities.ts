/**
 * Core domain entities (04_TECHNICAL_ARCHITECTURE §3 domain modules, 01_PRD §7 core objects).
 *
 * These are the shared shapes used by the finance engine, the API and (later) the
 * AI tool layer. Persistence-specific fields (ids as UUID/ULID, timestamps in UTC)
 * follow the database principles in the architecture doc.
 */
import type { CurrencyCode } from "./currency.js";
import type { Money } from "./money.js";

export type UserId = string;
export type ISODateTime = string; // UTC ISO-8601
export type ISODate = string; // YYYY-MM-DD

/** Locale + regional settings are user configuration, never product defaults. */
export interface LocaleSettings {
  countryCode: string; // ISO 3166-1 alpha-2
  language: string; // BCP-47, e.g. "en", "ur-PK"
  timezone: string; // IANA, e.g. "Asia/Karachi" — used for day/month boundaries
  weekStart: 0 | 1; // 0 = Sunday, 1 = Monday
}

export type FinancialProfile = {
  userId: UserId;
  currency: CurrencyCode;
  locale: LocaleSettings;
  /** Explicit, user-supplied facts — editable by the user at any time. */
  incomeSources: IncomeSource[];
  commitments: RecurringItem[];
  /** Flexible spending categories with baseline weights (see plan policy). */
  categories: SpendingCategory[];
  emergency: EmergencyFund;
  preferences: FinancialPreferences;
  goals: Goal[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type IncomeReliability = "stable" | "variable";

export interface IncomeSource {
  id: string;
  name: string;
  /** Expected take-home amount per period, in minor units. */
  expectedAmountMinor: number;
  currency: CurrencyCode;
  frequency: "monthly" | "biweekly" | "weekly";
  /** 1–28 day of month for monthly pay; anchors payday projections. */
  paydayRule: { kind: "day_of_month"; day: number } | { kind: "custom"; note: string };
  reliability: IncomeReliability;
}

export type RecurrenceCadence = "monthly" | "weekly" | "annual";

/** A recurring commitment: bills, rent, debt minimums, family support, subscriptions. */
export interface RecurringItem {
  id: string;
  name: string;
  essential: boolean; // protected before any flexible suggestion (01_PRD rule 1)
  expectedAmountMinor: number;
  /** Plausible range (minor units) — shown honestly as a range in UI. */
  rangeMinor?: { low: number; high: number };
  cadence: RecurrenceCadence;
  dueDay?: number; // day of month for monthly cadence
  categoryId?: string;
  confidence: number; // 0..1 — explicit user entry = 1
  source: "user" | "inferred";
}

export type CategoryKind = "essential" | "flexible" | "goal_linked";

export interface SpendingCategory {
  id: string;
  name: string;
  kind: CategoryKind;
  /** Relative weight used to split flexible money across categories (largest remainder). */
  baselineWeight: number;
  /** Optional hard floor the planner will try to respect (minor units / month). */
  floorMinor?: number;
}

export interface EmergencyFund {
  currentAmountMinor: number;
  targetAmountMinor: number;
  /** User-stated target expressed as months of essential costs. */
  targetMonthsOfEssentials?: number;
}

export type SavingsStyle = "conservative" | "balanced" | "ambitious";

export interface FinancialPreferences {
  savingsStyle: SavingsStyle;
  buffer: { kind: "fixed" | "percent_of_income"; value: number };
  /** Buffer is reserved before goal contributions when true. */
  bufferBeforeGoals: boolean;
  /** Religious/ethical or other preference tags the user opted into (e.g. "halal_only"). */
  values?: string[];
}

export interface Goal {
  id: string;
  name: string;
  targetAmountMinor: number;
  savedAmountMinor: number;
  currency: CurrencyCode;
  targetDate?: ISODate;
  priority: number; // 1 = highest
  /** Minimum monthly contribution the user wants protected (minor units). */
  minMonthlyContributionMinor?: number;
  status: "active" | "paused" | "achieved";
}

export type TransactionSource = "manual" | "text" | "voice" | "import" | "receipt";

export interface Transaction {
  id: string;
  userId: UserId;
  /** Original amount + currency as entered; history is never silently rewritten (engineering rule 5). */
  amount: Money;
  date: ISODate;
  merchant: string;
  categoryId?: string;
  source: TransactionSource;
  /** Classification confidence 0..1; corrections set 1 with source "manual". */
  confidence: number;
  recurringFlag?: boolean;
  /** Hash of the import row — idempotency for CSV/receipt imports (04_ARCH §5). */
  importIdempotencyKey?: string;
  notes?: string;
  createdAt: ISODateTime;
}

/** Plan lifecycle is an explicit state machine, not loose booleans (engineering rule 6). */
export type PlanStatus = "draft" | "approved" | "superseded";

export type PlanPeriod = { year: number; month: number }; // month: 1..12
