import { describe, it, expect, vi, beforeEach } from "vitest";
import type OpenAI from "openai";
import { createOpenAICompatibleStream } from "./openai-stream";

vi.mock("./gemini-stream", () => ({
  sendInitialMetaEvents: vi.fn(),
  generateAndSendOptimisticTitle: vi.fn(),
}));

vi.mock("./post-processing", () => ({
  processPostStream: vi.fn(),
}));

describe("createOpenAICompatibleStream message mapping (STR-01)", () => {
  let mockCreate: ReturnType<typeof vi.fn>;
  let mockAi: OpenAI;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate = vi.fn().mockImplementation(async () => {
      async function* generate() {
        yield { choices: [{ delta: { content: "Test response" } }] };
      }
      return generate();
    });
    mockAi = {
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    } as unknown as OpenAI;
  });

  const baseParams = {
    model: "gpt-4o",
    sysPrompt: "You are a helpful assistant",
    gemMeta: {
      gemId: null,
      hasSystemInstruction: false,
      systemInstructionChars: 0,
    },
    modelMeta: {
      model: "gpt-4o",
      family: "openai",
      thinkingLevel: "off",
      isGemini3: false,
    },
    createdConversation: null,
    shouldGenerateTitle: false,
    enableWebSearch: false,
    WEB_SEARCH_AVAILABLE: false,
    cookieWeb: "",
    userId: "user-123",
    conversationId: "conv-123",
    content: "hello",
    contextMessages: [],
    appendToContext: vi.fn(),
    saveMessage: vi.fn(),
    setConversationAutoTitle: vi.fn(),
    generateOptimisticTitle: vi.fn(),
    generateFinalTitle: vi.fn(),
  };

  async function consumeStream(stream: ReadableStream<Uint8Array>) {
    const reader = stream.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }
  }

  it("maps user message with inlineData image to role: 'user' with content parts (TC-STR-01A)", async () => {
    const contents = [
      {
        role: "user",
        parts: [
          { text: "Look at this:" },
          { inlineData: { mimeType: "image/png", data: "base64data==" } },
        ],
      },
    ];

    const stream = createOpenAICompatibleStream({
      ...baseParams,
      ai: mockAi,
      contents,
    });

    await consumeStream(stream);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const createArgs = mockCreate.mock.calls[0][0];
    const userMsg = createArgs.messages.find((m: { role: string }) => m.role === "user");
    expect(userMsg).toBeDefined();
    expect(userMsg.role).toBe("user");
    expect(Array.isArray(userMsg.content)).toBe(true);
    expect(userMsg.content).toEqual([
      { type: "text", text: "Look at this:" },
      { type: "image_url", image_url: { url: "data:image/png;base64,base64data==" } },
    ]);
  });

  it("degrades model message with image to plain text role: 'assistant' (TC-STR-01B)", async () => {
    const contents = [
      {
        role: "model",
        parts: [
          { text: "Here is an image I generated earlier" },
          { inlineData: { mimeType: "image/jpeg", data: "modelimg==" } },
        ],
      },
    ];

    const stream = createOpenAICompatibleStream({
      ...baseParams,
      ai: mockAi,
      contents,
    });

    await consumeStream(stream);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const createArgs = mockCreate.mock.calls[0][0];
    const assistantMsg = createArgs.messages.find((m: { role: string }) => m.role === "assistant");
    expect(assistantMsg).toBeDefined();
    expect(assistantMsg.role).toBe("assistant");
    // Must be plain text string, NOT array with image_url
    expect(typeof assistantMsg.content).toBe("string");
    expect(assistantMsg.content).toBe("Here is an image I generated earlier");
  });

  it("strips <think> tags from old model message before sending (TC-STR-01C / m-16)", async () => {
    const contents = [
      {
        role: "model",
        parts: [{ text: "<think>internal reasoning steps</think>The actual answer." }],
      },
    ];

    const stream = createOpenAICompatibleStream({
      ...baseParams,
      ai: mockAi,
      contents,
    });

    await consumeStream(stream);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const createArgs = mockCreate.mock.calls[0][0];
    const assistantMsg = createArgs.messages.find((m: { role: string }) => m.role === "assistant");
    expect(assistantMsg).toBeDefined();
    expect(assistantMsg.content).toBe("The actual answer.");
    expect(assistantMsg.content).not.toContain("<think>");
  });
});

describe("createOpenAICompatibleStream - GLM 5.2, Grok Reasoning & Error Mapping", () => {
  let mockCreate: ReturnType<typeof vi.fn>;
  let mockAi: OpenAI;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate = vi.fn().mockImplementation(async () => {
      async function* generate() {
        yield { choices: [{ delta: { content: "Test chunk" } }] };
      }
      return generate();
    });
    mockAi = {
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    } as unknown as OpenAI;
  });

  const baseParams = {
    sysPrompt: "You are a helpful assistant",
    gemMeta: {
      gemId: null,
      hasSystemInstruction: false,
      systemInstructionChars: 0,
    },
    modelMeta: {
      model: "z-ai/glm-5.2",
      family: "openai",
      thinkingLevel: "off",
      isGemini3: false,
    },
    createdConversation: null,
    shouldGenerateTitle: false,
    enableWebSearch: false,
    WEB_SEARCH_AVAILABLE: false,
    cookieWeb: "",
    userId: "user-123",
    conversationId: "conv-123",
    content: "hello",
    contextMessages: [],
    appendToContext: vi.fn(),
    saveMessage: vi.fn(),
    setConversationAutoTitle: vi.fn(),
    generateOptimisticTitle: vi.fn(),
    generateFinalTitle: vi.fn(),
  };

  async function consumeStream(stream: ReadableStream<Uint8Array>) {
    const reader = stream.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }
  }

  async function collectStreamEvents(stream: ReadableStream<Uint8Array>) {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events: Array<{ event: string; data: any }> = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() || "";
      for (const block of blocks) {
        const eventMatch = block.match(/event:\s*([^\n]+)/);
        const dataMatch = block.match(/data:\s*([^\n]+)/);
        if (eventMatch && dataMatch) {
          try {
            events.push({ event: eventMatch[1].trim(), data: JSON.parse(dataMatch[1].trim()) });
          } catch {
            events.push({ event: eventMatch[1].trim(), data: dataMatch[1].trim() });
          }
        }
      }
    }
    return events;
  }

  describe("Regression Token Limit Tests (B1)", () => {
    it("preserves 8192 max_tokens for anthropic/claude-haiku-4-5 (TC-REG-01)", async () => {
      const stream = createOpenAICompatibleStream({
        ...baseParams,
        model: "anthropic/claude-haiku-4-5",
        ai: mockAi,
        contents: [{ role: "user", parts: [{ text: "hi" }] }],
      });
      await consumeStream(stream);
      expect(mockCreate.mock.calls[0][0].max_tokens).toBe(8192);
    });

    it("preserves 8192 max_tokens for x-ai/grok-4.3 (TC-REG-02)", async () => {
      const stream = createOpenAICompatibleStream({
        ...baseParams,
        model: "x-ai/grok-4.3",
        ai: mockAi,
        contents: [{ role: "user", parts: [{ text: "hi" }] }],
      });
      await consumeStream(stream);
      expect(mockCreate.mock.calls[0][0].max_tokens).toBe(8192);
    });

    it("preserves 8192 max_tokens for llama-3.3-70b-versatile (TC-REG-03)", async () => {
      const stream = createOpenAICompatibleStream({
        ...baseParams,
        model: "llama-3.3-70b-versatile",
        ai: mockAi,
        contents: [{ role: "user", parts: [{ text: "hi" }] }],
      });
      await consumeStream(stream);
      expect(mockCreate.mock.calls[0][0].max_tokens).toBe(8192);
    });

    it("preserves 8192 max_tokens for deepseek/deepseek-v3.2:floor (TC-REG-04)", async () => {
      const stream = createOpenAICompatibleStream({
        ...baseParams,
        model: "deepseek/deepseek-v3.2:floor",
        ai: mockAi,
        contents: [{ role: "user", parts: [{ text: "hi" }] }],
      });
      await consumeStream(stream);
      expect(mockCreate.mock.calls[0][0].max_tokens).toBe(8192);
    });

    it("assigns safe GLM_MAX_OUTPUT_TOKENS (65536) for z-ai/glm-5.2 (TC-GLM-09)", async () => {
      const stream = createOpenAICompatibleStream({
        ...baseParams,
        model: "z-ai/glm-5.2",
        ai: mockAi,
        contents: [{ role: "user", parts: [{ text: "hi" }] }],
      });
      await consumeStream(stream);
      expect(mockCreate.mock.calls[0][0].max_tokens).toBe(65536);
    });

    it("injects CoreWeave FP4 provider routing for z-ai/glm-5.2", async () => {
      const stream = createOpenAICompatibleStream({
        ...baseParams,
        model: "z-ai/glm-5.2",
        ai: mockAi,
        contents: [{ role: "user", parts: [{ text: "hi" }] }],
      });
      await consumeStream(stream);
      expect(mockCreate.mock.calls[0][0].provider).toEqual({
        order: ["CoreWeave"],
        quantizations: ["fp4"],
      });
    });

    it("does not inject provider routing for other models", async () => {
      const stream = createOpenAICompatibleStream({
        ...baseParams,
        model: "x-ai/grok-4.3",
        ai: mockAi,
        contents: [{ role: "user", parts: [{ text: "hi" }] }],
      });
      await consumeStream(stream);
      expect(mockCreate.mock.calls[0][0].provider).toBeUndefined();
    });
  });

  describe("Reasoning Bidirectional Control (N1)", () => {
    it("disables reasoning for z-ai/glm-5.2 when thinkingLevel is undefined (TC-GLM-06)", async () => {
      const stream = createOpenAICompatibleStream({
        ...baseParams,
        model: "z-ai/glm-5.2",
        thinkingLevel: undefined,
        ai: mockAi,
        contents: [{ role: "user", parts: [{ text: "hi" }] }],
      });
      await consumeStream(stream);
      expect(mockCreate.mock.calls[0][0].reasoning).toEqual({ enabled: false });
    });

    it("disables reasoning for z-ai/glm-5.2 when thinkingLevel is 'off' (TC-GLM-06B)", async () => {
      const stream = createOpenAICompatibleStream({
        ...baseParams,
        model: "z-ai/glm-5.2",
        thinkingLevel: "off",
        ai: mockAi,
        contents: [{ role: "user", parts: [{ text: "hi" }] }],
      });
      await consumeStream(stream);
      expect(mockCreate.mock.calls[0][0].reasoning).toEqual({ enabled: false });
    });

    it("sets effort 'high' for z-ai/glm-5.2 when thinkingLevel is 'high' (TC-GLM-07)", async () => {
      const stream = createOpenAICompatibleStream({
        ...baseParams,
        model: "z-ai/glm-5.2",
        thinkingLevel: "high",
        ai: mockAi,
        contents: [{ role: "user", parts: [{ text: "hi" }] }],
      });
      await consumeStream(stream);
      expect(mockCreate.mock.calls[0][0].reasoning).toEqual({ effort: "high" });
    });

    it("upgrades effort to 'high' for z-ai/glm-5.2 when thinkingLevel is 'low' (TC-GLM-08)", async () => {
      const stream = createOpenAICompatibleStream({
        ...baseParams,
        model: "z-ai/glm-5.2",
        thinkingLevel: "low",
        ai: mockAi,
        contents: [{ role: "user", parts: [{ text: "hi" }] }],
      });
      await consumeStream(stream);
      expect(mockCreate.mock.calls[0][0].reasoning).toEqual({ effort: "high" });
    });

    it("preserves undefined reasoning for x-ai/grok-4.3 when thinkingLevel is undefined (TC-GROK-03)", async () => {
      const stream = createOpenAICompatibleStream({
        ...baseParams,
        model: "x-ai/grok-4.3",
        thinkingLevel: undefined,
        ai: mockAi,
        contents: [{ role: "user", parts: [{ text: "hi" }] }],
      });
      await consumeStream(stream);
      expect(mockCreate.mock.calls[0][0].reasoning).toBeUndefined();
    });

    it("disables reasoning for x-ai/grok-4.3 when thinkingLevel is 'off' (TC-GROK-01)", async () => {
      const stream = createOpenAICompatibleStream({
        ...baseParams,
        model: "x-ai/grok-4.3",
        thinkingLevel: "off",
        ai: mockAi,
        contents: [{ role: "user", parts: [{ text: "hi" }] }],
      });
      await consumeStream(stream);
      expect(mockCreate.mock.calls[0][0].reasoning).toEqual({ enabled: false });
    });

    it("sets effort 'low' for x-ai/grok-4.3 when thinkingLevel is 'low' (TC-GROK-02)", async () => {
      const stream = createOpenAICompatibleStream({
        ...baseParams,
        model: "x-ai/grok-4.3",
        thinkingLevel: "low",
        ai: mockAi,
        contents: [{ role: "user", parts: [{ text: "hi" }] }],
      });
      await consumeStream(stream);
      expect(mockCreate.mock.calls[0][0].reasoning).toEqual({ effort: "low" });
    });
  });

  describe("Error Mapping Tests (N3)", () => {
    it("maps HTTP 402 / insufficient credits to INSUFFICIENT_CREDITS error event (TC-GLM-15)", async () => {
      mockCreate.mockRejectedValueOnce({
        status: 402,
        error: { message: "Insufficient credits in account" },
      });

      const stream = createOpenAICompatibleStream({
        ...baseParams,
        model: "z-ai/glm-5.2",
        ai: mockAi,
        contents: [{ role: "user", parts: [{ text: "hi" }] }],
      });

      const events = await collectStreamEvents(stream);
      const errorEvent = events.find((e) => e.event === "error");
      expect(errorEvent).toBeDefined();
      expect(errorEvent?.data.code).toBe("INSUFFICIENT_CREDITS");
      expect(errorEvent?.data.status).toBe(402);
      expect(errorEvent?.data.isInsufficientCredits).toBe(true);
    });

    it("maps HTTP 400 context overflow to CONTEXT_LENGTH_EXCEEDED error event (TC-GLM-16)", async () => {
      mockCreate.mockRejectedValueOnce({
        status: 400,
        message: "maximum context length exceeded: 1048577 tokens",
      });

      const stream = createOpenAICompatibleStream({
        ...baseParams,
        model: "z-ai/glm-5.2",
        ai: mockAi,
        contents: [{ role: "user", parts: [{ text: "hi" }] }],
      });

      const events = await collectStreamEvents(stream);
      const errorEvent = events.find((e) => e.event === "error");
      expect(errorEvent).toBeDefined();
      expect(errorEvent?.data.code).toBe("CONTEXT_LENGTH_EXCEEDED");
      expect(errorEvent?.data.isTokenLimit).toBe(true);
    });
  });
});
