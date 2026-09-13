/**
 * Optional file persistence for the in-memory store (pilot deployments).
 *
 * The MVP store keeps data in Maps; this module snapshots those Maps to
 * DATA_DIR as JSON on an interval and on graceful shutdown, and reloads on
 * boot. It exists so a single-instance deployment with an attached disk
 * (Render/Railway/Fly volume) survives restarts and redeploys without the
 * full Postgres swap (infra/migrations/000_init.sql remains the target).
 *
 * Enabled only when DATA_DIR is set — local dev, tests and the sandbox demo
 * keep the pure in-memory behavior. Durability window = autosave interval
 * (worst case loses the last few seconds on a hard crash).
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { join } from "node:path";
import { store, type UserRecord, type SubscriptionRecord, type AiSessionRecord } from "./store.js";
import type { FinancialProfile, MonthlyPlan, Transaction } from "@salary-ai/domain";

const SNAPSHOT = "snapshot.json";
const AUTOSAVE_MS = 10_000;

interface Snapshot {
  version: 1;
  savedAt: string;
  users: UserRecord[];
  sessions: Array<{ key: string; userId: string; expiresAt: number }>;
  profiles: Array<{ key: string; value: FinancialProfile }>;
  subscriptions: Array<{ key: string; value: SubscriptionRecord }>;
  transactions: Array<{ key: string; value: Transaction[] }>;
  plans: Array<{ key: string; value: MonthlyPlan[] }>;
  aiSessions: AiSessionRecord[];
  auditLog: Array<{ at: string; userId: string; action: string; details: Record<string, unknown> }>;
}

function serialize(): Snapshot {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    users: [...store.users.values()],
    sessions: [...store.sessions.entries()].map(([key, v]) => ({ key, ...v })),
    profiles: [...store.profiles.entries()].map(([key, value]) => ({ key, value })),
    subscriptions: [...store.subscriptions.entries()].map(([key, value]) => ({ key, value })),
    transactions: [...store.transactions.entries()].map(([key, value]) => ({ key, value })),
    plans: [...store.plans.entries()].map(([key, value]) => ({ key, value })),
    aiSessions: [...store.aiSessions.values()],
    auditLog: [...store.auditLog],
  };
}

function deserialize(raw: Snapshot): void {
  for (const u of raw.users) {
    store.users.set(u.id, u);
    store.usersByEmail.set(u.email, u);
  }
  for (const s of raw.sessions) store.sessions.set(s.key, { userId: s.userId, expiresAt: s.expiresAt });
  for (const p of raw.profiles) store.profiles.set(p.key, p.value);
  for (const s of raw.subscriptions) store.subscriptions.set(s.key, s.value);
  for (const t of raw.transactions) store.transactions.set(t.key, t.value);
  for (const p of raw.plans) store.plans.set(p.key, p.value);
  for (const a of raw.aiSessions) store.aiSessions.set(a.id, a);
  store.auditLog.push(...raw.auditLog);
}

/** Atomic-ish write: temp file + rename so a crash never truncates the snapshot. */
export function saveSnapshot(dir: string): void {
  mkdirSync(dir, { recursive: true });
  const tmp = join(dir, `${SNAPSHOT}.tmp`);
  writeFileSync(tmp, JSON.stringify(serialize()));
  renameSync(tmp, join(dir, SNAPSHOT));
}

/** Load a snapshot into the store. Returns true when one was restored. */
export function loadSnapshot(dir: string): boolean {
  const file = join(dir, SNAPSHOT);
  if (!existsSync(file)) return false;
  deserialize(JSON.parse(readFileSync(file, "utf8")) as Snapshot);
  return true;
}

/** Wire boot + autosave + graceful flush. Returns a disposer. */
export function enablePersistence(dir: string, log: (msg: string) => void = () => {}): () => void {
  const restored = loadSnapshot(dir);
  log(restored ? `persistence: snapshot restored from ${dir}` : `persistence: enabled at ${dir} (fresh)`);
  const timer = setInterval(() => {
    try {
      saveSnapshot(dir);
    } catch (err) {
      log(`persistence: autosave failed: ${String(err)}`);
    }
  }, AUTOSAVE_MS);
  // Installing a SIGTERM handler replaces the default termination, so after
  // flushing we must exit ourselves — otherwise a restart manager (Render,
  // Docker stop) waits for the force-kill timeout.
  const flush = (signal?: NodeJS.Signals) => {
    try {
      saveSnapshot(dir);
    } catch {
      /* best effort on shutdown */
    }
    if (signal) process.exit(0);
  };
  process.on("SIGTERM", flush);
  process.on("SIGINT", flush);
  return () => {
    clearInterval(timer);
    flush();
  };
}
