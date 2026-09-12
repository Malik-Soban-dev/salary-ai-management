/** Hooks: auth, entitlement gate (3-day trial → paid), and light rate limiting. */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getEntitlement, GATED_FEATURE_PREFIXES } from "./billing.js";
import { store } from "./store.js";

const OPEN_PATHS = [
  "/v1/auth/register",
  "/v1/auth/login",
  "/v1/billing/webhook",
  "/health",
];

const GUEST_PATH_PREFIXES = ["/v1/auth/", "/v1/billing/", "/v1/demo/", "/health"];

export function registerHooks(app: FastifyInstance): void {
  app.addHook("preHandler", async (request: FastifyRequest & { userId?: string }, reply: FastifyReply) => {
    const path = request.routeOptions?.url ?? request.url.split("?")[0] ?? request.url;

    if (OPEN_PATHS.includes(path)) return;
    if (!path.startsWith("/v1/")) return; // static assets / demo page

    const isGuestPath = GUEST_PATH_PREFIXES.some((p) => path.startsWith(p));

    // --- Authenticate ---
    const header = request.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : undefined;
    let userId: string | undefined;
    if (token) {
      const session = store.sessions.get(token);
      if (session && session.expiresAt >= Date.now()) {
        userId = session.userId;
        (request as AuthedRequest).sessionToken = token;
      }
    }

    // Guest paths (auth, billing, demo, health) work with or without a session.
    if (isGuestPath) {
      if (userId) (request as AuthedRequest).userId = userId;
      return;
    }

    if (!userId) {
      reply.code(401).send({ error: "unauthenticated", message: "Sign in to continue." });
      return;
    }

    (request as AuthedRequest).userId = userId;

    // --- Entitlement gate (server-authoritative; never the client clock) ---
    const entitlement = getEntitlement(userId);
    if (entitlement.state === "expired" && GATED_FEATURE_PREFIXES.some((p) => path.startsWith(p))) {
      reply.code(402).send({
        error: "payment_required",
        message: "Your 3-day trial has ended. Subscribe to continue using Salary AI — your data is safe.",
        billing: entitlement,
      });
    }
  });
}

export interface AuthedRequest extends FastifyRequest {
  userId?: string;
  sessionToken?: string;
}
