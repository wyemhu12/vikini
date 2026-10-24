import { describe, it, expect } from "vitest";
import {
  resolveStrataThinkingPlan,
  sanitizeStrataSampling,
  buildStrataRequestBody,
  STRATA_SAMPLING_PRESETS,
} from "./strataThinking";

describe("strataThinking", () => {
  it("maps 'off' to reasoningEffort 'none' and non-thinking sampling (TC-1)", () => {
    const plan = resolveStrataThinkingPlan("off");
    expect(plan).toEqual({
      level: "off",
      thinking: false,
      reasoningEffort: "none",
      reasoningBudgetTokens: 0,
      answerReserveTokens: 4096,
      maxTokens: 4096,
      promptBudgetTokens: 28152,
      sampling: {
        temperature: 0.7,
        top_p: 0.8,
        top_k: 20,
      },
    });
  });

  it("maps 'low' to reasoningEffort 'low' and 4096 reasoningBudgetTokens (TC-2)", () => {
    const plan = resolveStrataThinkingPlan("low");
    expect(plan.level).toBe("low");
    expect(plan.thinking).toBe(true);
    expect(plan.reasoningEffort).toBe("low");
    expect(plan.reasoningBudgetTokens).toBe(4096);
    expect(plan.maxTokens).toBe(6144);
    expect(plan.sampling).toEqual({
      temperature: 1.0,
      top_p: 0.95,
      top_k: 20,
      min_p: 0,
    });
  });

  it("maps 'medium' to reasoningEffort 'medium' and 8192 reasoningBudgetTokens (TC-3)", () => {
    const plan = resolveStrataThinkingPlan("medium");
    expect(plan.level).toBe("medium");
    expect(plan.reasoningEffort).toBe("medium");
    expect(plan.reasoningBudgetTokens).toBe(8192);
    expect(plan.maxTokens).toBe(11264);
  });

  it("maps 'high' to reasoningEffort 'high' and 12288 reasoningBudgetTokens (TC-4)", () => {
    const plan = resolveStrataThinkingPlan("high");
    expect(plan.level).toBe("high");
    expect(plan.reasoningEffort).toBe("high");
    expect(plan.reasoningBudgetTokens).toBe(12288);
    expect(plan.maxTokens).toBe(16384);
  });

  it("coerces 'minimal' to 'low' and undefined/unknown to 'off' (TC-5, TC-6)", () => {
    expect(resolveStrataThinkingPlan("minimal").level).toBe("low");
    expect(resolveStrataThinkingPlan(undefined).level).toBe("off");
    expect(resolveStrataThinkingPlan("unknown").level).toBe("off");
  });

  it("builds flat OpenAI-compatible payload with top_k, min_p, reasoning_budget_tokens, and return_progress (TC-7)", () => {
    const plan = resolveStrataThinkingPlan("low");
    const body = buildStrataRequestBody({
      apiModel: "orcarouter-qwen3.8-flash-next-uncensored-iq3_xxs",
      messages: [{ role: "user", content: "Hello" }],
      plan,
    });

    expect(body).toEqual({
      model: "orcarouter-qwen3.8-flash-next-uncensored-iq3_xxs",
      messages: [{ role: "user", content: "Hello" }],
      stream: true,
      max_tokens: 6144,
      reasoning_effort: "low",
      reasoning_budget_tokens: 4096,
      temperature: 1.0,
      top_p: 0.95,
      top_k: 20,
      min_p: 0,
      return_progress: true,
    });
  });

  it("applies Story Writing ('creative') preset parameters for thinking and non-thinking turns (TC-46)", () => {
    const planOff = resolveStrataThinkingPlan("off");
    const bodyOff = buildStrataRequestBody({
      apiModel: "orcarouter-qwen3.8-flash-next-uncensored-iq3_xxs",
      messages: [{ role: "user", content: "Write a chapter" }],
      plan: planOff,
      samplingConfig: { mode: "creative" },
    });

    expect(bodyOff.temperature).toBe(STRATA_SAMPLING_PRESETS.creative.thinkingOff.temperature);
    expect(bodyOff.top_p).toBe(0.92);
    expect(bodyOff.top_k).toBe(30);
    expect(bodyOff.min_p).toBe(0.05);
    expect(bodyOff.presence_penalty).toBe(0.6);

    const planLow = resolveStrataThinkingPlan("low");
    const bodyLow = buildStrataRequestBody({
      apiModel: "orcarouter-qwen3.8-flash-next-uncensored-iq3_xxs",
      messages: [{ role: "user", content: "Write a chapter" }],
      plan: planLow,
      samplingConfig: { mode: "creative" },
    });

    expect(bodyLow.temperature).toBe(0.95);
    expect(bodyLow.top_p).toBe(0.95);
    expect(bodyLow.top_k).toBe(25);
    expect(bodyLow.min_p).toBe(0.03);
    expect(bodyLow.presence_penalty).toBe(0.2);
  });

  it("applies custom sampling overrides and clamps out-of-range values via sanitizeStrataSampling (TC-47)", () => {
    const plan = resolveStrataThinkingPlan("off");
    const sanitized = sanitizeStrataSampling(
      {
        mode: "custom",
        temperature: 5.0,
        top_p: 0.01,
        top_k: 500,
        min_p: 0.9,
        presence_penalty: -1.0,
      },
      false
    );

    expect(sanitized).toEqual({
      temperature: 2.0,
      top_p: 0.05,
      top_k: 64,
      min_p: 0.5,
      presence_penalty: 0.0,
    });

    const bodyCustom = buildStrataRequestBody({
      apiModel: "orcarouter-qwen3.8-flash-next-uncensored-iq3_xxs",
      messages: [{ role: "user", content: "Test custom" }],
      plan,
      samplingConfig: {
        mode: "custom",
        temperature: 0.9,
        top_p: 0.88,
        top_k: 50,
        min_p: 0.06,
        presence_penalty: 0.7,
      },
    });

    expect(bodyCustom.temperature).toBe(0.9);
    expect(bodyCustom.top_p).toBe(0.88);
    expect(bodyCustom.top_k).toBe(50);
    expect(bodyCustom.min_p).toBe(0.06);
    expect(bodyCustom.presence_penalty).toBe(0.7);
  });
});
