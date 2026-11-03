// /lib/core/geminiSdkHelpers.test.ts
import { describe, expect, it } from "vitest";
import { ThinkingLevel } from "@google/genai";
import { buildMinimalThinkingConfig, extractGeminiResponseText } from "./geminiSdkHelpers";

describe("geminiSdkHelpers", () => {
  describe("buildMinimalThinkingConfig", () => {
    it("TC-GSH-01: returns ThinkingLevel.MINIMAL for models supporting minimal thinking", () => {
      expect(buildMinimalThinkingConfig("gemini-3.5-flash-lite")).toEqual({
        thinkingLevel: ThinkingLevel.MINIMAL,
      });
      expect(buildMinimalThinkingConfig("gemini-3-flash-preview")).toEqual({
        thinkingLevel: ThinkingLevel.MINIMAL,
      });
    });

    it("TC-GSH-02: clamps minimal to ThinkingLevel.LOW for gemini-3.8-flash and legacy gemini-2.5-pro", () => {
      expect(buildMinimalThinkingConfig("gemini-3.8-flash")).toEqual({
        thinkingLevel: ThinkingLevel.LOW,
      });
      expect(buildMinimalThinkingConfig("gemini-2.5-pro")).toEqual({
        thinkingLevel: ThinkingLevel.LOW,
      });
    });

    it("TC-GSH-03: returns undefined for non-Gemini models without thinkingLevel support", () => {
      expect(buildMinimalThinkingConfig("claude-sonnet-4.5")).toBeUndefined();
      expect(buildMinimalThinkingConfig("deepseek-v4-flash")).toBeUndefined();
    });
  });

  describe("extractGeminiResponseText", () => {
    it("TC-GSH-04: extracts text from string property or function method on SDK response", () => {
      expect(extractGeminiResponseText({ text: "hello" })).toBe("hello");
      expect(extractGeminiResponseText({ text: () => "fn" })).toBe("fn");
    });

    it("TC-GSH-05: filters out thought: true parts at index 0 and joins remaining text parts", () => {
      const resp = {
        candidates: [
          {
            content: {
              parts: [{ text: "reasoning…", thought: true }, { text: "Answer" }, { text: " two" }],
            },
          },
        ],
      };
      const text = extractGeminiResponseText(resp);
      expect(text).toBe("Answer two");
      expect(text).not.toContain("reasoning");
    });

    it("TC-GSH-06: returns empty string when candidates only contain thought parts or are empty", () => {
      expect(
        extractGeminiResponseText({
          candidates: [{ content: { parts: [{ text: "secret thought", thought: true }] } }],
        })
      ).toBe("");
      expect(extractGeminiResponseText({ candidates: [{ content: { parts: [] } }] })).toBe("");
      expect(extractGeminiResponseText({ candidates: [] })).toBe("");
    });

    it("TC-GSH-07: handles null, primitives, and malformed candidate shapes without throwing", () => {
      expect(extractGeminiResponseText(null)).toBe("");
      expect(extractGeminiResponseText(undefined)).toBe("");
      expect(extractGeminiResponseText(42)).toBe("");
      expect(extractGeminiResponseText("s")).toBe("");
      expect(
        extractGeminiResponseText({
          candidates: [{ content: { parts: [null, 7, { text: 5 }, { inlineData: {} }] } }],
        })
      ).toBe("");
    });

    it("TC-GSH-08: falls back to candidates when text property is undefined", () => {
      expect(
        extractGeminiResponseText({
          text: undefined,
          candidates: [{ content: { parts: [{ text: "x" }] } }],
        })
      ).toBe("x");
    });
  });
});
