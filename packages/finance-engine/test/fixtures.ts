/**
 * Shared test fixtures.
 *
 * Roadmap rule (05_DELIVERY_ROADMAP §3A.4): test at least three intentionally
 * different market/lifestyle profiles so the engine encodes no single-country
 * assumption. Fixtures here are synthetic — never real user data (security rule).
 */
import type {
  FinancialPreferences,
  Goal,
  IncomeSource,
  RecurringItem,
  SpendingCategory,
} from "@salary-ai/domain";

/** 1. PKR salaried employee with family obligations. */
export const pkrSalariedProfile = {
  currency: "PKR" as const,
  incomeSources: [
    {
      id: "inc-1",
      name: "Salary",
      expectedAmountMinor: 18_000_000, // Rs 180,000
      currency: "PKR",
      frequency: "monthly" as const,
      paydayRule: { kind: "day_of_month" as const, day: 1 },
      reliability: "stable" as const,
    },
  ],
  commitments: [
    { id: "c-rent", name: "Rent", essential: true, expectedAmountMinor: 4_500_000, cadence: "monthly" as const, dueDay: 5, confidence: 1, source: "user" as const },
    { id: "c-util", name: "Utilities", essential: true, expectedAmountMinor: 900_000, rangeMinor: { low: 750_000, high: 900_000 }, cadence: "monthly" as const, dueDay: 15, confidence: 1, source: "user" as const },
    { id: "c-fam", name: "Family support", essential: true, expectedAmountMinor: 2_000_000, cadence: "monthly" as const, dueDay: 3, confidence: 1, source: "user" as const },
  ] satisfies RecurringItem[],
  categories: [
    { id: "cat-groceries", name: "Groceries", kind: "flexible" as const, baselineWeight: 4 },
    { id: "cat-transport", name: "Transport", kind: "flexible" as const, baselineWeight: 2 },
    { id: "cat-dining", name: "Dining", kind: "flexible" as const, baselineWeight: 2 },
    { id: "cat-shopping", name: "Shopping", kind: "flexible" as const, baselineWeight: 1 },
  ] satisfies SpendingCategory[],
  emergency: { currentAmountMinor: 2_000_000, targetAmountMinor: 6_000_000 },
  preferences: {
    savingsStyle: "balanced" as const,
    buffer: { kind: "percent_of_income" as const, value: 5 },
    bufferBeforeGoals: false,
  } satisfies FinancialPreferences,
  goals: [
    { id: "g-car", name: "Car fund", targetAmountMinor: 12_000_000, savedAmountMinor: 2_000_000, currency: "PKR", targetDate: "2027-09", priority: 1, status: "active" as const },
  ] satisfies Goal[],
};

/** 2. USD freelancer with variable income and high fixed costs. */
export const usdFreelanceProfile = {
  currency: "USD" as const,
  incomeSources: [
    {
      id: "inc-1",
      name: "Client retainer",
      expectedAmountMinor: 350_000, // $3,500
      currency: "USD",
      frequency: "monthly" as const,
      paydayRule: { kind: "day_of_month" as const, day: 28 },
      reliability: "variable" as const,
    },
  ],
  commitments: [
    { id: "c-rent", name: "Apartment", essential: true, expectedAmountMinor: 180_000, cadence: "monthly" as const, dueDay: 1, confidence: 1, source: "user" as const },
    { id: "c-ins", name: "Health insurance", essential: true, expectedAmountMinor: 40_000, cadence: "monthly" as const, dueDay: 10, confidence: 1, source: "user" as const },
    { id: "c-software", name: "Software subscriptions", essential: false, expectedAmountMinor: 9_900, cadence: "monthly" as const, dueDay: 20, confidence: 1, source: "user" as const },
  ] satisfies RecurringItem[],
  categories: [
    { id: "cat-groceries", name: "Groceries", kind: "flexible" as const, baselineWeight: 3 },
    { id: "cat-dining", name: "Dining out", kind: "flexible" as const, baselineWeight: 2 },
    { id: "cat-travel", name: "Travel", kind: "flexible" as const, baselineWeight: 2 },
  ] satisfies SpendingCategory[],
  emergency: { currentAmountMinor: 800_000, targetAmountMinor: 1_260_000 }, // 6 months of essentials
  preferences: {
    savingsStyle: "conservative" as const,
    buffer: { kind: "fixed" as const, value: 20_000 }, // $200
    bufferBeforeGoals: true,
  } satisfies FinancialPreferences,
  goals: [
    { id: "g-laptop", name: "New laptop", targetAmountMinor: 250_000, savedAmountMinor: 50_000, currency: "USD", priority: 2, status: "active" as const },
    { id: "g-couch", name: "Couch", targetAmountMinor: 120_000, savedAmountMinor: 0, currency: "USD", targetDate: "2026-12", priority: 1, status: "active" as const },
  ] satisfies Goal[],
};

/** 3. JPY minimal-lifestyle saver — zero-decimal currency edge case, no debts, one aggressive goal. */
export const jpyMinimalProfile = {
  currency: "JPY" as const,
  incomeSources: [
    {
      id: "inc-1",
      name: "Salary",
      expectedAmountMinor: 320_000, // ¥320,000 (minor units == yen)
      currency: "JPY",
      frequency: "monthly" as const,
      paydayRule: { kind: "day_of_month" as const, day: 25 },
      reliability: "stable" as const,
    },
  ],
  commitments: [
    { id: "c-rent", name: "Rent", essential: true, expectedAmountMinor: 80_000, cadence: "monthly" as const, dueDay: 27, confidence: 1, source: "user" as const },
    { id: "c-utils", name: "Utilities", essential: true, expectedAmountMinor: 10_000, cadence: "monthly" as const, dueDay: 28, confidence: 1, source: "user" as const },
  ] satisfies RecurringItem[],
  categories: [
    { id: "cat-food", name: "Food", kind: "flexible" as const, baselineWeight: 3, floorMinor: 30_000 },
    { id: "cat-hobby", name: "Hobby", kind: "flexible" as const, baselineWeight: 1 },
  ] satisfies SpendingCategory[],
  emergency: { currentAmountMinor: 1_000_000, targetAmountMinor: 540_000 }, // already above target
  preferences: {
    savingsStyle: "ambitious" as const,
    buffer: { kind: "percent_of_income" as const, value: 3 },
    bufferBeforeGoals: false,
  } satisfies FinancialPreferences,
  goals: [
    { id: "g-home", name: "Home deposit", targetAmountMinor: 10_000_000, savedAmountMinor: 4_000_000, currency: "JPY", targetDate: "2028-09", priority: 1, status: "active" as const },
  ] satisfies Goal[],
};
