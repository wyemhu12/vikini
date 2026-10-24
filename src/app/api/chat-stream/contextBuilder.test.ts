import { describe, it, expect, vi } from "vitest";
import { setupToolsAndSafety, buildMessageContext } from "./contextBuilder";
import * as messagesModule from "@/lib/features/chat/messages";

vi.mock("@/lib/features/chat/messages", () => ({
  getRecentMessages: vi.fn(),
}));

describe("contextBuilder - setupToolsAndSafety", () => {
  it("enables googleSearch + codeExecution + functionDeclarations + includeServerSideToolInvocations for gemini-4-argon when web search is enabled (TC-ARGON-08)", () => {
    const { tools, toolConfig } = setupToolsAndSafety(true, true, "gemini-4-argon");

    expect(tools).toEqual(
      expect.arrayContaining([
        { googleSearch: {} },
        { codeExecution: {} },
        expect.objectContaining({ functionDeclarations: expect.any(Array) }),
      ])
    );
    expect(toolConfig).toEqual({ includeServerSideToolInvocations: true });
  });

  it("enables full tool combination for gemini-3-flash-preview when web search is enabled", () => {
    const { tools, toolConfig } = setupToolsAndSafety(true, true, "gemini-3-flash-preview");

    expect(tools).toEqual(
      expect.arrayContaining([
        { googleSearch: {} },
        { codeExecution: {} },
        expect.objectContaining({ functionDeclarations: expect.any(Array) }),
      ])
    );
    expect(toolConfig).toEqual({ includeServerSideToolInvocations: true });
  });

  it("sends only googleSearch and undefined toolConfig for gemini-2.5-flash when web search is enabled", () => {
    const { tools, toolConfig } = setupToolsAndSafety(true, true, "gemini-2.5-flash");

    expect(tools).toEqual([{ googleSearch: {} }]);
    expect(toolConfig).toBeUndefined();
  });

  it("sends codeExecution + functionDeclarations without googleSearch when web search is disabled", () => {
    const { tools, toolConfig } = setupToolsAndSafety(false, true, "gemini-4-argon");

    expect(tools).not.toContainEqual({ googleSearch: {} });
    expect(tools).toEqual(
      expect.arrayContaining([
        { codeExecution: {} },
        expect.objectContaining({ functionDeclarations: expect.any(Array) }),
      ])
    );
    expect(toolConfig).toBeUndefined();
  });
});

describe("contextBuilder - buildMessageContext skipSlidingTrim (TC-42)", () => {
  it("preserves messages up to RAW_CONTEXT_CEILING_TOKENS when skipSlidingTrim is true and trims with 4000 safetyBuffer when false", async () => {
    const dbMessages = Array.from({ length: 10 }, (_, idx) => ({
      id: `msg-${idx + 1}`,
      conversationId: "conv-1",
      role: (idx % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: "word ".repeat(300), // ~430 tokens per message
      meta: {},
      createdAt: new Date().toISOString(),
    }));

    vi.mocked(messagesModule.getRecentMessages).mockResolvedValue(dbMessages);

    // With modelLimitTokens = 6000 and skipSlidingTrim = false:
    // safetyBuffer = 4000 -> effective budget = 2000 tokens -> trims older messages
    const trimmed = await buildMessageContext(
      "conv-cloud",
      "Latest question",
      "System prompt",
      6000,
      { skipSlidingTrim: false }
    );
    expect(trimmed.contextMessages.length).toBeLessThan(10);

    // With skipSlidingTrim = true:
    // uses RAW_CONTEXT_CEILING_TOKENS (96000) and safetyBuffer = 0 -> preserves all 10 messages
    const preserved = await buildMessageContext(
      "conv-local",
      "Latest question",
      "System prompt",
      6000,
      { skipSlidingTrim: true }
    );
    expect(preserved.contextMessages).toHaveLength(10);
    expect(preserved.contentsMeta?.[0]?.messageId).toBe("msg-1");
  });
});
