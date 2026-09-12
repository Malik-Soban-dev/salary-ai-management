/**
 * Auth — scrypt password hashing + opaque bearer sessions.
 *
 * Fast to ship for the prototype; the interface mirrors what Supabase Auth
 * provides so it can be swapped without touching domain services (04_ARCH §1).
 * Sessions are server-side and revocable; tokens never carry authority themselves.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { store } from "./store.js";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt ?? randomBytes(16).toString("hex");
  const hash = scryptSync(password, s, 64).toString("hex");
  return { hash, salt: s };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function createSession(userId: string): string {
  const token = randomBytes(32).toString("hex");
  store.sessions.set(token, { userId, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

export function revokeSession(token: string): void {
  store.sessions.delete(token);
}

export interface AuthedRequest extends FastifyRequest {
  userId?: string;
  sessionToken?: string;
}

export function requireAuth(request: AuthedRequest, reply: FastifyReply): string | null {
  const header = request.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    reply.code(401).send({ error: "unauthenticated", message: "Missing bearer token." });
    return null;
  }
  const session = store.sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    store.sessions.delete(token);
    reply.code(401).send({ error: "unauthenticated", message: "Session expired. Sign in again." });
    return null;
  }
  request.userId = session.userId;
  request.sessionToken = token;
  return session.userId;
}
