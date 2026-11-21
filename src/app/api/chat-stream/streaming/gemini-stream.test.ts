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

vi.mock("./thought-signatures", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./thought-signatures")>()),
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
    model: "gemini-3.5-flash-lite",
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
    upsertAssistantMessage: vi.fn().mockResolvedValue({}),
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

  it("calls upsertAssistantMessage with isPartial: true when aborted during for await loop (Q1, S1)", async () => {
    const upsertAssistantMessageMock = vi.fn().mockResolvedValue({});
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
      model: "gemini-3.5-flash-lite",
      upsertAssistantMessage: upsertAssistantMessageMock,
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

    // Verify upsertAssistantMessage WAS called with isPartial: true and the accumulated text
    expect(upsertAssistantMessageMock).toHaveBeenCalledTimes(1);
    expect(upsertAssistantMessageMock).toHaveBeenCalledWith(
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
      model: "gemini-3.5-flash-lite",
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

  it("TC-GS-01: normalizes legacy gemini-2.5-flash to gemini-3.5-flash-lite with thinkingLevel and no thinkingBudget", async () => {
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
    const callArg = generateMock.mock.calls[0][0];
    expect(callArg.model).toBe("gemini-3.5-flash-lite");

    const callConfig = callArg.config;
    expect(callConfig.thinkingConfig).toEqual({
      thinkingLevel: "high",
      includeThoughts: true,
    });
    expect(callConfig.thinkingConfig).not.toHaveProperty("thinkingBudget");
    expect(callConfig).not.toHaveProperty("temperature");
  });

  it("TC-GS-02: clamps minimal thinkingLevel to low for gemini-3.8-flash", async () => {
    const generateMock = vi.fn().mockImplementation(async function* () {
      yield { candidates: [{ content: { parts: [{ text: "Response" }] } }] };
    });

    const params = createMockParams({
      ai: { models: { generateContentStream: generateMock } } as unknown as ChatStreamParams["ai"],
      model: "gemini-3.8-flash",
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
  });

  it("TC-GS-03: continuation call preserves normalized model, thinkingLevel, functionResponse id/name, and injects DUMMY_THOUGHT_SIGNATURE when missing", async () => {
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
                      name: "getTime",
                      args: {},
                      id: "fc-1",
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
                parts: [{ text: "The time is noon." }],
              },
            },
          ],
        };
      }
    });

    const params = createMockParams({
      ai: { models: { generateContentStream: generateMock } } as unknown as ChatStreamParams["ai"],
      model: "gemini-2.5-pro",
      thinkingLevel: "medium",
      tools: [{ functionDeclarations: [{ name: "getTime" }] }],
    });

    const reader = createChatReadableStream(params).getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    expect(generateMock).toHaveBeenCalledTimes(2);
    const contCall = generateMock.mock.calls[1][0];
    expect(contCall.model).toBe("gemini-4-hydrogen");
    expect(contCall.config.thinkingConfig).toEqual({ thinkingLevel: "medium" });

    const contContents = contCall.contents as Array<{ role: string; parts: unknown[] }>;
    const modelTurn = contContents[contContents.length - 2];
    const userTurn = contContents[contContents.length - 1];

    expect(modelTurn?.role).toBe("model");
    expect(modelTurn?.parts).toEqual([
      {
        functionCall: {
          name: "getTime",
          args: {},
          id: "fc-1",
        },
        thoughtSignature: "context_engineering_is_the_way_to_go",
      },
    ]);
    expect(userTurn?.role).toBe("user");
    expect(userTurn?.parts).toEqual([
      {
        functionResponse: {
          name: "getTime",
          id: "fc-1",
          response: { result: "mock tool output" },
        },
      },
    ]);
  });

  it("TC-GS-04: continuation call preserves real thoughtSignature on functionCall part without overwriting", async () => {
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
                      name: "getTime",
                      args: {},
                      id: "fc-1",
                    },
                    thoughtSignature: "sig-real",
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
                parts: [{ text: "Done." }],
              },
            },
          ],
        };
      }
    });

    const params = createMockParams({
      ai: { models: { generateContentStream: generateMock } } as unknown as ChatStreamParams["ai"],
      model: "gemini-3.8-flash",
      thinkingLevel: "medium",
      tools: [{ functionDeclarations: [{ name: "getTime" }] }],
    });

    const reader = createChatReadableStream(params).getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    const contCall = generateMock.mock.calls[1][0];
    const contContents = contCall.contents as Array<{ role: string; parts: unknown[] }>;
    const modelTurn = contContents[contContents.length - 2];
    expect(modelTurn?.parts).toEqual([
      {
        functionCall: {
          name: "getTime",
          args: {},
          id: "fc-1",
        },
        thoughtSignature: "sig-real",
      },
    ]);
  });

  it("TC-GS-05: continuation call omits thinkingConfig when thinkingLevel is off", async () => {
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
                      name: "getTime",
                      args: {},
                      id: "fc-1",
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
                parts: [{ text: "Done." }],
              },
            },
          ],
        };
      }
    });

    const params = createMockParams({
      ai: { models: { generateContentStream: generateMock } } as unknown as ChatStreamParams["ai"],
      model: "gemini-3.5-flash-lite",
      thinkingLevel: "off",
      tools: [{ functionDeclarations: [{ name: "getTime" }] }],
    });

    const reader = createChatReadableStream(params).getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    const contCall = generateMock.mock.calls[1][0];
    expect(contCall.config).not.toHaveProperty("thinkingConfig");
  });

  it("clamps minimal to low for legacy Gemini 3.1 Pro alias (→ 3.8 Flash)", async () => {
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
    expect(generateMock.mock.calls[0][0].model).toBe("gemini-4-hydrogen");
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
      model: "gemini-3.5-flash-lite",
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
      model: "gemini-3.5-flash-lite",
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
      model: "gemini-3.5-flash-lite",
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

  it("sets thinkingConfig with thinkingLevel: xhigh and includeThoughts: true for Gemini 4 Neon", async () => {
    const generateMock = vi.fn().mockImplementation(async function* () {
      yield { candidates: [{ content: { parts: [{ text: "Neon response" }] } }] };
    });

    const params = createMockParams({
      ai: { models: { generateContentStream: generateMock } } as unknown as ChatStreamParams["ai"],
      model: "gemini-4-neon",
      thinkingLevel: "xhigh",
    });

    const reader = createChatReadableStream(params).getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    expect(generateMock).toHaveBeenCalledTimes(1);
    const callConfig = generateMock.mock.calls[0][0].config;
    expect(callConfig.thinkingConfig).toEqual({
      thinkingLevel: "xhigh",
      includeThoughts: true,
    });
    expect(callConfig.thinkingConfig).not.toHaveProperty("thinkingBudget");
    expect(callConfig).not.toHaveProperty("temperature");
    expect(callConfig).not.toHaveProperty("top_p");
    expect(callConfig).not.toHaveProperty("top_k");
  });

  it("clamps minimal and off to low (Always-On Thinking) and defaults undefined to medium for Gemini 4 Neon", async () => {
    for (const [requested, expected] of [
      ["minimal", "low"],
      ["off", "low"],
      [undefined, "medium"],
    ] as const) {
      const generateMock = vi.fn().mockImplementation(async function* () {
        yield { candidates: [{ content: { parts: [{ text: "Neon response" }] } }] };
      });

      const params = createMockParams({
        ai: {
          models: { generateContentStream: generateMock },
        } as unknown as ChatStreamParams["ai"],
        model: "gemini-4-neon",
        thinkingLevel: requested,
      });

      const reader = createChatReadableStream(params).getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      expect(generateMock).toHaveBeenCalledTimes(1);
      const callConfig = generateMock.mock.calls[0][0].config;
      expect(callConfig.thinkingConfig).toEqual({
        thinkingLevel: expected,
        includeThoughts: true,
      });
    }
  });

  it("emits MODEL_TIER_RESTRICTED without retrying tools fallback on HTTP 403 for gemini-4-neon", async () => {
    const tierError = Object.assign(
      new Error("Model gemini-4-neon is not available on the Free tier (PERMISSION_DENIED)"),
      { status: 403 }
    );
    const generateMock = vi.fn().mockRejectedValue(tierError);

    const params = createMockParams({
      ai: { models: { generateContentStream: generateMock } } as unknown as ChatStreamParams["ai"],
      model: "gemini-4-neon",
      tools: [{ googleSearch: {} }],
    });

    const reader = createChatReadableStream(params).getReader();
    const decoder = new TextDecoder();
    let streamOutput = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      streamOutput += decoder.decode(value, { stream: true });
    }

    expect(generateMock).toHaveBeenCalledTimes(1);
    expect(streamOutput).toContain('"code":"MODEL_TIER_RESTRICTED"');
    expect(streamOutput).not.toContain("webSearchFallback");
  });

  it("returns 900000ms (15m) timeout for gemini-4-neon, gemini-4-hydrogen, and legacy argon", async () => {
    const { getStreamTimeout } = await import("./utils");
    expect(getStreamTimeout("gemini-4-neon", "xhigh")).toBe(900000);
    expect(getStreamTimeout("gemini-4-hydrogen", "medium")).toBe(900000);
    expect(getStreamTimeout("gemini-4-argon", "medium")).toBe(900000);
    expect(getStreamTimeout("gemini-4-argon-preview", "low")).toBe(900000);
  });

  it("TC-W1-08: renders executableCode and codeExecutionResult parts into token stream", async () => {
    const generateMock = vi.fn().mockImplementation(async function* () {
      yield {
        candidates: [
          {
            content: {
              parts: [
                { executableCode: { language: "PYTHON", code: "print(2 + 2)" } },
                { codeExecutionResult: { output: "4\n", outcome: "OUTCOME_OK" } },
              ],
            },
          },
        ],
      };
    });

    const params = createMockParams({
      ai: { models: { generateContentStream: generateMock } } as unknown as ChatStreamParams["ai"],
    });

    const reader = createChatReadableStream(params).getReader();
    const decoder = new TextDecoder();
    let out = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      out += decoder.decode(value, { stream: true });
    }

    expect(out).toContain("```python");
    expect(out).toContain("print(2 + 2)");
    expect(out).toContain("**Output:**");
  });

  it("TC-W1-08: emits exactly ONE error SSE event when tools array is empty and stream fails", async () => {
    const generateMock = vi.fn().mockRejectedValueOnce(new Error("Internal backend failure"));
    const params = createMockParams({
      ai: { models: { generateContentStream: generateMock } } as unknown as ChatStreamParams["ai"],
      tools: [],
    });

    const reader = createChatReadableStream(params).getReader();
    const decoder = new TextDecoder();
    let out = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      out += decoder.decode(value, { stream: true });
    }

    const errorMatches = out.match(/event: error/g) || [];
    expect(errorMatches).toHaveLength(1);
    expect(out).toContain('"ok":false');
  });

  it("TC-W1-08: emits exactly ONE STREAM_TIMEOUT event, saves partial content, and sends done { ok: false } when primary stream stalls mid-stream", async () => {
    vi.useFakeTimers();
    const upsertMock = vi.fn().mockResolvedValue({});
    const generateMock = vi.fn().mockReturnValue({
      [Symbol.asyncIterator]() {
        let count = 0;
        return {
          next() {
            if (count++ === 0) {
              return Promise.resolve({
                value: {
                  candidates: [{ content: { parts: [{ text: "Partial before idle stall" }] } }],
                },
                done: false,
              });
            }
            return new Promise(() => {}); // Stalls forever
          },
        };
      },
    });

    const params = createMockParams({
      ai: { models: { generateContentStream: generateMock } } as unknown as ChatStreamParams["ai"],
      upsertAssistantMessage: upsertMock,
    });

    const readable = createChatReadableStream(params);
    const reader = readable.getReader();
    const decoder = new TextDecoder();
    let out = "";

    const readAll = (async () => {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        out += decoder.decode(value, { stream: true });
      }
    })();

    // Advance past idleTimeoutMs (default FLASH timeout is 240s -> idle is 120s)
    try {
      await vi.advanceTimersByTimeAsync(130_000);
      await readAll;
    } finally {
      vi.useRealTimers();
    }

    const errorMatches = out.match(/event: error/g) || [];
    expect(errorMatches).toHaveLength(1);
    expect(out).toContain('"code":"STREAM_TIMEOUT"');
    expect(out).toContain('"ok":false');
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "Partial before idle stall",
      })
    );
  });

  it("TC-W1-08: propagates StreamTimeoutError out of continuation stream, emits STREAM_TIMEOUT once, and finishes ok: false", async () => {
    vi.useFakeTimers();
    const upsertMock = vi.fn().mockResolvedValue({});
    let callCount = 0;
    const generateMock = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return (async function* () {
          yield {
            candidates: [
              {
                content: {
                  parts: [
                    { text: "Checking time..." },
                    { functionCall: { name: "getTime", args: {}, id: "fc-t" } },
                  ],
                },
              },
            ],
          };
        })();
      }
      // Continuation stream stalls forever
      return {
        [Symbol.asyncIterator]() {
          return {
            next: () => new Promise(() => {}),
          };
        },
      };
    });

    const params = createMockParams({
      ai: { models: { generateContentStream: generateMock } } as unknown as ChatStreamParams["ai"],
      tools: [{ functionDeclarations: [{ name: "getTime" }] }],
      upsertAssistantMessage: upsertMock,
    });

    const readable = createChatReadableStream(params);
    const reader = readable.getReader();
    const decoder = new TextDecoder();
    let out = "";

    const readAll = (async () => {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        out += decoder.decode(value, { stream: true });
      }
    })();

    try {
      await vi.advanceTimersByTimeAsync(130_000);
      await readAll;
    } finally {
      vi.useRealTimers();
    }

    const errorMatches = out.match(/event: error/g) || [];
    expect(errorMatches).toHaveLength(1);
    expect(out).toContain('"code":"STREAM_TIMEOUT"');
    expect(out).toContain('"ok":false');
    expect(out).not.toContain('"ok":true');
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });
});
