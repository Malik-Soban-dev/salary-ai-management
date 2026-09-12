/**
 * OpenAI-compatible tool-loop provider.
 *
 * Implementation of the seam described in 03_AI_SYSTEM: the model consumes a
 * compact, retrieved context block, may call typed tools (validated by zod via
 * `parseToolCall`), and must finish with a JSON `Recommendation` that passes
 * `validateRecommendation`. Any failure — network, tool misuse, invalid
 * output — falls back to the grounded local provider so the user never sees a
 * broken or ungrounded answer.
 *
 * Prompt is versioned: see docs/prompts/assistant-system.md and PROMPT_VERSION
 * here; changes require an eval fixture (08_BUILD "WHEN ASKED TO IMPLEMENT AI").
 */
import type { Recommendation } from "@salary-ai/schemas";
import { openAiToolsDefinition, parseToolCall, validateRecommendation, type ToolName } from "@salary-ai/schemas";
import type { AiProvider, AssistantTurnInput, AssistantTurnResult } from "./assistant.js";
import { executeTool } from "./toolExecutor.js";
import { store } from "../store.js";
import { safeToSpend, upcomingObligations } from "./planService.js";

export const PROMPT_VERSION = "v1";

export const SYSTEM_PROMPT = `You are the Salary AI assistant (${PROMPT_VERSION}). You help one person understand and act on their monthly salary plan.

CONTEXT: A JSON block of retrieved, user-specific facts from the deterministic finance engine is provided. It is the only source of financial truth available to you.

RULES:
1. Use only facts from the context block or tool results. Never compute arithmetic yourself; never invent balances, transactions, bills, goals or rates. Quote numbers exactly as provided.
2. You may call tools to retrieve more facts. At most 3 tool rounds. Read tools are safe; write tools only create drafts the user must approve.
3. Never give regulated investment, tax or legal advice; explain options grounded in the user's data and suggest professional review where relevant.
4. Tone: calm, specific, non-judgmental. Numbers first, explanation second, action third. Show uncertainty as ranges when confidence is low.
5. FINAL ANSWER FORMAT: respond with ONLY a JSON object (no markdown fence, no prose) matching exactly:
{"recommendation_type":"spend_decision|budget_adjustment|goal_contribution|plan_change|insight|warning","title":"...","explanation":"...","amount_minor":<int|null>,"currency":"<ISO code|null>","affected_categories":[],"source_metrics":{},"confidence":<0..1>,"user_action_required":<bool>,"proposed_action":{"kind":"none"} or {"kind":"adjust_category_budget","categoryId":"...","newPlannedMinor":<int>} or {"kind":"contribute_to_goal","goalId":"...","amountMinor":<int>} or {"kind":"regenerate_plan","period":{"year":<int>,"month":<int>}},"calculation_id":"<the engine calculation your numbers come from, e.g. safe-to-spend:1.0.0>","safety_flags":[]}`;

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
};

/** Compact retrieved facts — only what the turn needs, nothing sensitive beyond the user's own finance data. */
export function buildContextBlock(input: AssistantTurnInput): string {
  return JSON.stringify(buildFacts(input.profile, input.today, input.period));
}

function buildFacts(profile: AssistantTurnInput["profile"], today: string, period: AssistantTurnInput["period"]) {
  const plan = store.currentPlan(profile.userId, period);
  const stsResult = safeToSpend(profile, today);
  const goals = profile.goals
    .filter((g) => g.status === "active")
    .slice(0, 6)
    .map((g) => ({
      id: g.id,
      name: g.name,
      targetMinor: g.targetAmountMinor,
      savedMinor: g.savedAmountMinor,
      targetDate: g.targetDate,
      priority: g.priority,
    }));
  return {
    today,
    period,
    currency: profile.currency,
    incomeMonthlyMinor: profile.incomeSources.reduce((a, s) => a + s.expectedAmountMinor, 0),
    plan: plan
      ? {
          status: plan.status,
          totals: Object.fromEntries(
            Object.entries(plan.totals).map(([k, v]) => [k, (v as { amountMinor: number }).amountMinor]),
          ),
          flexible: plan.allocations.flexible.map((f) => ({ id: f.categoryId, name: f.name, plannedMinor: f.planned.amountMinor })),
          calculationVersion: plan.calculationVersion,
        }
      : null,
    safeToSpend: stsResult.safeToSpend
      ? {
          availableNowMinor: stsResult.safeToSpend.availableNow.amountMinor,
          dailyRecommendedMinor: stsResult.safeToSpend.dailyRecommended.amountMinor,
          daysRemaining: stsResult.safeToSpend.daysRemaining,
          reservedMinor: stsResult.safeToSpend.breakdown.reservedForUpcomingObligations.amountMinor,
          calculationVersion: stsResult.safeToSpend.calculationVersion,
        }
      : null,
    upcomingObligations: upcomingObligations(profile, today, period).slice(0, 8),
    goals,
  };
}

export interface OpenAiProviderOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  fallback: AiProvider;
  fetchImpl?: typeof fetch;
  maxToolRounds?: number;
  timeoutMs?: number;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: ChatMessage["tool_calls"];
    };
  }>;
}

export class OpenAiCompatibleProvider implements AiProvider {
  readonly name = "openai-compatible";
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: OpenAiProviderOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async respond(input: AssistantTurnInput): Promise<AssistantTurnResult> {
    try {
      return await this.turn(input);
    } catch {
      // Guardrail: any provider failure degrades to the grounded local answer.
      return this.opts.fallback.respond(input);
    }
  }

  private async turn(input: AssistantTurnInput): Promise<AssistantTurnResult> {
    const maxRounds = this.opts.maxToolRounds ?? 3;
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `FACTS:\n${buildContextBlock(input)}\n\nUSER MESSAGE:\n${input.text}` },
    ];
    const toolCallsUsed: Array<{ name: string; arguments: unknown }> = [];

    for (let round = 0; round < maxRounds + 1; round++) {
      const response = (await this.chat(messages)) ?? {};
      const message = response.choices?.[0]?.message;
      if (!message) break;

      const calls = message.tool_calls ?? [];
      if (calls.length > 0) {
        messages.push({ role: "assistant", content: message.content ?? null, tool_calls: calls });
        for (const call of calls) {
          const parsed = parseToolCall(call.function.name, safeJsonParse(call.function.arguments));
          let resultText: string;
          if (!parsed.ok) {
            resultText = JSON.stringify({ error: parsed.error });
          } else {
            toolCallsUsed.push({ name: parsed.name, arguments: parsed.arguments });
            const toolResult = await executeTool(parsed.name as ToolName, parsed.arguments, input);
            resultText = JSON.stringify(toolResult);
          }
          messages.push({ role: "tool", content: resultText, tool_call_id: call.id });
        }
        continue;
      }

      // No tool calls — expect the final JSON recommendation.
      const candidate = extractJson(message.content ?? "");
      const checked = validateRecommendation(candidate);
      if (checked.ok) {
        return {
          reply: checked.value.explanation,
          recommendation: decorate(checked.value),
          toolCalls: toolCallsUsed,
          provider: this.name,
        };
      }
      break; // invalid final output → fallback
    }

    return this.opts.fallback.respond(input);
  }

  private async chat(messages: ChatMessage[]): Promise<ChatCompletionResponse | undefined> {
    const res = await this.fetchImpl(`${this.opts.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.opts.apiKey}`,
      },
      body: JSON.stringify({
        model: this.opts.model,
        messages,
        tools: openAiToolsDefinition(),
        tool_choice: "auto",
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(this.opts.timeoutMs ?? 20_000),
    });
    if (!res.ok) throw new Error(`AI provider returned ${res.status}`);
    return (await res.json()) as ChatCompletionResponse;
  }
}

function decorate(value: Recommendation): Recommendation {
  return value;
}

/** Pulls the first JSON object out of a model reply (tolerates fences/prose). */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const raw = fenced ? fenced[1]! : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return undefined;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text || "{}");
  } catch {
    return undefined;
  }
}
