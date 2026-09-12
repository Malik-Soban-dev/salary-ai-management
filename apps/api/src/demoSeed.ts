/**
 * Demo seed — one intentionally specific example profile (a salaried employee
 * with family commitments). The product itself stays world-neutral; this is
 * sample data, not a default lifestyle. Synthetic only, never real user data.
 */
import { randomUUID } from "node:crypto";

export const demoSeedData = {
  currency: "PKR",
  locale: { countryCode: "PK", language: "en", timezone: "Asia/Karachi", weekStart: 1 as const },
  profileUpdate: {
    incomeSources: [
      {
        name: "Monthly salary (take-home)",
        expectedAmount: 185000,
        frequency: "monthly" as const,
        paydayDay: 1,
        reliability: "stable" as const,
      },
      {
        name: "Freelance design work",
        expectedAmount: 25000,
        frequency: "monthly" as const,
        paydayDay: 20,
        reliability: "variable" as const,
      },
    ],
    commitments: [
      { name: "Rent", expectedAmount: 45000, essential: true, cadence: "monthly" as const, dueDay: 5 },
      { name: "Utilities (electricity, gas, water)", expectedAmount: 14000, essential: true, cadence: "monthly" as const, dueDay: 15, rangeLow: 11000, rangeHigh: 18000 },
      { name: "Internet + phone", expectedAmount: 3500, essential: true, cadence: "monthly" as const, dueDay: 12 },
      { name: "Family support", expectedAmount: 25000, essential: true, cadence: "monthly" as const, dueDay: 3 },
      { name: "Streaming subscriptions", expectedAmount: 1500, essential: false, cadence: "monthly" as const, dueDay: 22 },
    ],
    categories: [
      { name: "Groceries", baselineWeight: 5, floor: 18000 },
      { name: "Transport", baselineWeight: 3, floor: 6000 },
      { name: "Dining out", baselineWeight: 2 },
      { name: "Shopping", baselineWeight: 2 },
      { name: "Entertainment", baselineWeight: 1 },
    ],
    emergency: { currentAmount: 60000, targetAmount: 240000 },
    preferences: {
      savingsStyle: "balanced" as const,
      buffer: { kind: "percent_of_income" as const, value: 5 },
      bufferBeforeGoals: false,
    },
  },
  goals: (currency: string) => [
    {
      id: randomUUID(),
      name: "Emergency fund top-up",
      targetAmountMinor: 240_000 * 100,
      savedAmountMinor: 60_000 * 100,
      currency,
      priority: 1,
      status: "active" as const,
    },
    {
      id: randomUUID(),
      name: "Motorbike upgrade",
      targetAmountMinor: 220_000 * 100,
      savedAmountMinor: 85_000 * 100,
      currency,
      targetDate: `${new Date().getUTCFullYear() + 1}-06`,
      priority: 2,
      status: "active" as const,
    },
  ],
  /** categoryByName maps seeded merchants onto the profile's real category ids. */
  transactions: (today: string, categoryByName: Record<string, string>) => {
    const day = Number(today.slice(8, 10));
    const clamp = (d: number) => Math.max(1, Math.min(day, d));
    const mk = (dayOfMonth: number, amount: number, merchant: string, categoryName: string, source: "manual" | "text") => ({
      amount,
      merchant,
      categoryId: categoryByName[categoryName],
      source,
      date: `${today.slice(0, 8)}${String(clamp(dayOfMonth)).padStart(2, "0")}`,
    });
    return [
      mk(2, 2450, "Imtiaz Super Market", "Groceries", "manual"),
      mk(3, 800, "Careem ride", "Transport", "text"),
      mk(4, 3200, "Dinner with family", "Dining out", "manual"),
      mk(6, 5100, "Grocery run", "Groceries", "manual"),
      mk(7, 1500, "Petrol", "Transport", "text"),
      mk(8, 2799, "Movie night", "Entertainment", "manual"),
      mk(9, 4300, "Weekly groceries", "Groceries", "manual"),
    ];
  },
};
