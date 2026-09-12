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

/**
 * OpenAI function-calling definitions. These mirror `toolSchemas` (zod remains
 * the runtime validator on every call — a mismatch fails validation safely).
 * Keep both in sync; `TOOL_JSON_SCHEMA_STALE` is guarded by a unit test on the
 * tool-name list.
 */
const periodJson = {
  type: "object" as const,
  properties: { year: { type: "integer" }, month: { type: "integer", minimum: 1, maximum: 12 } },
  required: ["year", "month"],
};

export const toolJsonSchemas: Record<ToolName, { description: string; parameters: Record<string, unknown> }> = {
  get_month_plan: {
    description: "Get the user's monthly salary plan (allocations, totals, warnings) for a period; defaults to the current period.",
    parameters: {
      type: "object",
      properties: { period: periodJson },
    },
  },
  get_safe_to_spend: {
    description: "Get the current safe-to-spend number: remaining flexible money, reserved obligations, daily recommendation.",
    parameters: { type: "object", properties: {} },
  },
  get_category_status: {
    description: "Get planned vs actual for one spending category this period.",
    parameters: {
      type: "object",
      properties: { categoryId: { type: "string" }, period: periodJson },
      required: ["categoryId"],
    },
  },
  list_upcoming_obligations: {
    description: "List upcoming essential obligations (bills, rent, commitments) with amounts and due days.",
    parameters: {
      type: "object",
      properties: { withinDays: { type: "integer", minimum: 1, maximum: 60, default: 14 } },
    },
  },
  get_goal_projection: {
    description: "Get a goal's required monthly pace, projected completion and on-track status.",
    parameters: {
      type: "object",
      properties: { goalId: { type: "string" } },
      required: ["goalId"],
    },
  },
  search_transactions: {
    description: "Search the user's recent transactions by text and/or category.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", maxLength: 200, default: "" },
        categoryId: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
      },
    },
  },
  classify_transaction: {
    description: "Parse free text (e.g. 'Spent 950 on dinner') into a structured transaction draft with category guess and confidence.",
    parameters: {
      type: "object",
      properties: { text: { type: "string", minLength: 1, maxLength: 500 } },
      required: ["text"],
    },
  },
  propose_budget_adjustment: {
    description: "Propose changing a category's planned monthly budget. Creates a draft for user approval; does not apply it.",
    parameters: {
      type: "object",
      properties: {
        categoryId: { type: "string" },
        newPlannedMinor: { type: "integer", minimum: 0 },
        reason: { type: "string", minLength: 1, maxLength: 500 },
      },
      required: ["categoryId", "newPlannedMinor", "reason"],
    },
  },
  create_goal_draft: {
    description: "Draft a new savings goal for user approval; does not create it.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", maxLength: 80 },
        targetAmountMinor: { type: "integer", minimum: 1 },
        targetDate: { type: "string", pattern: "^\\d{4}-\\d{2}(-\\d{2})?$" },
        priority: { type: "integer", minimum: 1, maximum: 9, default: 3 },
      },
      required: ["name", "targetAmountMinor"],
    },
  },
  create_plan_draft: {
    description: "Draft a regenerated monthly plan for user approval; does not apply it.",
    parameters: {
      type: "object",
      properties: { period: periodJson, reason: { type: "string", maxLength: 500 } },
      required: ["period"],
    },
  },
};

export function openAiToolsDefinition() {
  return TOOL_NAMES.map((name) => ({
    type: "function" as const,
    function: { name, ...toolJsonSchemas[name] },
  }));
}
