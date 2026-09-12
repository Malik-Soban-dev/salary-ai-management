/**
 * AI tool contracts (03_AI_SYSTEM §7).
 *
 * The model may only call these typed tools; arguments are schema-validated at
 * the boundary (engineering rule 2: "All AI tool arguments are schema validated").
 * Write operations create drafts; consequential actions require user approval.
 */
import { z } from "zod";

export const periodSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});

// ---- Read tools -----------------------------------------------------------

export const getMonthPlanArgs = z.object({
  period: periodSchema.optional(), // defaults to current period server-side
});

export const getSafeToSpendArgs = z.object({});

export const getCategoryStatusArgs = z.object({
  categoryId: z.string().min(1),
  period: periodSchema.optional(),
});

export const listUpcomingObligationsArgs = z.object({
  withinDays: z.number().int().min(1).max(60).default(14),
});

export const getGoalProjectionArgs = z.object({
  goalId: z.string().min(1),
});

export const searchTransactionsArgs = z.object({
  query: z.string().max(200).default(""),
  categoryId: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

// ---- Write tools (produce drafts; approval required) ------------------------

export const proposeBudgetAdjustmentArgs = z.object({
  categoryId: z.string().min(1),
  newPlannedMinor: z.number().int().min(0),
  reason: z.string().min(1).max(500),
});

export const createGoalDraftArgs = z.object({
  name: z.string().min(1).max(80),
  targetAmountMinor: z.number().int().min(1),
  targetDate: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/).optional(),
  priority: z.number().int().min(1).max(9).default(3),
});

export const createPlanDraftArgs = z.object({
  period: periodSchema,
  reason: z.string().max(500).optional(),
});

export const classifyTransactionArgs = z.object({
  text: z.string().min(1).max(500),
});

/** Tool registry: name → argument schema. The AI worker enforces this contract. */
export const toolSchemas = {
  get_month_plan: getMonthPlanArgs,
  get_safe_to_spend: getSafeToSpendArgs,
  get_category_status: getCategoryStatusArgs,
  list_upcoming_obligations: listUpcomingObligationsArgs,
  get_goal_projection: getGoalProjectionArgs,
  search_transactions: searchTransactionsArgs,
  classify_transaction: classifyTransactionArgs,
  propose_budget_adjustment: proposeBudgetAdjustmentArgs,
  create_goal_draft: createGoalDraftArgs,
  create_plan_draft: createPlanDraftArgs,
} as const;

export type ToolName = keyof typeof toolSchemas;
export const TOOL_NAMES = Object.keys(toolSchemas) as ToolName[];

export type ToolCallRequest = { name: ToolName; arguments: unknown };

export function parseToolCall(name: string, args: unknown):
  | { ok: true; name: ToolName; arguments: unknown }
  | { ok: false; error: string } {
  if (!(name in toolSchemas)) return { ok: false, error: `Unknown tool: ${name}` };
  const parsed = toolSchemas[name as ToolName].safeParse(args);
  if (!parsed.success) {
    return { ok: false, error: `Invalid arguments for ${name}: ${parsed.error.message}` };
  }
  return { ok: true, name: name as ToolName, arguments: parsed.data };
}
