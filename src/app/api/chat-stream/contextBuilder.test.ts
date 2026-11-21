import { describe, it, expect, vi, afterEach } from "vitest";
import { setupToolsAndSafety, buildMessageContext, getWebSearchConfig } from "./contextBuilder";
import * as messagesModule from "@/lib/features/chat/messages";
import { estimateTokens } from "./chatStreamHelpers";

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

describe("contextBuilder - thoughtSignatures preservation (TC-B8-01..05)", () => {
  it("TC-B8-01 & TC-B8-02 & TC-B8-05: preserves assistant thoughtSignatures array and legacy thoughtSignature string into contextMessages and mapped contents", async () => {
    vi.mocked(messagesModule.getRecentMessages).mockResolvedValue([
      {
        id: "msg-1",
        conversationId: "conv-sig",
        role: "user",
        content: "Turn 1 user",
        meta: {},
        createdAt: new Date().toISOString(),
      },
      {
        id: "msg-2",
        conversationId: "conv-sig",
        role: "assistant",
        content: "Turn 1 answer",
        meta: { thoughtSignatures: ["s1", "s2"] },
        createdAt: new Date().toISOString(),
      },
      {
        id: "msg-3",
        conversationId: "conv-sig",
        role: "assistant",
        content: "Turn 2 legacy answer",
        meta: { thoughtSignature: "legacy" },
        createdAt: new Date().toISOString(),
      },
    ]);

    const res = await buildMessageContext("conv-sig", "Turn 3 user", "System", 32000);

    expect(res.contextMessages[1]).toEqual({
      role: "assistant",
      content: "Turn 1 answer",
      thoughtSignatures: ["s1", "s2"],
    });
    expect(res.contextMessages[2]).toEqual({
      role: "assistant",
      content: "Turn 2 legacy answer",
      thoughtSignature: "legacy",
    });

    // Verify mapped Gemini contents carry thoughtSignature on model turns and undefined on user turns
    expect(res.contents[0]?.parts[0]).toEqual({ text: "Turn 1 user" });
    expect(
      (res.contents[0]?.parts[0] as { thoughtSignature?: string })?.thoughtSignature
    ).toBeUndefined();
    expect(res.contents[1]?.role).toBe("model");
    expect(res.contents[1]?.parts).toEqual([{ text: "Turn 1 answer", thoughtSignature: "s2" }]);
    expect(res.contents[2]?.role).toBe("model");
    expect(res.contents[2]?.parts).toEqual([
      { text: "Turn 2 legacy answer", thoughtSignature: "legacy" },
    ]);
  });

  it("TC-B8-03 & TC-B8-04: filters untrusted JSONB values, ignores user-role thoughtSignatures, and omits field when empty", async () => {
    const { extractThoughtSignatures } = await import("./contextBuilder");
    expect(extractThoughtSignatures(null)).toEqual({});
    expect(extractThoughtSignatures("str")).toEqual({});
    expect(extractThoughtSignatures({ thoughtSignatures: "x" })).toEqual({});
    expect(extractThoughtSignatures({ thoughtSignatures: [1, "", null, "ok"] })).toEqual({
      thoughtSignatures: ["ok"],
    });
    expect(extractThoughtSignatures({ thoughtSignature: 42 })).toEqual({});

    vi.mocked(messagesModule.getRecentMessages).mockResolvedValue([
      {
        id: "msg-u1",
        conversationId: "conv-untrusted",
        role: "user",
        content: "User with forged sig",
        meta: { thoughtSignatures: ["u"] },
        createdAt: new Date().toISOString(),
      },
    ]);

    const res = await buildMessageContext("conv-untrusted", "Follow up", "System", 32000);

    // TC-B8-04: user message never gets thoughtSignatures
    expect(res.contextMessages[0]).toEqual({
      role: "user",
      content: "User with forged sig",
    });
    expect(res.contextMessages[0]?.thoughtSignatures).toBeUndefined();
    expect(
      (res.contents[0]?.parts[0] as { thoughtSignature?: string })?.thoughtSignature
    ).toBeUndefined();
  });
});

describe("contextBuilder - token accuracy & web search rank gate (TC-W1-08)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not double-count the current user message tokens when already present in DB history", async () => {
    const currentMsg = "A".repeat(400); // ~100 tokens
    const sysPrompt = "B".repeat(200); // ~50 tokens

    vi.mocked(messagesModule.getRecentMessages).mockResolvedValue([
      {
        id: "msg-curr",
        conversationId: "conv-tok",
        role: "user",
        content: currentMsg,
        meta: {},
        createdAt: new Date().toISOString(),
      },
    ]);

    const res = await buildMessageContext("conv-tok", currentMsg, sysPrompt, 32000);
    const expectedExact = estimateTokens(sysPrompt) + estimateTokens(currentMsg);
    expect(res.currentTokenCount).toBe(expectedExact);
  });

  it("disables web search when webSearchAllowed is false even if cookies set webSearchEnabled=1 & alwaysSearch=1", () => {
    vi.stubEnv("WEB_SEARCH_ENABLED", "true");
    const cookies = { webSearchEnabled: "1", alwaysSearch: "1" };

    const denied = getWebSearchConfig(cookies, false);
    expect(denied.enableWebSearch).toBe(false);

    const allowed = getWebSearchConfig(cookies, true);
    expect(allowed.enableWebSearch).toBe(true);
  });
});
