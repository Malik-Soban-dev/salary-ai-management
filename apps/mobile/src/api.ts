/** API client — typed wrapper over the Salary AI v1 endpoints (same contracts as the web client). */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "./config";

const TOKEN_KEY = "sai.token";

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}
export async function setToken(t: string | null): Promise<void> {
  if (t) await AsyncStorage.setItem(TOKEN_KEY, t);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null as T;
  const data = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) throw new ApiError(res.status, data.message ?? `Request failed (${res.status})`, data);
  return data;
}

export const api = {
  register: (email: string, password: string, currency: string) =>
    call<{ token: string; userId: string; billing: Billing }>("POST", "/v1/auth/register", { email, password, currency }),
  login: (email: string, password: string) =>
    call<{ token: string; userId: string; billing: Billing }>("POST", "/v1/auth/login", { email, password }),
  logout: () => call<void>("POST", "/v1/auth/logout"),

  profile: () => call<Profile>("GET", "/v1/profile"),
  updateProfile: (patch: unknown) => call<Profile>("PUT", "/v1/profile", patch),
  updateLocale: (patch: unknown) => call<Profile>("PATCH", "/v1/profile/locale", patch),

  generatePlan: () => call<Plan>("POST", "/v1/month-plans/generate"),
  currentPlan: () => call<Plan | null>("GET", "/v1/month-plans/current"),
  latestPlan: () => call<Plan | null>("GET", "/v1/month-plans/latest"),
  approvePlan: (id: string) => call<Plan>("POST", `/v1/month-plans/${id}/approve`),
  rollover: () => call<{ plan: Plan; applied: boolean }>("POST", "/v1/month-plans/rollover", {}),

  safeToSpend: () => call<SafeToSpend>("GET", "/v1/safe-to-spend"),
  transactions: (limit = 60) => call<Transaction[]>("GET", `/v1/transactions?limit=${limit}`),
  parseTransaction: (text: string) =>
    call<ParsedDraft>("POST", "/v1/transactions/parse", { text }),
  addTransaction: (t: { amount: number; merchant: string; categoryId?: string; source: string; confidence?: number }) =>
    call<Transaction>("POST", "/v1/transactions", t),
  correctTransaction: (id: string, patch: { categoryId?: string; merchant?: string }) =>
    call<Transaction>("PATCH", `/v1/transactions/${id}`, patch),

  goals: () => call<GoalWithProjection[]>("GET", "/v1/goals"),
  createGoal: (g: { name: string; targetAmount: number; targetDate?: string; priority?: number }) =>
    call<Goal>("POST", "/v1/goals", g),

  insights: () => call<Insights>("GET", "/v1/insights/monthly"),
  monthEnd: () => call<MonthEnd>("GET", "/v1/insights/month-end"),

  billing: () => call<Billing & { trialDays?: number }>("GET", "/v1/billing/status"),
  checkout: (planId = "pro-monthly") =>
    call<Billing & { message: string }>("POST", "/v1/billing/checkout", { planId }),

  startAiSession: () => call<{ id: string }>("POST", "/v1/ai/sessions"),
  sendAi: (sessionId: string, text: string) =>
    call<AiReply>("POST", `/v1/ai/sessions/${sessionId}/messages`, { text }),
};

// ---- shapes (mirror @salary-ai/domain; kept local so mobile stays dependency-light) ----
export interface Billing { state: "trialing" | "active" | "expired"; daysRemaining?: number; trialEndsAt?: string; planId?: string }
export interface Money { amountMinor: number; currency: string }
export interface Profile {
  userId: string; currency: string;
  locale: { countryCode: string; language: string; timezone: string; weekStart: 0 | 1 };
  incomeSources: Array<{ id: string; name: string; expectedAmountMinor: number; reliability: string }>;
  commitments: Array<{ id: string; name: string; essential: boolean; expectedAmountMinor: number; cadence: string; dueDay?: number }>;
  categories: Array<{ id: string; name: string; kind: string; baselineWeight: number }>;
  emergency: { currentAmountMinor: number; targetAmountMinor: number };
  preferences: { savingsStyle: string; buffer: { kind: string; value: number } };
  goals: Goal[];
}
export interface Plan {
  id: string; period: { year: number; month: number }; currency: string; status: string;
  totals: Record<"income" | "protected" | "flexible" | "emergency" | "goals" | "buffer" | "unallocated", Money>;
  allocations: {
    obligations: Array<{ recurringItemId: string; name: string; amount: Money; dueDay?: number; protected: boolean }>;
    flexible: Array<{ categoryId: string; name: string; planned: Money; weight: number }>;
    emergency: Money;
    goals: Array<{ goalId: string; name: string; priority: number; planned: Money; requiredMonthlyPaceMinor?: number }>;
    buffer: Money;
  };
  warnings: Array<{ code: string; message: string }>;
  adaptations?: Array<{ categoryId: string; name: string; fromWeight: number; toWeight: number; reason: string; material: boolean }>;
  calculationVersion: string; approvedAt?: string;
}
export interface SafeToSpend {
  estimated?: boolean; period: { year: number; month: number }; currency: string;
  availableNow: Money; dailyRecommended: Money; daysRemaining: number;
  breakdown?: { flexibleBudgetTotal: Money; flexibleSpent: Money; flexibleRemaining: Money; reservedForUpcomingObligations: Money; overspend: Money };
  note?: string; calculationVersion?: string;
}
export interface Transaction { id: string; amount: Money; date: string; merchant: string; categoryId?: string; source: string; confidence: number }
export interface ParsedDraft { amountMajor: number | null; merchantGuess: string; categoryId: string | null; date: string | null; confidence: number; notes: string[] }
export interface Goal { id: string; name: string; targetAmountMinor: number; savedAmountMinor: number; currency: string; targetDate?: string; priority: number; status: string }
export interface GoalWithProjection extends Goal {
  monthlyPlannedMinor: number;
  projection: { requiredMonthlyPaceMinor: number; monthsRemaining: number | null; onTrack: boolean };
}
export interface Insights {
  period: { year: number; month: number }; currency: string; hasPlan: boolean; transactionCount: number;
  variance?: { lines: Array<{ categoryId: string; name: string; planned: Money; actual: Money; percentUsed: number; status: string }> };
  emergency: { current: Money; target: Money; progressPercent: number; essentialsCoverageMonths: number; monthlyContribution: Money };
  recurring: { totalExpected: Money; totalRange: { low: Money; high: Money }; lines: Array<{ name: string; expected: Money; confidence: number; range: { low: Money; high: Money } }> };
  overspending: Array<{ name: string; percentUsed: number }>;
}
export interface MonthEnd {
  ready: boolean; reason?: string;
  nextPeriod: { year: number; month: number };
  evidence: { categorizedInPeriod: number };
  proposals: Array<{ categoryId: string; name: string; fromWeight: number; toWeight: number; reason: string; material: boolean }>;
  summary: { totalPlannedMinor: number | null; totalActualMinor: number | null; topOver: Array<{ name: string; percentUsed: number }> };
}
export interface AiReply { reply: string; provider: string; toolCalls: Array<{ name: string }>; recommendation: { calculation_id: string; recommendation_type: string } }
