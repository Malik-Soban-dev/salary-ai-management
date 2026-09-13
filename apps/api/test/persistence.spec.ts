import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { store } from "../src/store.js";
import { saveSnapshot, loadSnapshot } from "../src/persistence.js";

function wipe() {
  store.users.clear();
  store.usersByEmail.clear();
  store.sessions.clear();
  store.profiles.clear();
  store.subscriptions.clear();
  store.transactions.clear();
  store.plans.clear();
  store.aiSessions.clear();
  store.auditLog.length = 0;
}

describe("persistence", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "sai-persist-"));
    wipe();
    return () => rmSync(dir, { recursive: true, force: true });
  });

  it("returns false when no snapshot exists", () => {
    expect(loadSnapshot(dir)).toBe(false);
  });

  it("round-trips every store collection", () => {
    const user = store.createUser("Pilot@Test.com", "hash", "salt", "Pilot");
    store.sessions.set("tok-1", { userId: user.id, expiresAt: 999 });
    store.profiles.set(user.id, {
      userId: user.id, currency: "PKR",
      locale: { countryCode: "PK", language: "en", timezone: "Asia/Karachi", weekStart: 1 },
      incomeSources: [], commitments: [],
      categories: [{ id: "cat-groceries", name: "Groceries", kind: "flexible", baselineWeight: 4 }],
      emergency: { currentAmountMinor: 1, targetAmountMinor: 2 },
      preferences: { savingsStyle: "balanced", buffer: { kind: "percent_of_income", value: 5 }, bufferBeforeGoals: false },
      goals: [], createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
    });
    store.subscriptions.set(user.id, {
      userId: user.id, provider: "mock", planId: "pro-monthly",
      trialStartAt: "2026-01-01T00:00:00Z", trialEndAt: "2026-01-04T00:00:00Z", status: "trialing",
    });
    store.transactionsOf(user.id).push({
      id: "tx-1", amount: 95000, currency: "PKR", merchant: "Shell", date: "2026-01-05",
      categoryId: "cat-transport", source: "text", confidence: 0.8,
    } as never);
    store.plansOf(user.id).push({
      id: "plan-1", status: "draft", period: { year: 2026, month: 1 }, currency: "PKR",
    } as never);
    store.aiSessions.set("ai-1", { id: "ai-1", userId: user.id, createdAt: "2026-01-05T00:00:00Z", messages: [] });
    store.auditLog.push({ at: "2026-01-05T00:00:00Z", userId: user.id, action: "test", details: {} });

    saveSnapshot(dir);
    wipe();
    expect(loadSnapshot(dir)).toBe(true);

    expect(store.users.get(user.id)?.email).toBe("pilot@test.com");
    expect(store.usersByEmail.get("pilot@test.com")?.id).toBe(user.id);
    expect(store.sessions.get("tok-1")?.userId).toBe(user.id);
    expect(store.profiles.get(user.id)?.currency).toBe("PKR");
    expect(store.subscriptions.get(user.id)?.status).toBe("trialing");
    expect(store.transactionsOf(user.id)[0]?.merchant).toBe("Shell");
    expect(store.plansOf(user.id)[0]?.id).toBe("plan-1");
    expect(store.aiSessions.get("ai-1")?.userId).toBe(user.id);
    expect(store.auditLog).toHaveLength(1);
  });

  it("saveSnapshot is atomic-shaped (no tmp file left behind)", () => {
    saveSnapshot(dir);
    expect(loadSnapshot(dir)).toBe(true);
  });
});
