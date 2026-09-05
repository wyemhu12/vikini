// src/app/api/chat-stream/streaming/deepseek-stream.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type OpenAI from "openai";
import { createDeepSeekStream } from "./deepseek-stream";

// Mock dependencies
vi.mock("./gemini-stream", () => ({
  sendInitialMetaEvents: vi.fn(),
  generateAndSendOptimisticTitle: vi.fn(),
}));

vi.mock("./post-processing", () => ({
  processPostStream: vi.fn(),
}));

describe("createDeepSeekStream", () => {
  let mockCreate: ReturnType<typeof vi.fn>;
  let mockAi: OpenAI;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate = vi.fn();
    mockAi = {
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    } as unknown as OpenAI;
  });

  async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let result = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
    }
    return result;
  }

  async function* createAsyncIterable<T>(items: T[]): AsyncIterable<T> {
    for (const item of items) {
      yield item;
    }
  }

  it("configures max_tokens: 16384 and reasoning effort when thinking is high", async () => {
    mockCreate.mockResolvedValue(
      createAsyncIterable([
        {
          choices: [
            {
              delta: { content: "Hello!" },
              finish_reason: "stop",
            },
          ],
        },
      ])
    );

    const stream = createDeepSeekStream({
      ai: mockAi,
      model: "deepseek/deepseek-v4-pro",
      contents: [{ role: "user", parts: [{ text: "Hello" }] }],
      sysPrompt: "System instruction",
      thinkingLevel: "high",
      gemMeta: { gemId: null },
      modelMeta: { maxOutputTokens: 16384 },
      createdConversation: null,
      shouldGenerateTitle: false,
      enableWebSearch: false,
      WEB_SEARCH_AVAILABLE: false,
      cookieWeb: "",
      userId: "user-1",
      conversationId: "conv-1",
      content: "Hello",
      contextMessages: [],
      appendToContext: vi.fn(),
      saveMessage: vi.fn(),
      setConversationAutoTitle: vi.fn(),
      generateOptimisticTitle: vi.fn(),
      generateFinalTitle: vi.fn(),
    });

    await readStream(stream);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const requestBody = mockCreate.mock.calls[0][0];
    expect(requestBody.max_tokens).toBe(16384);
    expect(requestBody.include_reasoning).toBe(true);
    expect(requestBody.reasoning).toEqual({ effort: "max" });
    expect(requestBody.reasoning_effort).toBe("max");
    // System prompt includes calibrated reasoning prefix
    expect(requestBody.messages[0].content).toContain("Reasoning Effort: High depth deliberation.");
  });

  it("handles thinking tokens and closes think tag before content tokens", async () => {
    mockCreate.mockResolvedValue(
      createAsyncIterable([
        {
          choices: [
            {
              delta: { reasoning_content: "Analyzing question..." },
            },
          ],
        },
        {
          choices: [
            {
              delta: { content: "The answer is 42." },
              finish_reason: "stop",
            },
          ],
        },
      ])
    );

    const stream = createDeepSeekStream({
      ai: mockAi,
      model: "deepseek/deepseek-v4-pro",
      contents: [{ role: "user", parts: [{ text: "What is the answer?" }] }],
      sysPrompt: "System instruction",
      thinkingLevel: "high",
      gemMeta: { gemId: null },
      modelMeta: { maxOutputTokens: 16384 },
      createdConversation: null,
      shouldGenerateTitle: false,
      enableWebSearch: false,
      WEB_SEARCH_AVAILABLE: false,
      cookieWeb: "",
      userId: "user-1",
      conversationId: "conv-1",
      content: "What is the answer?",
      contextMessages: [],
      appendToContext: vi.fn(),
      saveMessage: vi.fn(),
      setConversationAutoTitle: vi.fn(),
      generateOptimisticTitle: vi.fn(),
      generateFinalTitle: vi.fn(),
    });

    const output = await readStream(stream);

    expect(output).toContain("<think>");
    expect(output).toContain("Analyzing question...");
    expect(output).toContain("</think>");
    expect(output).toContain("The answer is 42.");
  });

  it("appends token limit notice when finish_reason is length and no answer content was emitted", async () => {
    // Simulates the exact user bug: reasoning tokens consume max_tokens, ending with finish_reason: "length"
    mockCreate.mockResolvedValue(
      createAsyncIterable([
        {
          choices: [
            {
              delta: { reasoning_content: "Deep thinking over extensive context..." },
            },
          ],
        },
        {
          choices: [
            {
              delta: {},
              finish_reason: "length",
            },
          ],
        },
      ])
    );

    const stream = createDeepSeekStream({
      ai: mockAi,
      model: "deepseek/deepseek-v4-pro",
      contents: [{ role: "user", parts: [{ text: "Complex prompt with RAG" }] }],
      sysPrompt: "System instruction with lots of context",
      thinkingLevel: "high",
      gemMeta: { gemId: null },
      modelMeta: { maxOutputTokens: 16384 },
      createdConversation: null,
      shouldGenerateTitle: false,
      enableWebSearch: false,
      WEB_SEARCH_AVAILABLE: false,
      cookieWeb: "",
      userId: "user-1",
      conversationId: "conv-1",
      content: "Complex prompt",
      contextMessages: [],
      appendToContext: vi.fn(),
      saveMessage: vi.fn(),
      setConversationAutoTitle: vi.fn(),
      generateOptimisticTitle: vi.fn(),
      generateFinalTitle: vi.fn(),
    });

    const output = await readStream(stream);

    // It should have auto-closed the thinking tag
    expect(output).toContain("</think>");
    // It should append the token limit explanation rather than leaving empty answer content
    expect(output).toContain("Quá trình suy nghĩ đã đạt giới hạn độ dài token");
  });

  it("appends retry notice when stream finishes without answer content and finish_reason is not length", async () => {
    mockCreate.mockResolvedValue(
      createAsyncIterable([
        {
          choices: [
            {
              delta: { reasoning_content: "Brief deliberation" },
              finish_reason: "stop",
            },
          ],
        },
      ])
    );

    const stream = createDeepSeekStream({
      ai: mockAi,
      model: "deepseek/deepseek-v4-pro",
      contents: [{ role: "user", parts: [{ text: "Test" }] }],
      sysPrompt: "System instruction",
      thinkingLevel: "high",
      gemMeta: { gemId: null },
      modelMeta: { maxOutputTokens: 16384 },
      createdConversation: null,
      shouldGenerateTitle: false,
      enableWebSearch: false,
      WEB_SEARCH_AVAILABLE: false,
      cookieWeb: "",
      userId: "user-1",
      conversationId: "conv-1",
      content: "Test",
      contextMessages: [],
      appendToContext: vi.fn(),
      saveMessage: vi.fn(),
      setConversationAutoTitle: vi.fn(),
      generateOptimisticTitle: vi.fn(),
      generateFinalTitle: vi.fn(),
    });

    const output = await readStream(stream);

    expect(output).toContain("</think>");
    expect(output).toContain("Mô hình đã hoàn tất suy nghĩ nhưng chưa xuất nội dung trả lời");
  });
});
