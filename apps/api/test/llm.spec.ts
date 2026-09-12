/**
 * LLM provider tests with a scripted fake fetch — verifies the tool loop
 * (arguments validated, tools executed against engine data) and the guardrail
 * fallback when the model returns invalid output. No real network access.
 */
import { describe, expect, it, beforeAll } from "vitest";
import { emptyProfile, store } from "../src/store.js";
import { OpenAiCompatibleProvider, extractJson, SYSTEM_PROMPT } from "../src/services/llm.js";
import { LocalGroundedProvider } from "../src/services/assistant.js";
import type { AiProvider, AssistantTurnInput } from "../src/services/assistant.js";
import { periodOf } from "@salary-ai/finance-engine";

const TODAY = "2026-09-12";

function chatResponse(message: { content?: string | null; tool_calls?: unknown[] }) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message }] }),
  } as unknown as Response;
}

describe("OpenAiCompatibleProvider", () => {
  const profile = emptyProfile("llm-test-user", "PKR", "2026-09-01T00:00:00Z");
  profile.incomeSources = [
    { id: "i1", name: "Salary", expectedAmountMinor: 15_000_000, currency: "PKR", frequency: "monthly", paydayRule: { kind: "day_of_month", day: 1 }, reliability: "stable" },
  ];
  beforeAll(() => {
    store.profiles.set(profile.userId, profile);
  });

  const turnInput = (text: string): AssistantTurnInput => ({
    profile,
    text,
    today: TODAY,
    period: periodOf(TODAY),
  });

  function provider(script: Array<Response>, fallback: AiProvider) {
    let call = 0;
    return new OpenAiCompatibleProvider({
      baseUrl: "https://fake-llm.test/v1",
      apiKey: "test-key",
      model: "test-model",
      fallback,
      fetchImpl: (() => Promise.resolve(script[Math.min(call++, script.length - 1)]!)) as typeof fetch,
    });
  }

  it("runs the tool loop and grounds the final answer in a validated recommendation", async () => {
    const scripted = provider(
      [
        chatResponse({
          content: null,
          tool_calls: [{ id: "c1", type: "function", function: { name: "get_safe_to_spend", arguments: "{}" } }],
        }),
        chatResponse({
          content: JSON.stringify({
            recommendation_type: "spend_decision",
            title: "Fits your flexible money",
            explanation: "Yes — Rs 2,000 fits within your remaining flexible money.",
            amount_minor: 200000,
            currency: "PKR",
            affected_categories: [],
            source_metrics: {},
            confidence: 0.9,
            user_action_required: false,
            proposed_action: { kind: "none" },
            calculation_id: "safe-to-spend:1.0.0",
            safety_flags: [],
          }),
        }),
      ],
      new LocalGroundedProvider(),
    );

    const result = await scripted.respond(turnInput("Can I spend 2000 on dinner?"));
    expect(result.provider).toBe("openai-compatible");
    expect(result.toolCalls).toEqual([{ name: "get_safe_to_spend", arguments: {} }]);
    expect(result.recommendation.recommendation_type).toBe("spend_decision");
    expect(result.recommendation.calculation_id).toBe("safe-to-spend:1.0.0");
  });

  it("falls back to the grounded provider when the model output fails validation", async () => {
    const scripted = provider(
      [chatResponse({ content: "I think you should totally do it, trust me!" })],
      new LocalGroundedProvider(),
    );
    const result = await scripted.respond(turnInput("Should I move all my money to crypto?"));
    expect(result.provider).toBe("local-grounded-v1"); // fallback engaged
  });

  it("falls back when the provider is unreachable", async () => {
    const failing = new OpenAiCompatibleProvider({
      baseUrl: "https://unreachable.test",
      apiKey: "k",
      model: "m",
      fallback: new LocalGroundedProvider(),
      fetchImpl: (() => Promise.reject(new Error("ECONNREFUSED"))) as typeof fetch,
      timeoutMs: 200,
    });
    const result = await failing.respond(turnInput("How is my month going?"));
    expect(result.provider).toBe("local-grounded-v1");
  });

  it("validates tool arguments and reports errors back to the model", async () => {
    let capturedBody: { messages?: Array<{ role: string; content: string | null }> } | undefined;
    const responses: Response[] = [
      chatResponse({
        content: null,
        tool_calls: [
          { id: "c1", type: "function", function: { name: "get_goal_projection", arguments: JSON.stringify({ wildly: "wrong" }) } },
        ],
      }),
      chatResponse({
        content: JSON.stringify({
          recommendation_type: "insight",
          title: "Checked",
          explanation: "The tool arguments were rejected.",
          confidence: 0.5,
          user_action_required: false,
          proposed_action: { kind: "none" },
          calculation_id: "none",
          affected_categories: [],
          source_metrics: {},
          currency: null,
          amount_minor: null,
          safety_flags: [],
        }),
      }),
    ];
    let call = 0;
    const p = new OpenAiCompatibleProvider({
      baseUrl: "https://fake.test",
      apiKey: "k",
      model: "m",
      fallback: new LocalGroundedProvider(),
      fetchImpl: (async (_url, init) => {
        capturedBody = JSON.parse((init?.body as string) ?? "{}");
        return responses[Math.min(call++, responses.length - 1)]!;
      }) as typeof fetch,
    });
    const result = await p.respond(turnInput("What about my goal?"));
    expect(result.provider).toBe("openai-compatible");
    // The tool error must have been fed back as a tool message before the final answer.
    const toolMessages = capturedBody?.messages?.filter((m) => m.role === "tool") ?? [];
    expect(toolMessages.length).toBe(1);
    expect(toolMessages[0]!.content).toContain("Invalid arguments");
  });

  it("ships a versioned system prompt with the non-negotiable rules", () => {
    expect(SYSTEM_PROMPT).toContain("Never compute arithmetic yourself");
    expect(SYSTEM_PROMPT).toContain("ONLY a JSON object");
  });

  it("extracts JSON from fenced or prose replies", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Sure! {"a":{"b":2}} hope that helps')).toEqual({ a: { b: 2 } });
    expect(extractJson("no json here")).toBeUndefined();
  });
});
