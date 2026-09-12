/**
 * Billing — 3-day trial → paid subscription, server-authoritative (00_HANDOFF §2B).
 *
 * The client clock is never consulted for entitlements. Trial/subscription
 * state lives in a separate service from the finance ledger, and pricing,
 * currency and providers stay market-configurable. The "mock" provider stands
 * in for app-store/web billing until a real provider integration is reviewed.
 */
import { store } from "./store.js";

export const TRIAL_DAYS = 3;
export const DEFAULT_PLAN_ID = "pro-monthly";

export function startTrial(userId: string, now: Date = new Date()): void {
  const trialStartAt = now;
  const trialEndAt = new Date(trialStartAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  store.subscriptions.set(userId, {
    userId,
    provider: "mock",
    planId: DEFAULT_PLAN_ID,
    trialStartAt: trialStartAt.toISOString(),
    trialEndAt: trialEndAt.toISOString(),
    status: "trialing",
  });
}

export type EntitlementState =
  | { state: "trialing"; trialEndsAt: string; daysRemaining: number; planId: string }
  | { state: "active"; planId: string; renewsAt?: string; provider: string }
  | { state: "expired"; trialEndedAt: string; planId: string };

export function getEntitlement(userId: string, now: Date = new Date()): EntitlementState {
  const sub = store.subscriptions.get(userId);
  if (!sub) return { state: "expired", trialEndedAt: now.toISOString(), planId: DEFAULT_PLAN_ID };

  if (sub.status === "active") {
    if (sub.renewalAt && new Date(sub.renewalAt) < now) {
      sub.status = "expired";
      return { state: "expired", trialEndedAt: sub.trialEndAt, planId: sub.planId };
    }
    return { state: "active", planId: sub.planId, renewsAt: sub.renewalAt, provider: sub.provider };
  }

  if (sub.status === "trialing") {
    if (new Date(sub.trialEndAt) > now) {
      const daysRemaining = Math.max(
        0,
        Math.ceil((new Date(sub.trialEndAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
      );
      return { state: "trialing", trialEndsAt: sub.trialEndAt, daysRemaining, planId: sub.planId };
    }
    sub.status = "expired";
  }
  return { state: "expired", trialEndedAt: sub.trialEndAt, planId: sub.planId };
}

export function activateSubscription(userId: string, planId: string, provider: string, now: Date = new Date()): void {
  const renewal = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const existing = store.subscriptions.get(userId);
  store.subscriptions.set(userId, {
    userId,
    provider: provider as "mock",
    planId,
    trialStartAt: existing?.trialStartAt ?? now.toISOString(),
    trialEndAt: existing?.trialEndAt ?? now.toISOString(),
    status: "active",
    renewalAt: renewal.toISOString(),
    providerReference: `mock_${randomSuffix()}`,
  });
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Features that require a paid entitlement; billing/profile/data routes stay open. */
export const GATED_FEATURE_PREFIXES = [
  "/v1/month-plans",
  "/v1/safe-to-spend",
  "/v1/transactions",
  "/v1/goals",
  "/v1/insights",
  "/v1/ai",
  "/v1/imports",
];
