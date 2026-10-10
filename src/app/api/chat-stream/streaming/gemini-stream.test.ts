import { describe, it, expect, vi, beforeEach } from "vitest";
import { createChatReadableStream } from "./gemini-stream";
import type { ChatStreamParams } from "./types";

vi.mock("@/lib/core/modelRegistry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/core/modelRegistry")>();
  return {
    ...actual,
    getModelMaxOutputTokens: () => 4096,
    modelSupportsThinking: vi.fn((m: unknown) => actual.modelSupportsThinking(m)),
  };
});

vi.mock("@/lib/features/chat/functionRegistry", () => ({
  executeFunction: vi.fn().mockResolvedValue({ status: "success", result: "mock tool output" }),
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

function createMockParams(overrides: Partial<ChatStreamParams> = {}): ChatStreamParams {
  return {
    ai: {
      models: {
        generateContentStream: vi.fn().mockImplementation(async function* () {
          yield { candidates: [{ content: { parts: [{ text: "Response chunk" }] } }] };
        }),
      },
    } as unknown as ChatStreamParams["ai"],
    model: "gemini-3-flash-preview",
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
    saveMessage: vi.fn().mockResolvedValue({}),
    setConversationAutoTitle: vi.fn(),
    generateOptimisticTitle: vi.fn(),
    generateFinalTitle: vi.fn(),
    clientMessageId: "test-client-msg-1",
    signal: new AbortController().signal,
    ...overrides,
  };
}

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

    const params = createMockParams({
      ai: mockAi as unknown as ChatStreamParams["ai"],
      model: "gemini-3-flash-preview",
      saveMessage: saveMessageMock,
      signal: abortController.signal,
    });

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

describe("gemini-stream - Thinking configuration & sampling parameter invariants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets thinkingConfig with thinkingLevel and includeThoughts for Gemini 3", async () => {
    const generateMock = vi.fn().mockImplementation(async function* () {
      yield { candidates: [{ content: { parts: [{ text: "Response" }] } }] };
    });

    const params = createMockParams({
      ai: { models: { generateContentStream: generateMock } } as unknown as ChatStreamParams["ai"],
      model: "gemini-3-flash-preview",
      thinkingLevel: "high",
    });

    const reader = createChatReadableStream(params).getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    expect(generateMock).toHaveBeenCalledTimes(1);
    const callConfig = generateMock.mock.calls[0][0].config;

    expect(callConfig.thinkingConfig).toEqual({
      thinkingLevel: "high",
      includeThoughts: true,
    });
    expect(callConfig.thinkingConfig).not.toHaveProperty("thinkingBudget");
    expect(callConfig).not.toHaveProperty("temperature");
    expect(callConfig).not.toHaveProperty("top_p");
    expect(callConfig).not.toHaveProperty("top_k");
  });

  it("sets thinkingConfig with thinkingBudget: -1 for Gemini 2.5", async () => {
    const generateMock = vi.fn().mockImplementation(async function* () {
      yield { candidates: [{ content: { parts: [{ text: "Response" }] } }] };
    });

    const params = createMockParams({
      ai: { models: { generateContentStream: generateMock } } as unknown as ChatStreamParams["ai"],
      model: "gemini-2.5-flash",
      thinkingLevel: "high",
    });

    const reader = createChatReadableStream(params).getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    expect(generateMock).toHaveBeenCalledTimes(1);
    const callConfig = generateMock.mock.calls[0][0].config;

    expect(callConfig.thinkingConfig).toEqual({
      thinkingBudget: -1,
      includeThoughts: true,
    });
    expect(callConfig.thinkingConfig).not.toHaveProperty("thinkingLevel");
    expect(callConfig).not.toHaveProperty("temperature");
  });

  it("clamps minimal to low for Gemini 3.1 Pro", async () => {
    const generateMock = vi.fn().mockImplementation(async function* () {
      yield { candidates: [{ content: { parts: [{ text: "Response" }] } }] };
    });

    const params = createMockParams({
      ai: { models: { generateContentStream: generateMock } } as unknown as ChatStreamParams["ai"],
      model: "gemini-3.1-pro-preview",
      thinkingLevel: "minimal",
    });

    const reader = createChatReadableStream(params).getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    expect(generateMock).toHaveBeenCalledTimes(1);
    const callConfig = generateMock.mock.calls[0][0].config;

    expect(callConfig.thinkingConfig).toEqual({
      thinkingLevel: "low",
      includeThoughts: true,
    });
    expect(callConfig.thinkingConfig).not.toHaveProperty("thinkingBudget");
  });

  it("omits thinkingConfig when thinkingLevel is off or undefined", async () => {
    const generateMock = vi.fn().mockImplementation(async function* () {
      yield { candidates: [{ content: { parts: [{ text: "Response" }] } }] };
    });

    const params = createMockParams({
      ai: { models: { generateContentStream: generateMock } } as unknown as ChatStreamParams["ai"],
      model: "gemini-3-flash-preview",
      thinkingLevel: "off",
    });

    const reader = createChatReadableStream(params).getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    expect(generateMock).toHaveBeenCalledTimes(1);
    const callConfig = generateMock.mock.calls[0][0].config;

    expect(callConfig.thinkingConfig).toBeUndefined();
    expect(callConfig).not.toHaveProperty("temperature");
  });

  it("continuation call includes abortSignal and excludes sampling parameters", async () => {
    const abortSignal = new AbortController().signal;

    // First call yields a function call; second call (continuation) yields final text
    let callCount = 0;
    const generateMock = vi.fn().mockImplementation(async function* () {
      callCount++;
      if (callCount === 1) {
        yield {
          candidates: [
            {
              content: {
                parts: [
                  {
                    functionCall: {
                      name: "testTool",
                      args: { query: "hello" },
                    },
                  },
                ],
              },
            },
          ],
        };
      } else {
        yield {
          candidates: [
            {
              content: {
                parts: [{ text: "Final answer after tool" }],
              },
            },
          ],
        };
      }
    });

    const params = createMockParams({
      ai: { models: { generateContentStream: generateMock } } as unknown as ChatStreamParams["ai"],
      model: "gemini-3-flash-preview",
      tools: [{ functionDeclarations: [{ name: "testTool" }] }],
      toolConfig: { functionCallingConfig: { mode: "AUTO" } },
      signal: abortSignal,
    });

    const reader = createChatReadableStream(params).getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    expect(generateMock).toHaveBeenCalledTimes(2);

    // Verify continuation call config
    const initialConfig = generateMock.mock.calls[0][0].config;
    const continuationConfig = generateMock.mock.calls[1][0].config;
    expect(continuationConfig).toBeDefined();
    expect(continuationConfig.abortSignal).toBeDefined();
    expect(continuationConfig.abortSignal).toBe(initialConfig.abortSignal);
    expect(continuationConfig).not.toHaveProperty("temperature");
    expect(continuationConfig).not.toHaveProperty("topP");
    expect(continuationConfig).not.toHaveProperty("topK");
    expect(continuationConfig).not.toHaveProperty("top_p");
    expect(continuationConfig).not.toHaveProperty("top_k");
  });

  it("preserves cachedContent in tool continuation config when context cache is active (TC-STR-02B)", async () => {
    let callCount = 0;
    const generateMock = vi.fn().mockImplementation(async function* () {
      callCount++;
      if (callCount === 1) {
        yield {
          candidates: [
            {
              content: {
                parts: [
                  {
                    functionCall: {
                      name: "testTool",
                      args: { query: "hello" },
                    },
                  },
                ],
              },
            },
          ],
        };
      } else {
        yield {
          candidates: [
            {
              content: {
                parts: [{ text: "Final answer after tool with cache" }],
              },
            },
          ],
        };
      }
    });

    const params = createMockParams({
      ai: { models: { generateContentStream: generateMock } } as unknown as ChatStreamParams["ai"],
      model: "gemini-3-flash-preview",
      sysPrompt: "You are a cached assistant",
      cachedContent: "cachedContents/composite-test-123",
      tools: [{ functionDeclarations: [{ name: "testTool" }] }],
      toolConfig: { functionCallingConfig: { mode: "AUTO" } },
    });

    const reader = createChatReadableStream(params).getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    expect(generateMock).toHaveBeenCalledTimes(2);

    const continuationConfig = generateMock.mock.calls[1][0].config;
    expect(continuationConfig).toBeDefined();
    expect(continuationConfig.cachedContent).toBe("cachedContents/composite-test-123");
    expect(continuationConfig.systemInstruction).toBeUndefined();
    expect(continuationConfig.tools).toBeUndefined();
  });
});
