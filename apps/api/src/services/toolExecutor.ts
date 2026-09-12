/**
 * Tool executor — the model's only way to touch user data.
 * Read tools return engine-computed facts; write tools return DRAFTS with
 * `requires_approval: true` (nothing consequential is ever applied by the model
 * directly — 03_AI_SYSTEM §7, engineering rule 5).
 */
import type { ToolName } from "@salary-ai/schemas";
import { periodOf } from "@salary-ai/finance-engine";
import { store, type FinancialProfile } from "../store.js";
import { safeToSpend, upcomingObligations } from "./planService.js";
import { monthlyInsights } from "./insightService.js";
import { projectGoal } from "@salary-ai/finance-engine";
import { parseTransactionText } from "./ledgerService.js";

export async function executeTool(
  name: ToolName,
  args: unknown,
  ctx: { profile: FinancialProfile; today: string; period: ReturnType<typeof periodOf> },
): Promise<unknown> {
  const { profile, today, period } = ctx;
  switch (name) {
    case "get_month_plan": {
      const a = args as { period?: { year: number; month: number } };
      const plan = store.currentPlan(profile.userId, a.period ?? period);
      return plan
        ? {
            period: plan.period,
            status: plan.status,
            totals: plan.totals,
            allocations: plan.allocations,
            warnings: plan.warnings,
            adaptations: plan.adaptations ?? [],
            calculationVersion: plan.calculationVersion,
          }
        : { plan: null, note: "No plan exists for this period yet." };
    }
    case "get_safe_to_spend": {
      const { safeToSpend: sts } = safeToSpend(profile, today);
      if (sts) return sts;
      const expected = profile.incomeSources.reduce((acc, s) => acc + s.expectedAmountMinor, 0);
      const essentials = upcomingObligations(profile, today, period).reduce((a, o) => a + o.amountMinor, 0);
      return {
        estimated: true,
        availableNowMinor: Math.max(0, expected - essentials),
        note: "Estimated — no approved plan for this period.",
      };
    }
    case "get_category_status": {
      const a = args as { categoryId: string };
      const insights = monthlyInsights(profile, today);
      const line = insights.variance?.lines.find((l) => l.categoryId === a.categoryId);
      return line ?? { error: "No budget line for that category this period." };
    }
    case "list_upcoming_obligations": {
      const a = args as { withinDays?: number };
      const list = upcomingObligations(profile, today, period);
      void a;
      return { obligations: list };
    }
    case "get_goal_projection": {
      const a = args as { goalId: string };
      const goal = profile.goals.find((g) => g.id === a.goalId);
      if (!goal) return { error: "Goal not found." };
      const plan = store.currentPlan(profile.userId, period);
      return projectGoal({
        goal: {
          id: goal.id,
          targetAmountMinor: goal.targetAmountMinor,
          savedAmountMinor: goal.savedAmountMinor,
          targetDate: goal.targetDate?.slice(0, 7),
          priority: goal.priority,
        },
        period,
        plannedMonthlyContributionMinor:
          plan?.allocations.goals.find((x) => x.goalId === goal.id)?.planned.amountMinor ?? 0,
      });
    }
    case "search_transactions": {
      const a = args as { query?: string; categoryId?: string; limit?: number };
      const q = (a.query ?? "").toLowerCase();
      let list = store.transactionsOf(profile.userId);
      if (a.categoryId) list = list.filter((t) => t.categoryId === a.categoryId);
      if (q) list = list.filter((t) => t.merchant.toLowerCase().includes(q) || (t.notes ?? "").toLowerCase().includes(q));
      return {
        transactions: [...list]
          .sort((x, y) => y.date.localeCompare(x.date))
          .slice(0, Math.min(50, a.limit ?? 20))
          .map((t) => ({ id: t.id, date: t.date, merchant: t.merchant, amountMinor: t.amount.amountMinor, categoryId: t.categoryId })),
      };
    }
    case "classify_transaction": {
      const a = args as { text: string };
      return parseTransactionText(a.text, today);
    }
    case "propose_budget_adjustment": {
      const a = args as { categoryId: string; newPlannedMinor: number; reason: string };
      const category = profile.categories.find((c) => c.id === a.categoryId);
      if (!category) return { error: "Category not found.", requires_approval: false };
      return {
        status: "draft",
        requires_approval: true,
        draft: { kind: "adjust_category_budget", categoryId: a.categoryId, categoryName: category.name, newPlannedMinor: a.newPlannedMinor, reason: a.reason },
      };
    }
    case "create_goal_draft": {
      const a = args as { name: string; targetAmountMinor: number; targetDate?: string; priority?: number };
      return {
        status: "draft",
        requires_approval: true,
        draft: { kind: "create_goal", name: a.name, targetAmountMinor: a.targetAmountMinor, targetDate: a.targetDate, priority: a.priority ?? 3 },
      };
    }
    case "create_plan_draft": {
      const a = args as { period: { year: number; month: number }; reason?: string };
      return {
        status: "draft",
        requires_approval: true,
        draft: { kind: "regenerate_plan", period: a.period, reason: a.reason },
      };
    }
  }
}
