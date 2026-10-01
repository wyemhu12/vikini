// src/app/api/chat-stream/streaming/deepseek-request-builder.test.ts
import { describe, it, expect } from "vitest";
import { mapDeepSeekEffort, buildDeepSeekRequestBody } from "./deepseek-request-builder";

describe("deepseek-request-builder", () => {
  const dummyMessages = [{ role: "user" as const, content: "Hello" }];

  describe("Variant 1: DeepSeek V4.1 Flash (OpenRouter)", () => {
    const flashModel = "deepseek/deepseek-v4.1-flash";

    it("maps high effort to high, sets provider order and max_tokens 384000", () => {
      const mapping = mapDeepSeekEffort(flashModel, "high");
      expect(mapping.reasoningEffort).toBe("high");
      expect(mapping.isThinkingEnabled).toBe(true);

      const body = buildDeepSeekRequestBody({
        model: flashModel,
        messages: dummyMessages,
        thinkingLevel: "high",
      });

      expect(body.reasoning).toEqual({ effort: "high" });
      expect(body.reasoning_effort).toBe("high");
      expect(body.include_reasoning).toBe(true);
      expect(body.provider?.order).toEqual(["Relace", "Together", "Novita", "DeepSeek"]);
      expect(body.provider?.allow_fallbacks).toBe(true);
      expect(body.max_tokens).toBe(384000);
    });

    it("maps low effort to low", () => {
      const mapping = mapDeepSeekEffort(flashModel, "low");
      expect(mapping.reasoningEffort).toBe("low");

      const body = buildDeepSeekRequestBody({
        model: flashModel,
        messages: dummyMessages,
        thinkingLevel: "low",
      });
      expect(body.reasoning).toEqual({ effort: "low" });
    });

    it("maps medium and minimal effort to low for Flash", () => {
      expect(mapDeepSeekEffort(flashModel, "medium").reasoningEffort).toBe("low");
      expect(mapDeepSeekEffort(flashModel, "minimal").reasoningEffort).toBe("low");
      expect(mapDeepSeekEffort(flashModel, undefined).reasoningEffort).toBe("low");
    });

    it("handles off thinking level correctly", () => {
      const mapping = mapDeepSeekEffort(flashModel, "off");
      expect(mapping.reasoningEffort).toBe("none");
      expect(mapping.isThinkingEnabled).toBe(false);

      const body = buildDeepSeekRequestBody({
        model: flashModel,
        messages: dummyMessages,
        thinkingLevel: "off",
      });
      expect(body.include_reasoning).toBe(false);
      expect(body.reasoning).toEqual({ effort: "none" });
      expect(body.reasoning_effort).toBe("none");
      expect(body.temperature).toBe(0.7);
    });
  });

  describe("Variant 2: DeepSeek V4 Pro (OpenRouter)", () => {
    const proModel = "deepseek/deepseek-v4-pro";

    it("maps high effort to xhigh and max_tokens 65536", () => {
      const mapping = mapDeepSeekEffort(proModel, "high");
      expect(mapping.reasoningEffort).toBe("xhigh");

      const body = buildDeepSeekRequestBody({
        model: proModel,
        messages: dummyMessages,
        thinkingLevel: "high",
      });

      expect(body.reasoning).toEqual({ effort: "xhigh" });
      expect(body.reasoning_effort).toBe("xhigh");
      expect(body.provider?.order).toEqual(["StreamLake"]);
      expect(body.max_tokens).toBe(65536);
    });

    it("maps low/medium effort to high for Pro", () => {
      expect(mapDeepSeekEffort(proModel, "low").reasoningEffort).toBe("high");
      expect(mapDeepSeekEffort(proModel, "medium").reasoningEffort).toBe("high");
      expect(mapDeepSeekEffort(proModel, undefined).reasoningEffort).toBe("high");
    });
  });

  describe("Variant 3: DeepSeek Direct API", () => {
    const directModel = "deepseek-chat";

    it("maps high effort to max and adds prefix with 16384 max_tokens", () => {
      const mapping = mapDeepSeekEffort(directModel, "high");
      expect(mapping.reasoningEffort).toBe("max");
      expect(mapping.effectiveSysPromptPrefix).toContain(
        "Reasoning Effort: High depth deliberation"
      );

      const body = buildDeepSeekRequestBody({
        model: directModel,
        messages: dummyMessages,
        thinkingLevel: "high",
      });

      expect(body.thinking).toEqual({ type: "enabled" });
      expect(body.reasoning_effort).toBe("max");
      expect(body.max_tokens).toBe(16384);
    });

    it("maps low/medium effort to high with 16384 max_tokens and no prefix", () => {
      const mapping = mapDeepSeekEffort(directModel, "low");
      expect(mapping.reasoningEffort).toBe("high");
      expect(mapping.effectiveSysPromptPrefix).toBe("");

      const body = buildDeepSeekRequestBody({
        model: directModel,
        messages: dummyMessages,
        thinkingLevel: "low",
      });

      expect(body.thinking).toEqual({ type: "enabled" });
      expect(body.reasoning_effort).toBe("high");
      expect(body.max_tokens).toBe(16384);
    });

    it("handles off thinking level with 8192 tokens and disabled thinking", () => {
      const mapping = mapDeepSeekEffort(directModel, "off");
      expect(mapping.reasoningEffort).toBe("none");

      const body = buildDeepSeekRequestBody({
        model: directModel,
        messages: dummyMessages,
        thinkingLevel: "off",
      });

      expect(body.thinking).toEqual({ type: "disabled" });
      expect(body.reasoning_effort).toBeNull();
      expect(body.max_tokens).toBe(8192);
      expect(body.temperature).toBe(0.7);
    });
  });
});
