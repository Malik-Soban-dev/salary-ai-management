/** Core product routes: auth, profile, plans, safe-to-spend, transactions, goals, insights.
 * Auth + entitlement gating happens in hooks.ts; handlers read `request.userId`. */
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { moneyFromMajor } from "@salary-ai/domain";
import { periodOf, projectGoal } from "@salary-ai/finance-engine";
import {
  csvImportSchema,
  goalCreateSchema,
  loginRequestSchema,
  profileUpdateSchema,
  registerRequestSchema,
  transactionCreateSchema,
  transactionParseSchema,
} from "@salary-ai/schemas";
import { importCsv } from "../services/imports.js";
import { createSession, hashPassword, verifyPassword } from "../auth.js";
import { getEntitlement, startTrial } from "../billing.js";
import { emptyProfile, store } from "../store.js";
import type { AuthedRequest } from "../hooks.js";
import { approvePlan, applyProfileUpdate, generatePlan, safeToSpend, upcomingObligations } from "../services/planService.js";
import { correctTransaction, createTransaction, parseTransactionText } from "../services/ledgerService.js";
import { monthlyInsights } from "../services/insightService.js";
import { audit } from "../audit.js";
import { todayInUserTz } from "../dates.js";

export function registerCoreRoutes(app: FastifyInstance): void {
  // ---- Auth ----------------------------------------------------------------
  app.post("/v1/auth/register", async (request, reply) => {
    const body = registerRequestSchema.parse(request.body);
    if (store.usersByEmail.has(body.email.toLowerCase())) {
      return reply.code(409).send({ error: "email_taken", message: "An account with this email already exists." });
    }
    const { hash, salt } = hashPassword(body.password);
    const user = store.createUser(body.email, hash, salt, body.displayName ?? body.email.split("@")[0]!);
    const now = new Date().toISOString();
    const profile = emptyProfile(user.id, body.currency.toUpperCase(), now);
    if (body.locale) profile.locale = { ...profile.locale, ...body.locale, countryCode: body.locale.countryCode.toUpperCase() };
    store.profiles.set(user.id, profile);
    startTrial(user.id); // Day 0: account enters the 3-day trial state
    audit(user.id, "account.created");
    return reply.code(201).send({ token: createSession(user.id), userId: user.id, billing: getEntitlement(user.id) });
  });

  app.post("/v1/auth/login", async (request, reply) => {
    const body = loginRequestSchema.parse(request.body);
    const user = store.usersByEmail.get(body.email.toLowerCase());
    if (!user || !verifyPassword(body.password, user.passwordHash, user.passwordSalt)) {
      return reply.code(401).send({ error: "invalid_credentials", message: "Email or password is incorrect." });
    }
    audit(user.id, "auth.login");
    return { token: createSession(user.id), userId: user.id, billing: getEntitlement(user.id) };
  });

  app.post("/v1/auth/logout", async (request: AuthedRequest, reply) => {
    if (request.sessionToken) store.sessions.delete(request.sessionToken);
    reply.code(204).send();
  });

  // ---- Profile / Financial DNA ------------------------------------------------
  app.get("/v1/profile", async (request: AuthedRequest) => store.profiles.get(request.userId!));

  app.patch("/v1/profile/locale", async (request: AuthedRequest) => {
    const profile = store.profiles.get(request.userId!)!;
    const body = profileUpdateSchema.parse(request.body);
    if (body.currency) profile.currency = body.currency.toUpperCase();
    if (body.locale) {
      profile.locale = { ...profile.locale, ...body.locale, countryCode: body.locale.countryCode.toUpperCase() };
    }
    audit(request.userId!, "profile.locale_changed");
    return profile;
  });

  app.put("/v1/profile", async (request: AuthedRequest) => {
    const profile = store.profiles.get(request.userId!)!;
    const body = profileUpdateSchema.parse(request.body);
    applyProfileUpdate(profile, body, new Date().toISOString());
    audit(request.userId!, "profile.updated");
    return profile;
  });

  app.get("/v1/profile/export", async (request: AuthedRequest) => {
    audit(request.userId!, "data.exported");
    return {
      profile: store.profiles.get(request.userId!),
      transactions: store.transactionsOf(request.userId!),
      plans: store.plansOf(request.userId!),
      billing: store.subscriptions.get(request.userId!),
      audit: store.auditLog.filter((e) => e.userId === request.userId),
    };
  });

  app.delete("/v1/profile", async (request: AuthedRequest, reply) => {
    const userId = request.userId!;
    audit(userId, "data.deleted");
    store.profiles.delete(userId);
    store.transactions.delete(userId);
    store.plans.delete(userId);
    store.subscriptions.delete(userId);
    store.aiSessions.delete(userId);
    const user = store.users.get(userId);
    if (user) store.usersByEmail.delete(user.email);
    store.users.delete(userId);
    reply.code(204).send();
  });

  // ---- Month plans -----------------------------------------------------------
  app.post("/v1/month-plans/generate", async (request: AuthedRequest, reply) => {
    const profile = store.profiles.get(request.userId!)!;
    const plan = generatePlan(profile, todayInUserTz(profile.locale.timezone));
    audit(request.userId!, "plan.generated", { planId: plan.id });
    return reply.code(201).send(plan);
  });

  app.get("/v1/month-plans/current", async (request: AuthedRequest) => {
    const profile = store.profiles.get(request.userId!)!;
    return store.currentPlan(request.userId!, periodOf(todayInUserTz(profile.locale.timezone))) ?? null;
  });

  app.get("/v1/month-plans/latest", async (request: AuthedRequest) => {
    return (
      [...store.plansOf(request.userId!)].sort(
        (a, b) => b.period.year - a.period.year || b.period.month - a.period.month || b.createdAt.localeCompare(a.createdAt),
      )[0] ?? null
    );
  });

  app.post("/v1/month-plans/:id/approve", async (request: AuthedRequest, reply) => {
    const userId = request.userId!;
    const { id } = request.params as { id: string };
    const plan = approvePlan(userId, id);
    if (!plan) return reply.code(404).send({ error: "not_found", message: "Plan not found." });
    audit(userId, "plan.approved", { planId: plan.id });
    return plan;
  });

  app.get("/v1/safe-to-spend", async (request: AuthedRequest) => {
    const profile = store.profiles.get(request.userId!)!;
    const today = todayInUserTz(profile.locale.timezone);
    const { safeToSpend: sts } = safeToSpend(profile, today);
    if (!sts) {
      // UX failure state: "No salary yet → show expected plan, not zeros" (02_UX §11).
      const period = periodOf(today);
      const expected = profile.incomeSources.reduce((acc, s) => acc + s.expectedAmountMinor, 0);
      const essentials = upcomingObligations(profile, today, period).reduce((a, o) => a + o.amountMinor, 0);
      return {
        estimated: true,
        period,
        currency: profile.currency,
        availableNow: { amountMinor: Math.max(0, expected - essentials), currency: profile.currency },
        dailyRecommended: {
          amountMinor: Math.floor(Math.max(0, expected - essentials) / Math.max(1, 30 - Number(today.slice(8, 10)) + 1)),
          currency: profile.currency,
        },
        note: "Approve this month's plan to get your exact safe-to-spend number.",
      };
    }
    return { estimated: false, ...sts };
  });

  // ---- Transactions -----------------------------------------------------------
  app.post("/v1/transactions", async (request: AuthedRequest, reply) => {
    const profile = store.profiles.get(request.userId!)!;
    const body = transactionCreateSchema.parse(request.body);
    const today = todayInUserTz(profile.locale.timezone);
    return reply.code(201).send(createTransaction(profile, body, today));
  });

  app.get("/v1/transactions", async (request: AuthedRequest) => {
    const query = (request.query ?? {}) as { limit?: string; categoryId?: string };
    let list = [...store.transactionsOf(request.userId!)].sort((a, b) => b.date.localeCompare(a.date));
    if (query.categoryId) list = list.filter((t) => t.categoryId === query.categoryId);
    const limit = Math.min(200, Math.max(1, Number(query.limit ?? 100)));
    return list.slice(0, limit);
  });

  app.post("/v1/transactions/parse", async (request: AuthedRequest) => {
    const profile = store.profiles.get(request.userId!)!;
    const body = transactionParseSchema.parse(request.body);
    return parseTransactionText(body.text, todayInUserTz(profile.locale.timezone));
  });

  app.post("/v1/imports/csv", async (request: AuthedRequest) => {
    const profile = store.profiles.get(request.userId!)!;
    const body = csvImportSchema.parse(request.body);
    const today = todayInUserTz(profile.locale.timezone);
    const result = importCsv(profile, store.transactionsOf(request.userId!), body.csv, today);
    audit(request.userId!, "data.csv_imported", {
      created: result.created.length,
      duplicates: result.duplicates.length,
      errors: result.errors.length,
    });
    return result;
  });

  app.patch("/v1/transactions/:id", async (request: AuthedRequest, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { categoryId?: string; merchant?: string; notes?: string };
    const tx = correctTransaction(request.userId!, id, body);
    if (!tx) return reply.code(404).send({ error: "not_found", message: "Transaction not found." });
    return tx; // corrections set confidence=1 and teach classification (01_PRD rule 3)
  });

  // ---- Goals -------------------------------------------------------------------
  app.get("/v1/goals", async (request: AuthedRequest) => {
    const profile = store.profiles.get(request.userId!)!;
    const period = periodOf(todayInUserTz(profile.locale.timezone));
    const plan = store.currentPlan(request.userId!, period);
    return profile.goals.map((g) => ({
      ...g,
      projection: projectGoal({
        goal: {
          id: g.id,
          targetAmountMinor: g.targetAmountMinor,
          savedAmountMinor: g.savedAmountMinor,
          targetDate: g.targetDate?.slice(0, 7),
          priority: g.priority,
        },
        period,
        plannedMonthlyContributionMinor:
          plan?.allocations.goals.find((a) => a.goalId === g.id)?.planned.amountMinor ?? 0,
      }),
      monthlyPlannedMinor: plan?.allocations.goals.find((a) => a.goalId === g.id)?.planned.amountMinor ?? 0,
    }));
  });

  app.post("/v1/goals", async (request: AuthedRequest, reply) => {
    const profile = store.profiles.get(request.userId!)!;
    const body = goalCreateSchema.parse(request.body);
    const goal = {
      id: randomUUID(),
      name: body.name,
      targetAmountMinor: moneyFromMajor(body.targetAmount, profile.currency).amountMinor,
      savedAmountMinor: 0,
      currency: profile.currency,
      targetDate: body.targetDate,
      priority: body.priority,
      minMonthlyContributionMinor: body.minMonthlyContribution
        ? moneyFromMajor(body.minMonthlyContribution, profile.currency).amountMinor
        : undefined,
      status: "active" as const,
    };
    profile.goals.push(goal);
    return reply.code(201).send(goal);
  });

  // ---- Insights ------------------------------------------------------------------
  app.get("/v1/insights/monthly", async (request: AuthedRequest) => {
    const profile = store.profiles.get(request.userId!)!;
    return monthlyInsights(profile, todayInUserTz(profile.locale.timezone));
  });
}
