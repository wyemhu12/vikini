// src/app/api/chat-stream/streaming/deepseek-stream.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type OpenAI from "openai";
import { createDeepSeekStream } from "./deepseek-stream";
import { processPostStream } from "./post-processing";

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

  it("configures max_tokens: 65536 and reasoning effort xhigh for DeepSeek V4 Pro", async () => {
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
      modelMeta: { maxOutputTokens: 65536 },
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
    expect(requestBody.max_tokens).toBe(65536);
    expect(requestBody.include_reasoning).toBe(true);
    expect(requestBody.reasoning).toEqual({ effort: "xhigh" });
    expect(requestBody.reasoning_effort).toBe("xhigh");
    expect(requestBody.provider?.order).toEqual(["StreamLake"]);
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
      modelMeta: { maxOutputTokens: 65536 },
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

  it("emits emptyAnswerNotice meta event when finish_reason is length and no answer content was emitted", async () => {
    // Simulates reasoning tokens consuming max_tokens, ending with finish_reason: "length"
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
      modelMeta: { maxOutputTokens: 65536 },
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
    // Does NOT contain hardcoded Vietnamese server text
    expect(output).not.toContain("Quá trình suy nghĩ đã đạt giới hạn độ dài token");
    // Emits meta event emptyAnswerNotice with reason: "length"
    expect(output).toContain("emptyAnswerNotice");
    expect(output).toContain('"reason":"length"');
    // processPostStream called with emptyAnswerReason: "length"
    expect(processPostStream).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ emptyAnswerReason: "length" })
    );
  });

  it("emits emptyAnswerNotice meta event when stream finishes without answer content and finish_reason is not length", async () => {
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
      modelMeta: { maxOutputTokens: 65536 },
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
    expect(output).not.toContain("Mô hình đã hoàn tất suy nghĩ nhưng chưa xuất nội dung trả lời");
    expect(output).toContain("emptyAnswerNotice");
    expect(output).toContain('"reason":"no_content"');
    expect(processPostStream).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ emptyAnswerReason: "no_content" })
    );
  });

  it("configures Relace, Together, Novita, DeepSeek providers and 384000 max_tokens for DeepSeek V4.1 Flash", async () => {
    mockCreate.mockResolvedValue(
      createAsyncIterable([
        {
          choices: [
            {
              delta: { content: "V4.1 Flash response" },
              finish_reason: "stop",
            },
          ],
        },
      ])
    );

    const stream = createDeepSeekStream({
      ai: mockAi,
      model: "deepseek/deepseek-v4.1-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: "Check this image" },
            { inlineData: { mimeType: "image/png", data: "base64data==" } },
          ],
        },
      ],
      sysPrompt: "System instruction",
      thinkingLevel: "high",
      gemMeta: { gemId: null },
      modelMeta: { maxOutputTokens: 384000 },
      createdConversation: null,
      shouldGenerateTitle: false,
      enableWebSearch: false,
      WEB_SEARCH_AVAILABLE: false,
      cookieWeb: "",
      userId: "user-1",
      conversationId: "conv-1",
      content: "Check this image",
      contextMessages: [],
      appendToContext: vi.fn(),
      saveMessage: vi.fn(),
      setConversationAutoTitle: vi.fn(),
      generateOptimisticTitle: vi.fn(),
      generateFinalTitle: vi.fn(),
    });

    const output = await readStream(stream);
    expect(output).toContain("V4.1 Flash response");

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const requestBody = mockCreate.mock.calls[0][0];

    // Provider routing without Chutes
    expect(requestBody.provider).toEqual({
      order: ["Relace", "Together", "Novita", "DeepSeek"],
      allow_fallbacks: true,
    });

    // Max tokens: 384000 without artificial caps
    expect(requestBody.max_tokens).toBe(384000);

    // Thinking mode config via OpenRouter
    expect(requestBody.include_reasoning).toBe(true);
    expect(requestBody.reasoning).toEqual({ effort: "high" });

    // Multimodal image part
    const userMessage = requestBody.messages[1];
    expect(userMessage.role).toBe("user");
    expect(Array.isArray(userMessage.content)).toBe(true);
    expect(userMessage.content).toEqual([
      {
        type: "text",
        text: "Check this image",
      },
      {
        type: "image_url",
        image_url: { url: "data:image/png;base64,base64data==" },
      },
    ]);
  });

  it("handles completely empty stream (Case A) with empty_response 502 error and skips post-processing", async () => {
    mockCreate.mockResolvedValue(
      createAsyncIterable([
        {
          choices: [
            {
              delta: {},
              finish_reason: "stop",
            },
          ],
        },
      ])
    );

    const stream = createDeepSeekStream({
      ai: mockAi,
      model: "deepseek/deepseek-v4.1-flash",
      contents: [{ role: "user", parts: [{ text: "Empty question" }] }],
      sysPrompt: "System instruction",
      thinkingLevel: "high",
      gemMeta: { gemId: null },
      modelMeta: { maxOutputTokens: 384000 },
      createdConversation: null,
      shouldGenerateTitle: false,
      enableWebSearch: false,
      WEB_SEARCH_AVAILABLE: false,
      cookieWeb: "",
      userId: "user-1",
      conversationId: "conv-1",
      content: "Empty question",
      contextMessages: [],
      appendToContext: vi.fn(),
      saveMessage: vi.fn(),
      setConversationAutoTitle: vi.fn(),
      generateOptimisticTitle: vi.fn(),
      generateFinalTitle: vi.fn(),
    });

    const output = await readStream(stream);

    expect(output).toContain("empty_response");
    expect(output).toContain('"status":502');
    expect(output).toContain('"ok":false');
    // Does NOT emit emptyAnswerNotice
    expect(output).not.toContain("emptyAnswerNotice");
    // processPostStream must NOT be called for completely empty response
    expect(processPostStream).not.toHaveBeenCalled();
  });
});
