import { describe, it, expect, vi, beforeEach } from "vitest";
import { createChatReadableStream } from "./gemini-stream";
import type { ChatStreamParams } from "./types";

vi.mock("@/lib/core/modelRegistry", () => ({
  getModelMaxOutputTokens: () => 4096,
  modelSupportsThinking: () => true,
  normalizeModelForApi: (m: string) => m,
}));

vi.mock("@/lib/features/chat/functionRegistry", () => ({
  executeFunction: vi.fn(),
}));

vi.mock("./thought-signatures", () => ({
  extractAllThoughtSignatures: () => [],
}));

vi.mock("./post-processing", () => ({
  handleSafetyBlocking: (_c: unknown, full: string) => ({ full, isActuallyBlocked: false }),
  processGroundingMetadata: () => undefined,
  processUrlContextMetadata: () => undefined,
  processPostStream: vi.fn(),
}));

describe("gemini-stream - Abort handling and safety net", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls saveMessage with isPartial: true when aborted during for await loop (Q1, S1)", async () => {
    const saveMessageMock = vi.fn().mockResolvedValue({});
    const postProcessing = await import("./post-processing");

    const abortController = new AbortController();

    // Mock async generator that yields some tokens and then simulates abort
    async function* mockStreamGenerator() {
      yield { candidates: [{ content: { parts: [{ text: "Hello " }] } }] };
      yield { candidates: [{ content: { parts: [{ text: "world! Partial " }] } }] };
      // Simulate client aborting stream mid-generation
      abortController.abort();
      // Throw AbortError as Google GenAI SDK does when signal is aborted
      const err = new Error("This operation was aborted");
      err.name = "AbortError";
      throw err;
    }

    const mockAi = {
      models: {
        generateContentStream: vi.fn().mockReturnValue(mockStreamGenerator()),
      },
    };

    const params: ChatStreamParams = {
      ai: mockAi as unknown as ChatStreamParams["ai"],
      model: "gemini-3.8-flash",
      contents: [],
      sysPrompt: "",
      tools: [],
      safetySettings: null,
      gemMeta: {},
      modelMeta: {},
      createdConversation: null,
      shouldGenerateTitle: false,
      enableWebSearch: false,
      WEB_SEARCH_AVAILABLE: false,
      cookieWeb: "",
      regenerate: false,
      content: "Hi",
      conversationId: "conv-1",
      userId: "user-1",
      contextMessages: [],
      appendToContext: vi.fn(),
      saveMessage: saveMessageMock,
      setConversationAutoTitle: vi.fn(),
      generateOptimisticTitle: vi.fn(),
      generateFinalTitle: vi.fn(),
      clientMessageId: "test-client-msg-1",
      signal: abortController.signal,
    };

    const readable = createChatReadableStream(params);
    const reader = readable.getReader();

    // Read all chunks until done
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    // Verify processPostStream was NOT called
    expect(postProcessing.processPostStream).not.toHaveBeenCalled();

    // Verify saveMessage WAS called with isPartial: true and the accumulated text
    expect(saveMessageMock).toHaveBeenCalledTimes(1);
    expect(saveMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: "conv-1",
        userId: "user-1",
        role: "assistant",
        content: "Hello world! Partial",
        meta: expect.objectContaining({
          isPartial: true,
          aborted: true,
          status: "aborted",
          clientMessageId: "test-client-msg-1",
        }),
      })
    );
  });
});
