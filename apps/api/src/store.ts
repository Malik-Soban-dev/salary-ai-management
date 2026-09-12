/**
 * In-memory data store behind narrow repository interfaces.
 *
 * The MVP prototype runs in-memory so the sandbox demo is self-contained; the
 * interfaces match the Postgres schema in infra/migrations/000_init.sql so a
 * durable implementation can replace this module without touching services.
 * Tenant isolation is enforced here: every user-scoped access is keyed by userId.
 */
import { randomUUID } from "node:crypto";
import type {
  FinancialProfile,
  Goal,
  MonthlyPlan,
  RecurringItem,
  Transaction,
  IncomeSource,
  SpendingCategory,
} from "@salary-ai/domain";

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  displayName: string;
  createdAt: string;
}

export interface SubscriptionRecord {
  userId: string;
  provider: "mock" | "app_store" | "play_store" | "stripe";
  planId: string;
  trialStartAt: string;
  trialEndAt: string;
  status: "trialing" | "active" | "expired";
  renewalAt?: string;
  cancelAt?: string;
  providerReference?: string;
}

export interface AiSessionRecord {
  id: string;
  userId: string;
  createdAt: string;
  messages: Array<{
    role: "user" | "assistant";
    text: string;
    recommendation?: unknown;
    toolCalls?: Array<{ name: string; arguments: unknown }>;
    at: string;
  }>;
}

export class Store {
  readonly users = new Map<string, UserRecord>();
  readonly usersByEmail = new Map<string, UserRecord>();
  readonly sessions = new Map<string, { userId: string; expiresAt: number }>();
  readonly profiles = new Map<string, FinancialProfile>();
  readonly subscriptions = new Map<string, SubscriptionRecord>();
  readonly transactions = new Map<string, Transaction[]>(); // userId → txns
  readonly plans = new Map<string, MonthlyPlan[]>(); // userId → plans
  readonly aiSessions = new Map<string, AiSessionRecord>();
  readonly auditLog: Array<{ at: string; userId: string; action: string; details: Record<string, unknown> }> = [];

  createUser(email: string, passwordHash: string, passwordSalt: string, displayName: string): UserRecord {
    const user: UserRecord = {
      id: randomUUID(),
      email: email.toLowerCase(),
      passwordHash,
      passwordSalt,
      displayName,
      createdAt: new Date().toISOString(),
    };
    this.users.set(user.id, user);
    this.usersByEmail.set(user.email, user);
    return user;
  }

  transactionsOf(userId: string): Transaction[] {
    let list = this.transactions.get(userId);
    if (!list) {
      list = [];
      this.transactions.set(userId, list);
    }
    return list;
  }

  plansOf(userId: string): MonthlyPlan[] {
    let list = this.plans.get(userId);
    if (!list) {
      list = [];
      this.plans.set(userId, list);
    }
    return list;
  }

  /** Latest plan for a period (drafts included), or undefined. */
  currentPlan(userId: string, period: { year: number; month: number }): MonthlyPlan | undefined {
    return this.plansOf(userId)
      .filter((p) => p.period.year === period.year && p.period.month === period.month)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  }
}

export const store = new Store();

/** Convenience builders used by onboarding and the demo seeder. */
export function emptyProfile(userId: string, currency: string, now: string): FinancialProfile {
  return {
    userId,
    currency,
    locale: { countryCode: "US", language: "en", timezone: "UTC", weekStart: 1 },
    incomeSources: [],
    commitments: [],
    categories: defaultCategories(),
    emergency: { currentAmountMinor: 0, targetAmountMinor: 0 },
    preferences: {
      savingsStyle: "balanced",
      buffer: { kind: "percent_of_income", value: 5 },
      bufferBeforeGoals: false,
    },
    goals: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** Neutral starter categories; users rename/merge/split/disable them (world-neutral rule). */
export function defaultCategories(): SpendingCategory[] {
  return [
    { id: "cat-groceries", name: "Groceries", kind: "flexible", baselineWeight: 4 },
    { id: "cat-transport", name: "Transport", kind: "flexible", baselineWeight: 3 },
    { id: "cat-dining", name: "Dining", kind: "flexible", baselineWeight: 2 },
    { id: "cat-shopping", name: "Shopping", kind: "flexible", baselineWeight: 2 },
    { id: "cat-health", name: "Health", kind: "flexible", baselineWeight: 1 },
    { id: "cat-fun", name: "Entertainment", kind: "flexible", baselineWeight: 1 },
  ];
}

export type { FinancialProfile, IncomeSource, RecurringItem, Goal, Transaction, MonthlyPlan };
