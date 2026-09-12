/** Fastify app factory — routes, hooks, static demo, error mapping. */
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import path from "node:path";
import { ZodError } from "zod";
import { registerHooks } from "./hooks.js";
import { registerCoreRoutes } from "./routes/core.js";
import { registerPlatformRoutes } from "./routes/platform.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? "info" },
  });
  await app.register(cors, { origin: true });

  registerHooks(app);
  registerCoreRoutes(app);
  registerPlatformRoutes(app);

  app.get("/health", async () => ({ ok: true, service: "salary-ai-api", time: new Date().toISOString() }));

  // Static demo client (served from apps/api/public when built/present).
  const publicDir = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "public");
  if (existsSync(publicDir)) {
    await app.register(fastifyStatic, { root: publicDir });
  }

  // Domain/error mapping: zod → 400, auth/entitlement handled in hooks.
  app.setErrorHandler((error: unknown, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: "validation_failed",
        message: "Request failed schema validation.",
        issues: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    const err = error as Error & { statusCode?: number };
    const statusCode = err.statusCode ?? 500;
    if (statusCode >= 500) app.log.error(error);
    return reply.code(statusCode).send({
      error: statusCode >= 500 ? "internal_error" : "request_failed",
      message: statusCode >= 500 ? "Something went wrong on our side." : err.message,
    });
  });

  return app;
}
