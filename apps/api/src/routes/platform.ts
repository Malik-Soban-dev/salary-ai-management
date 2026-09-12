/** Platform routes: billing (trial → subscription), AI assistant, demo seeder. */
import type { FastifyInstance } from "fastify";
import { createHmac, randomUUID, randomBytes } from "node:crypto";
import { aiMessageSchema } from "@salary-ai/schemas";
import { activateSubscription, getEntitlement, startTrial, TRIAL_DAYS } from "../billing.js";
import { emptyProfile, store } from "../store.js";
import type { AuthedRequest } from "../hooks.js";
import { runAssistantTurn } from "../services/assistant.js";
import { createSession } from "../auth.js";
import { audit } from "../audit.js";
import { todayInUserTz } from "../dates.js";
import { applyProfileUpdate, approvePlan, generatePlan } from "../services/planService.js";
import { createTransaction } from "../services/ledgerService.js";
import { demoSeedData } from "../demoSeed.js";

export function registerPlatformRoutes(app: FastifyInstance): void {
  // ---- Billing -----------------------------------------------------------------
  app.get("/v1/billing/status", async (request: AuthedRequest) => {
    const userId = request.userId;
    if (!userId) return { state: "anonymous", trialDays: TRIAL_DAYS };
    return { ...getEntitlement(userId), trialDays: TRIAL_DAYS };
  });

  app.post("/v1/billing/checkout", async (request: AuthedRequest, reply) => {
    const userId = request.userId;
    if (!userId) return reply.code(401).send({ error: "unauthenticated" });
    const body = (request.body ?? {}) as { planId?: string };
    const planId = body.planId ?? "pro-monthly";
    activateSubscription(userId, planId, "mock");
    audit(userId, "billing.subscription_activated", { planId });
    return { ...getEntitlement(userId), message: "Mock checkout complete — subscription active." };
  });

  app.post("/v1/billing/webhook", async (request, reply) => {
    // Verified-provider path: HMAC signature when a secret is configured.
    const secret = process.env.BILLING_WEBHOOK_SECRET;
    if (secret) {
      const signature = request.headers["x-signature"];
      const raw = JSON.stringify(request.body);
      const expected = createHmac("sha256", secret).update(raw).digest("hex");
      if (signature !== expected) {
        return reply.code(401).send({ error: "invalid_signature" });
      }
    }
    const body = (request.body ?? {}) as { event?: string; userId?: string; planId?: string };
    if (body.event === "subscription_activated" && body.userId) {
      activateSubscription(body.userId, body.planId ?? "pro-monthly", "mock");
      audit(body.userId, "billing.webhook_activation");
    }
    return { received: true };
  });

  // ---- AI assistant ---------------------------------------------------------------
  app.post("/v1/ai/sessions", async (request: AuthedRequest, reply) => {
    const session = { id: randomUUID(), userId: request.userId!, createdAt: new Date().toISOString(), messages: [] };
    store.aiSessions.set(session.id, session);
    return reply.code(201).send(session);
  });

  app.post("/v1/ai/sessions/:id/messages", async (request: AuthedRequest, reply) => {
    const { id } = request.params as { id: string };
    const session = store.aiSessions.get(id);
    if (!session || session.userId !== request.userId) {
      return reply.code(404).send({ error: "not_found", message: "Session not found." });
    }
    const body = aiMessageSchema.parse(request.body);
    const profile = store.profiles.get(request.userId!)!;
    const result = runAssistantTurn(request.userId!, body.text, todayInUserTz(profile.locale.timezone));
    if ("error" in result) return reply.code(400).send(result);
    session.messages.push({ role: "user", text: body.text, at: new Date().toISOString() });
    session.messages.push({
      role: "assistant",
      text: result.reply,
      recommendation: result.recommendation,
      toolCalls: result.toolCalls,
      at: new Date().toISOString(),
    });
    return result;
  });

  app.get("/v1/ai/sessions/:id", async (request: AuthedRequest, reply) => {
    const { id } = request.params as { id: string };
    const session = store.aiSessions.get(id);
    if (!session || session.userId !== request.userId) {
      return reply.code(404).send({ error: "not_found" });
    }
    return session;
  });

  // ---- Demo seeder (prototype convenience; removed before real launch) -------------
  app.post("/v1/demo/seed", async () => {
    const email = `demo-${randomBytes(4).toString("hex")}@demo.salary-ai.app`;
    const user = store.createUser(email, "seeded", "seeded", "Demo User");
    const now = new Date().toISOString();
    const profile = emptyProfile(user.id, demoSeedData.currency, now);
    profile.locale = demoSeedData.locale;
    applyProfileUpdate(profile, demoSeedData.profileUpdate, now);
    profile.goals = demoSeedData.goals(profile.currency);
    store.profiles.set(user.id, profile);
    startTrial(user.id, new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000 * 0)); // fresh trial

    const today = todayInUserTz(profile.locale.timezone);
    const categoryByName = Object.fromEntries(profile.categories.map((c) => [c.name, c.id]));
    for (const t of demoSeedData.transactions(today, categoryByName)) {
      createTransaction(profile, t, today);
    }
    const plan = generatePlan(profile, today);
    approvePlan(user.id, plan.id);

    return { token: createSession(user.id), userId: user.id, email, note: "Seeded demo account — data lives in memory." };
  });
}
