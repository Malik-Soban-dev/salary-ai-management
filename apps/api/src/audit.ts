/**
 * Append-only audit trail for consequential events (04_ARCH §8):
 * logins, data export/delete, plan approvals, entitlement changes.
 */
import { store } from "./store.js";

export function audit(userId: string, action: string, details: Record<string, unknown> = {}): void {
  store.auditLog.push({ at: new Date().toISOString(), userId, action, details });
}

export function auditFor(userId: string): Array<{ at: string; action: string; details: Record<string, unknown> }> {
  return store.auditLog
    .filter((e) => e.userId === userId)
    .map(({ at, action, details }) => ({ at, action, details }));
}
