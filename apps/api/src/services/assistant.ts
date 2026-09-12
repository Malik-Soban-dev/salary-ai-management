/**
 * Grounded assistant.
 *
 * Architecture (03_AI_SYSTEM §1): deterministic services calculate truth, the
 * assistant interprets and explains. This module ships a *local grounded
 * provider* that answers using engine results only — the product works with the
 * AI provider unavailable (02_UX §11). `OpenAICompatibleProvider` is the seam
 * where a real LLM plugs in with the same tool contract and guardrails.
 */
import { formatMoney } from "@salary-ai/domain";
import { periodOf, projectGoal } from "@salary-ai/finance-engine";
import { parseToolCall, validateRecommendation, type Recommendation } from "@salary-ai/schemas";
import { store, type FinancialProfile } from "../store.js";
import { monthlyInsights } from "./insightService.js";
import { safeToSpend } from "./planService.js";
import { parseTransactionText } from "./ledgerService.js";
import type { PlanPeriod } from "@salary-ai/domain";

export interface AssistantTurnInput {
  profile: FinancialProfile;
  text: string;
  today: string;
  period: PlanPeriod;
}

export interface AssistantTurnResult {
  reply: string;
  recommendation: Recommendation;
  toolCalls: Array<{ name: string; arguments: unknown }>;
  provider: string;
}

export interface AiProvider {
  readonly name: string;
  respond(input: AssistantTurnInput): AssistantTurnResult | Promise<AssistantTurnResult>;
}

// ---------------------------------------------------------------------------
// Local grounded provider — deterministic, engine-backed answers.
// ---------------------------------------------------------------------------

export class LocalGroundedProvider implements AiProvider {
  readonly name = "local-grounded-v1";

  respond(input: AssistantTurnInput): AssistantTurnResult {
    const { profile, text, today, period } = input;
    const toolCalls: Array<{ name: string; arguments: unknown }> = [];
    const lower = text.toLowerCase();

    // Intent 1: "Can I spend X on Y?" → spend decision grounded in safe-to-spend.
    const spendMatch = /(?:can i|should i|may i)\s+(?:spend|buy|afford)\s*(?:rs\.?|pkr|usd|\$)?\s*([0-9][0-9,]*(?:\.[0-9]+)?)?/i.exec(lower)
      ?? /([0-9][0-9,]*(?:\.[0-9]+)?)\s*(?:for|on|pe)\s+/.exec(lower);
    if (spendMatch && /spend|buy|afford|kharch/.test(lower)) {
      const amountMajor = spendMatch[1] ? Number(spendMatch[1].replace(/,/g, "")) : null;
      toolCalls.push({ name: "get_safe_to_spend", arguments: {} });
      const { plan, safeToSpend: sts } = safeToSpend(profile, today);

      if (!amountMajor || !sts) {
        const reply = !plan
          ? "You don't have an approved plan for this month yet. Generate and approve one from the Plan screen, then I can answer spending questions."
          : `Your remaining flexible money is ${formatMoney(sts.availableNow)} — about ${formatMoney(sts.dailyRecommended)}/day for the next ${sts.daysRemaining} days.`;
        return this.finish(reply, spendInsight(reply, profile, sts?.availableNow.amountMinor ?? 0), toolCalls, period);
      }

      const requested = Math.round(amountMajor * 100);
      const after = sts.availableNow.amountMinor - requested;
      const goal = plan.allocations.goals[0];
      let goalImpact = "";
      if (goal) {
        toolCalls.push({ name: "get_goal_projection", arguments: { goalId: goal.goalId } });
        goalImpact = ` This would use about ${Math.round((requested / Math.max(1, sts.availableNow.amountMinor)) * 100)}% of what's left for flexible spending this month.`;
      }
      const affordable = after >= 0;
      const reply = affordable
        ? `Yes — ${formatMoneyFromMajor(amountMajor, profile.currency)} fits. You'd still have about ${formatMoney({ amountMinor: after, currency: profile.currency })} of flexible money after it${goalImpact}.`
        : `Not comfortably. ${formatMoneyFromMajor(amountMajor, profile.currency)} exceeds your ${formatMoney(sts.availableNow)} remaining flexible money${sts.breakdown.reservedForUpcomingObligations.amountMinor > 0 ? `, and ${formatMoney(sts.breakdown.reservedForUpcomingObligations)} is already reserved for upcoming bills` : ""}.`;

      const recommendation: Recommendation = {
        recommendation_type: "spend_decision",
        title: affordable ? "Fits your flexible money" : "Does not fit your flexible money",
        explanation: reply,
        amount_minor: requested,
        currency: profile.currency,
        affected_categories: [],
        source_metrics: {
          available_now_minor: sts.availableNow.amountMinor,
          daily_recommended_minor: sts.dailyRecommended.amountMinor,
          reserved_minor: sts.breakdown.reservedForUpcomingObligations.amountMinor,
        },
        confidence: 0.95,
        user_action_required: !affordable,
        proposed_action: { kind: "none" },
        calculation_id: `safe-to-spend:${sts.calculationVersion}`,
        safety_flags: [],
      };
      return { reply, recommendation, toolCalls, provider: this.name };
    }

    // Intent 2: category status — "how much is left for food?"
    const categoryMatch = profile.categories.find((c) => lower.includes(c.name.toLowerCase()));
    if (categoryMatch && /left|remaining|budget|status|kitna/i.test(text)) {
      toolCalls.push({ name: "get_category_status", arguments: { categoryId: categoryMatch.id } });
      const insights = monthlyInsights(profile, today);
      const line = insights.variance?.lines.find((l) => l.categoryId === categoryMatch.id);
      if (line) {
        const remaining = Math.max(0, line.planned.amountMinor - line.actual.amountMinor);
        const reply = `${categoryMatch.name}: planned ${formatMoney(line.planned)}, spent ${formatMoney(line.actual)} — ${formatMoney({ amountMinor: remaining, currency: profile.currency })} left${line.status === "over" ? " (you are over target; the plan can adjust next month)" : ""}.`;
        return this.finish(
          reply,
          {
            recommendation_type: "insight",
            title: `${categoryMatch.name} budget status`,
            explanation: reply,
            amount_minor: remaining,
            currency: profile.currency,
            affected_categories: [categoryMatch.id],
            source_metrics: { percent_used: line.percentUsed, status: line.status },
            confidence: 0.95,
            user_action_required: false,
            proposed_action: { kind: "none" },
            calculation_id: `variance:${insights.variance?.calculationVersion ?? "1.0.0"}`,
            safety_flags: [],
          },
          toolCalls,
          period,
        );
      }
    }

    // Intent 3: parse helper — "log 950 dinner" style drafts (no auto-persist).
    const parsed = parseTransactionText(text, today);
    if (parsed.amountMajor != null && /spent|spend|paid|kharch|buy/i.test(text)) {
      const catName = profile.categories.find((c) => c.id === parsed.categoryId)?.name;
      const reply = `I read that as ${formatMoneyFromMajor(parsed.amountMajor, profile.currency)} • ${parsed.merchantGuess}${catName ? ` • ${catName}` : " • category uncertain"}. Add it from the Transactions screen${parsed.confidence < 0.5 ? " — please confirm the category so I learn" : ""}.`;
      return this.finish(
        reply,
        {
          recommendation_type: "insight",
          title: "Transaction draft",
          explanation: reply,
          amount_minor: Math.round(parsed.amountMajor * 100),
          currency: profile.currency,
          affected_categories: parsed.categoryId ? [parsed.categoryId] : [],
          source_metrics: { parser_confidence: parsed.confidence },
          confidence: parsed.confidence,
          user_action_required: true,
          proposed_action: { kind: "none" },
          calculation_id: "parser:1.0.0",
          safety_flags: ["clarify_when_ambiguous"],
        },
        toolCalls,
        period,
      );
    }

    // Default: month overview from structured facts.
    const insights = monthlyInsights(profile, today);
    const parts: string[] = [];
    if (insights.safeToSpend) {
      parts.push(`You have ${formatMoney(insights.safeToSpend.availableNow)} of flexible money left (${formatMoney(insights.safeToSpend.dailyRecommended)}/day).`);
    }
    if (insights.overspending.length > 0) {
      parts.push(`${insights.overspending[0]!.name} is trending over target.`);
    }
    parts.push(
      insights.emergency.essentialsCoverageMonths > 0
        ? `Your emergency fund covers ${insights.emergency.essentialsCoverageMonths} months of essentials.`
        : "Add your emergency fund target so I can plan contributions.",
    );
    const reply = parts.join(" ");
    return this.finish(
      reply,
      {
        recommendation_type: "insight",
        title: "This month at a glance",
        explanation: reply,
        currency: profile.currency,
        amount_minor: insights.safeToSpend?.availableNow.amountMinor ?? null,
        affected_categories: [],
        source_metrics: { has_plan: insights.hasPlan },
        confidence: 0.9,
        user_action_required: false,
        proposed_action: { kind: "none" },
        calculation_id: `engine:insights:${insights.emergency.calculationVersion}`,
        safety_flags: [],
      },
      toolCalls,
      period,
    );
  }

  private finish(
    reply: string,
    recommendation: Recommendation,
    toolCalls: Array<{ name: string; arguments: unknown }>,
    _period: PlanPeriod,
  ): AssistantTurnResult {
    return { reply, recommendation, toolCalls, provider: this.name };
  }
}

function spendInsight(reply: string, profile: FinancialProfile, availableMinor: number): Recommendation {
  return {
    recommendation_type: "insight",
    title: "Flexible money status",
    explanation: reply,
    amount_minor: availableMinor,
    currency: profile.currency,
    affected_categories: [],
    source_metrics: {},
    confidence: 0.9,
    user_action_required: false,
    proposed_action: { kind: "none" },
    calculation_id: "safe-to-spend:1.0.0",
    safety_flags: [],
  };
}

function formatMoneyFromMajor(major: number, currency: string): string {
  return formatMoney({ amountMinor: Math.round(major * 100), currency });
}

// ---------------------------------------------------------------------------
// OpenAI-compatible adapter (services/llm.ts): real tool loop against the typed
// tool contract, structured-output validation, fallback to the grounded local
// provider on any failure. Inactive without AI_BASE_URL/AI_API_KEY/AI_MODEL.
// ---------------------------------------------------------------------------

export { OpenAiCompatibleProvider } from "./llm.js";
import { OpenAiCompatibleProvider } from "./llm.js";
export { SYSTEM_PROMPT, PROMPT_VERSION } from "./llm.js";

/** Provider selection at startup: env-configured LLM if present, local otherwise. */
export function selectProvider(): AiProvider {
  const local = new LocalGroundedProvider();
  const baseUrl = process.env.AI_BASE_URL;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;
  if (baseUrl && apiKey && model) {
    return new OpenAiCompatibleProvider({ baseUrl, apiKey, model, fallback: local });
  }
  return local;
}

export const aiProvider: AiProvider = selectProvider();

export async function runAssistantTurn(userId: string, text: string, today: string): Promise<AssistantTurnResult | { error: string }> {
  const profile = store.profiles.get(userId);
  if (!profile) return { error: "Profile not found." };
  const period = periodOf(today);
  const result = await aiProvider.respond({ profile, text, today, period });
  const checked = validateRecommendation(result.recommendation);
  if (!checked.ok) {
    // Guardrail: broken model output never reaches the UI.
    return {
      reply: "I couldn't produce a reliable answer for that. Please try rephrasing.",
      recommendation: {
        recommendation_type: "warning",
        title: "Answer unavailable",
        explanation: "The assistant response failed validation and was blocked.",
        affected_categories: [],
        source_metrics: { error: checked.error },
        confidence: 0,
        user_action_required: false,
        proposed_action: { kind: "none" },
        calculation_id: "guardrail:validation",
        safety_flags: ["output_validation_failed"],
      },
      toolCalls: result.toolCalls,
      provider: result.provider,
    };
  }
  return { ...result, recommendation: checked.value };
}
