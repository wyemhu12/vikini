import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const {
  mockGetGenAIClient,
  mockGetOpenRouterClient,
  mockGetClaudeClient,
  mockGetOrCreateCompositeCache,
  mockAssertModelAllowedForUser,
  mockGetUserLimits,
  mockLoadOrCreateConversation,
  mockBuildRAGContext,
  mockCreateAnthropicStream,
  mockCreateChatReadableStream,
} = vi.hoisted(() => ({
  mockGetGenAIClient: vi.fn(),
  mockGetOpenRouterClient: vi.fn(),
  mockGetClaudeClient: vi.fn(),
  mockGetOrCreateCompositeCache: vi.fn(),
  mockAssertModelAllowedForUser: vi.fn(),
  mockGetUserLimits: vi.fn(),
  mockLoadOrCreateConversation: vi.fn(),
  mockBuildRAGContext: vi.fn(),
  mockCreateAnthropicStream: vi.fn(),
  mockCreateChatReadableStream: vi.fn(),
}));

vi.mock("@/lib/core/genaiClient", () => ({
  getGenAIClient: () => mockGetGenAIClient(),
}));
vi.mock("@/lib/core/openRouterClient", () => ({
  getOpenRouterClient: () => mockGetOpenRouterClient(),
}));
vi.mock("@/lib/core/claudeClient", () => ({
  getClaudeClient: () => mockGetClaudeClient(),
}));
vi.mock("@/lib/core/groqClient", () => ({
  getGroqClient: vi.fn(),
}));
vi.mock("@/lib/core/deepseekClient", () => ({
  getDeepSeekClient: vi.fn(),
}));
vi.mock("@/lib/core/contextCache", () => ({
  getOrCreateCompositeCache: (...args: unknown[]) => mockGetOrCreateCompositeCache(...args),
}));
vi.mock("@/lib/core/limits", () => ({
  assertModelAllowedForUser: (...args: unknown[]) => mockAssertModelAllowedForUser(...args),
  getUserLimits: (...args: unknown[]) => mockGetUserLimits(...args),
}));
vi.mock("@/lib/features/chat/messages", () => ({
  saveMessage: vi.fn().mockResolvedValue({ id: "u-msg-1" }),
  upsertMessage: vi.fn().mockResolvedValue({ message: { id: "a-msg-1" } }),
}));
vi.mock("@/lib/features/files/fileService.server", () => ({
  linkFilesToMessage: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/features/chat/conversations", () => ({
  setConversationAutoTitle: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/features/gems/gems", () => ({
  getGemInstructionsForConversation: vi.fn().mockResolvedValue(""),
}));
vi.mock("@/lib/features/personas/personas", () => ({
  getPersonaInstructionsForConversation: vi.fn().mockResolvedValue(""),
}));
vi.mock("@/lib/features/projects/ragContext.server", () => ({
  buildRAGContext: (...args: unknown[]) => mockBuildRAGContext(...args),
  injectRAGIntoSystemPrompt: (sys: string) => `${sys}\n<rag>chunk</rag>`,
}));
vi.mock("@/lib/core/autoTitleEngine", () => ({
  generateOptimisticTitle: vi.fn().mockResolvedValue(null),
  generateFinalTitle: vi.fn().mockResolvedValue(null),
}));
vi.mock("./conversationLoader", () => ({
  loadOrCreateConversation: (...args: unknown[]) => mockLoadOrCreateConversation(...args),
  handleMessageTruncation: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./contextBuilder", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./contextBuilder")>();
  return {
    ...actual,
    buildMessageContext: vi.fn().mockResolvedValue({
      contextMessages: [{ role: "user", content: "Hello" }],
      contents: [{ role: "user", parts: [{ text: "Hello" }] }],
      contentsMeta: [{ messageId: "u-msg-1" }],
      currentTokenCount: 20,
    }),
  };
});
vi.mock("./attachmentProcessor", () => ({
  processAttachments: vi.fn().mockImplementation(async (_u, _c, contents, sysPrompt) => ({
    contents,
    sysPrompt,
  })),
}));
vi.mock("./streaming", () => ({
  createChatReadableStream: (...args: unknown[]) => mockCreateChatReadableStream(...args),
  createOpenAICompatibleStream: vi.fn(() => new ReadableStream()),
  createDeepSeekStream: vi.fn(() => new ReadableStream()),
  createAnthropicStream: (...args: unknown[]) => mockCreateAnthropicStream(...args),
  createStrataStream: vi.fn(() => new ReadableStream()),
}));

import { handleChatStreamCore } from "./chatStreamCore";
import { UserBlockedError } from "@/lib/utils/errors";

function makeReq(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost:3000/api/chat-stream", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("chatStreamCore (TC-W1-03, TC-W1-08, TC-W1-09)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("WEB_SEARCH_ENABLED", "true");
    mockAssertModelAllowedForUser.mockResolvedValue(undefined);
    mockGetUserLimits.mockResolvedValue({
      rank: "pro",
      daily_message_limit: 500,
      max_file_size_mb: 50,
      features: { web_search: true, unlimited_gems: true, custom_api_key: true },
      allowed_models: [],
    });
    mockBuildRAGContext.mockResolvedValue({ ragEnabled: false, sources: [], contextText: "" });
    mockGetOrCreateCompositeCache.mockResolvedValue(null);
    mockGetGenAIClient.mockReturnValue({ models: { generateContentStream: vi.fn() } });
    mockGetClaudeClient.mockReturnValue({ beta: { messages: { create: vi.fn() } } });
    mockCreateAnthropicStream.mockReturnValue(new ReadableStream());
    mockCreateChatReadableStream.mockReturnValue(new ReadableStream());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("TC-W1-09: returns 400 VALIDATION_ERROR with Zod v4 .issues[0] details and handles invalid JSON", async () => {
    const badJsonRes = await handleChatStreamCore({
      req: makeReq("{not-valid-json"),
      userId: "user@example.com",
    });
    expect(badJsonRes.status).toBe(400);
    const badJson = await badJsonRes.json();
    expect(badJson.error.code).toBe("VALIDATION_ERROR");

    const invalidSchemaRes = await handleChatStreamCore({
      req: makeReq({ content: "" }),
      userId: "user@example.com",
    });
    expect(invalidSchemaRes.status).toBe(400);
    const invalidJson = await invalidSchemaRes.json();
    expect(invalidJson.error.code).toBe("VALIDATION_ERROR");
    expect(invalidJson.error.message).toContain("content");
  });

  it("TC-W1-08: routes claude-sonnet-4.5 to Direct Anthropic when ANTHROPIC_API_KEY is set without calling getGenAIClient or getOpenRouterClient", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test-key");
    vi.stubEnv("OPENROUTER_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "");
    mockGetGenAIClient.mockImplementation(() => {
      throw new Error("GEMINI_API_KEY missing");
    });
    mockGetOpenRouterClient.mockImplementation(() => {
      throw new Error("OPENROUTER_API_KEY missing");
    });
    mockLoadOrCreateConversation.mockResolvedValue({
      conversation: { id: "conv-1", gemId: null },
      conversationId: "conv-1",
      isNew: false,
      isUntitled: false,
      shouldGenerateTitle: false,
      requestedModel: "claude-sonnet-4.5",
      model: "claude-sonnet-4.5",
      modelLimitTokens: 200_000,
    });

    const res = await handleChatStreamCore({
      req: makeReq({ content: "Hello Claude" }),
      userId: "user@example.com",
    });

    expect(res.status).toBe(200);
    expect(mockGetClaudeClient).toHaveBeenCalledTimes(1);
    expect(mockCreateAnthropicStream).toHaveBeenCalledTimes(1);
    expect(mockGetGenAIClient).not.toHaveBeenCalled();
    expect(mockGetOpenRouterClient).not.toHaveBeenCalled();
  });

  it("TC-W1-08: blocks web search privilege escalation via cookie when user rank features.web_search is false", async () => {
    mockGetUserLimits.mockResolvedValueOnce({
      rank: "basic",
      daily_message_limit: 50,
      max_file_size_mb: 10,
      features: { web_search: false, unlimited_gems: false, custom_api_key: false },
      allowed_models: [],
    });
    mockLoadOrCreateConversation.mockResolvedValue({
      conversation: { id: "conv-1", gemId: null },
      conversationId: "conv-1",
      isNew: false,
      isUntitled: false,
      shouldGenerateTitle: false,
      requestedModel: "gemini-3-flash-preview",
      model: "gemini-3-flash-preview",
      modelLimitTokens: 1_000_000,
    });

    const res = await handleChatStreamCore({
      req: makeReq({ content: "Search the web" }, { cookie: "webSearchEnabled=1; alwaysSearch=1" }),
      userId: "basic@example.com",
    });

    expect(res.status).toBe(200);
    const geminiCall = mockCreateChatReadableStream.mock.calls[0][0] as {
      tools: Array<Record<string, unknown>>;
      enableWebSearch: boolean;
    };
    expect(geminiCall.enableWebSearch).toBe(false);
    expect(geminiCall.tools).not.toContainEqual({ googleSearch: {} });
  });

  it("TC-W1-03: passes userId to getOrCreateCompositeCache when no RAG sources and skips composite cache when ragSources.length > 0", async () => {
    mockLoadOrCreateConversation.mockResolvedValue({
      conversation: { id: "conv-1", gemId: null },
      conversationId: "conv-1",
      isNew: false,
      isUntitled: false,
      shouldGenerateTitle: false,
      requestedModel: "gemini-3-flash-preview",
      model: "gemini-3-flash-preview",
      modelLimitTokens: 1_000_000,
    });

    // Without RAG: composite cache is called with userId
    await handleChatStreamCore({
      req: makeReq({ content: "No RAG question" }),
      userId: "tenant-a@example.com",
    });
    expect(mockGetOrCreateCompositeCache).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "tenant-a@example.com" })
    );

    // With RAG: composite cache must be skipped
    mockGetOrCreateCompositeCache.mockClear();
    mockBuildRAGContext.mockResolvedValueOnce({
      ragEnabled: true,
      sources: [{ filename: "kb.md", documentId: "d1", chunkId: "c1", similarity: 0.9 }],
      contextText: "Private KB text",
    });

    await handleChatStreamCore({
      req: makeReq({ content: "RAG question" }),
      userId: "tenant-a@example.com",
    });
    expect(mockGetOrCreateCompositeCache).not.toHaveBeenCalled();
  });

  it("TC-W2A-16 & NP-08: fetches getUserLimits once BEFORE loadOrCreateConversation (no orphan conversation on 403/503) and passes preloaded limits", async () => {
    // 1. When getUserLimits rejects with UserBlockedError -> loadOrCreateConversation MUST NOT run
    mockGetUserLimits.mockRejectedValueOnce(new UserBlockedError());

    await expect(
      handleChatStreamCore({
        req: makeReq({ content: "Blocked user message" }),
        userId: "blocked@example.com",
      })
    ).rejects.toBeInstanceOf(UserBlockedError);
    expect(mockLoadOrCreateConversation).not.toHaveBeenCalled();

    // 2. Normal flow: getUserLimits called only ONCE and passed into assertModelAllowedForUser
    vi.clearAllMocks();
    const limitsObj = {
      rank: "pro",
      daily_message_limit: 500,
      max_file_size_mb: 50,
      features: { web_search: true, unlimited_gems: true, custom_api_key: true },
      allowed_models: [],
    };
    mockGetUserLimits.mockResolvedValueOnce(limitsObj);
    mockLoadOrCreateConversation.mockResolvedValueOnce({
      conversation: { id: "conv-1", gemId: null, personaId: null, projectId: null },
      conversationId: "conv-1",
      isNew: false,
      isUntitled: false,
      shouldGenerateTitle: false,
      requestedModel: "gemini-3-flash-preview",
      model: "gemini-3-flash-preview",
      modelLimitTokens: 1_000_000,
    });

    const res = await handleChatStreamCore({
      req: makeReq({ content: "Normal message" }),
      userId: "pro@example.com",
    });
    expect(res.status).toBe(200);
    expect(mockGetUserLimits).toHaveBeenCalledTimes(1);
    expect(mockAssertModelAllowedForUser).toHaveBeenCalledWith(
      "pro@example.com",
      "gemini-3-flash-preview",
      limitsObj
    );
  });
});
