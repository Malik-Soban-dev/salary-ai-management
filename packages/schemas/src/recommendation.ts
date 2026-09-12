/**
 * Structured output contract (03_AI_SYSTEM §8).
 *
 * Every AI recommendation is typed JSON the app renders directly — never
 * arbitrary prose. `calculationId` ties any number the model quotes back to a
 * deterministic engine result, and guardrails validate the rest.
 */
import { z } from "zod";

export const recommendationTypeSchema = z.enum([
  "spend_decision", // "Can I afford X?"
  "budget_adjustment",
  "goal_contribution",
  "plan_change",
  "insight", // explanation without a requested action
  "warning",
]);

export const proposedActionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("adjust_category_budget"),
    categoryId: z.string(),
    newPlannedMinor: z.number().int().min(0),
  }),
  z.object({
    kind: z.literal("contribute_to_goal"),
    goalId: z.string(),
    amountMinor: z.number().int().min(1),
  }),
  z.object({
    kind: z.literal("regenerate_plan"),
    period: z.object({ year: z.number().int(), month: z.number().int() }),
  }),
  z.object({ kind: z.literal("none") }),
]);

export const recommendationSchema = z.object({
  recommendation_type: recommendationTypeSchema,
  title: z.string().min(1).max(120),
  explanation: z.string().min(1).max(2000),
  /** Exact figures come from backend calculations, never model arithmetic. */
  amount_minor: z.number().int().nullable().optional(),
  currency: z.string().length(3).nullable().optional(),
  affected_categories: z.array(z.string()).default([]),
  source_metrics: z.record(z.union([z.string(), z.number(), z.boolean()])).default({}),
  confidence: z.number().min(0).max(1),
  user_action_required: z.boolean(),
  proposed_action: proposedActionSchema,
  /** Engine calculation this answer is grounded in (e.g. "safe-to-spend:1.0.0"). */
  calculation_id: z.string().min(1),
  safety_flags: z.array(z.string()).default([]),
});

export type Recommendation = z.infer<typeof recommendationSchema>;

/** Guardrail check list applied to every model output before it reaches the user (03_AI_SYSTEM §9). */
export const GUARDRAIL_RULES = [
  "never_invent_balances",
  "never_claim_uncalculated_numbers",
  "no_secrets_in_context",
  "no_regulated_advice",
  "clarify_when_ambiguous",
  "approval_for_consequential_actions",
] as const;

export type GuardrailRule = (typeof GUARDRAIL_RULES)[number];

/**
 * Validates a model-produced recommendation. Returns a safe fallback when the
 * model output violates the contract so broken output never reaches the UI.
 */
export function validateRecommendation(raw: unknown):
  | { ok: true; value: Recommendation }
  | { ok: false; error: string } {
  const parsed = recommendationSchema.safeParse(raw);
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
}
