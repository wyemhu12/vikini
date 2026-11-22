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
    upsertAssistantMessage: vi.fn(),
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
    upsertAssistantMessage: vi.fn(),
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
    it("preserves 8192 max_tokens for anthropic/claude-haiku-5.5 (TC-REG-01)", async () => {
      const stream = createOpenAICompatibleStream({
        ...baseParams,
        model: "anthropic/claude-haiku-5.5",
        ai: mockAi,
        contents: [{ role: "user", parts: [{ text: "hi" }] }],
      });
      await consumeStream(stream);
      expect(mockCreate.mock.calls[0][0].max_tokens).toBe(8192);
    });

    it("preserves 8192 max_tokens for x-ai/grok-4.7 (TC-REG-02)", async () => {
      const stream = createOpenAICompatibleStream({
        ...baseParams,
        model: "x-ai/grok-4.7",
        ai: mockAi,
        contents: [{ role: "user", parts: [{ text: "hi" }] }],
      });
      await consumeStream(stream);
      expect(mockCreate.mock.calls[0][0].max_tokens).toBe(8192);
    });

    it("TC-MC-03: maps xhigh to effort high for x-ai/grok-4.7", async () => {
      const stream = createOpenAICompatibleStream({
        ...baseParams,
        model: "x-ai/grok-4.7",
        thinkingLevel: "xhigh",
        ai: mockAi,
        contents: [{ role: "user", parts: [{ text: "hi" }] }],
      });
      await consumeStream(stream);
      expect(mockCreate.mock.calls[0][0].reasoning).toEqual({ effort: "high" });
    });

    it("TC-MC-05: preserves 8192 max_tokens and omits OpenRouter-only fields for Groq openai/gpt-oss-120b", async () => {
      const stream = createOpenAICompatibleStream({
        ...baseParams,
        model: "openai/gpt-oss-120b",
        thinkingLevel: "xhigh",
        ai: mockAi,
        contents: [{ role: "user", parts: [{ text: "hi" }] }],
      });
      await consumeStream(stream);
      const payload = mockCreate.mock.calls[0][0];
      expect(payload.max_tokens).toBe(8192);
      expect(payload.reasoning).toBeUndefined();
      expect(payload.provider).toBeUndefined();
      expect(payload.tools).toBeUndefined();
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

    it("TC-W1-08: does NOT call processPostStream when stream fails mid-stream after partial content (saves partial once)", async () => {
      const { processPostStream } = await import("./post-processing");
      const upsertMock = vi.fn().mockResolvedValue({});
      mockCreate.mockImplementationOnce(async () => {
        async function* failingGen() {
          yield { choices: [{ delta: { content: "Partial token before crash" } }] };
          throw new Error("Upstream connection dropped");
        }
        return failingGen();
      });

      const stream = createOpenAICompatibleStream({
        ...baseParams,
        model: "z-ai/glm-5.2",
        ai: mockAi,
        contents: [{ role: "user", parts: [{ text: "hi" }] }],
        upsertAssistantMessage: upsertMock,
      });

      const events = await collectStreamEvents(stream);
      expect(upsertMock).toHaveBeenCalledTimes(1);
      expect(processPostStream).not.toHaveBeenCalled();
      expect(events.some((e) => e.event === "done" && e.data.ok === false)).toBe(true);
    });

    it("TC-W2A-16: forwards usageMetadata from final chunk into processPostStream", async () => {
      const { processPostStream } = await import("./post-processing");
      mockCreate.mockImplementationOnce(async () => {
        async function* genWithUsage() {
          yield { choices: [{ delta: { content: "Answer" } }] };
          yield {
            choices: [],
            usage: {
              prompt_tokens: 120,
              completion_tokens: 30,
              total_tokens: 150,
              completion_tokens_details: { reasoning_tokens: 10 },
            },
          };
        }
        return genWithUsage();
      });

      const stream = createOpenAICompatibleStream({
        ...baseParams,
        model: "z-ai/glm-5.2",
        ai: mockAi,
        contents: [{ role: "user", parts: [{ text: "hi" }] }],
      });

      await consumeStream(stream);
      expect(processPostStream).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          usageMetadata: {
            promptTokenCount: 120,
            candidatesTokenCount: 30,
            thoughtsTokenCount: 10,
            totalTokenCount: 150,
          },
        })
      );
    });

    it("TC-CL-02 (NP): maps PDF file block + plugins ONLY for OpenRouter Claude with PDF, omits plugins for text-only, and keeps content: string for Groq/Grok/GLM/DeepSeek V3.2", async () => {
      const initialUrlContext = [
        {
          retrievedUrl: "https://docs.google.com/document/d/1OrClaudeDoc1234567/edit",
          status: "GOOGLE_DOC_PDF",
        },
      ];

      // 1. OpenRouter Claude WITH PDF -> sends type: "file" + plugins
      const pdfStream = createOpenAICompatibleStream({
        ...baseParams,
        model: "anthropic/claude-sonnet-5.5",
        ai: mockAi,
        contents: [
          {
            role: "user",
            parts: [
              { text: "Read PDF" },
              {
                inlineData: { mimeType: "application/pdf", data: "JVBERi0xLjQ=" },
                filename: "Spec.pdf",
              },
            ],
          },
        ],
        initialUrlContext,
      });
      const { sendInitialMetaEvents } = await import("./gemini-stream");
      const { processPostStream } = await import("./post-processing");
      await consumeStream(pdfStream);
      expect(sendInitialMetaEvents).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ initialUrlContext })
      );
      expect(processPostStream).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ urlContext: initialUrlContext })
      );
      const orPayload = mockCreate.mock.calls[0][0];
      expect(orPayload.plugins).toEqual([{ id: "file-parser", pdf: { engine: "native" } }]);
      expect(orPayload.messages[1].content).toEqual([
        { type: "text", text: "Read PDF" },
        {
          type: "file",
          file: {
            filename: "Spec.pdf",
            file_data: "data:application/pdf;base64,JVBERi0xLjQ=",
          },
        },
      ]);

      // 2. Negative Probe: OpenRouter Claude text-only -> MUST NOT attach plugins
      mockCreate.mockClear();
      const textOnlyStream = createOpenAICompatibleStream({
        ...baseParams,
        model: "anthropic/claude-sonnet-5.5",
        ai: mockAi,
        contents: [{ role: "user", parts: [{ text: "Plain question" }] }],
      });
      await consumeStream(textOnlyStream);
      expect(mockCreate.mock.calls[0][0].plugins).toBeUndefined();

      // 3. Negative Probe: Groq / Grok / GLM / DeepSeek V3.2 with filtered PDF part -> MUST stay string content (never [] or image_url)
      for (const nonClaudeModel of [
        "openai/gpt-oss-120b",
        "x-ai/grok-4.7",
        "z-ai/glm-5.2",
        "deepseek/deepseek-v3.2:floor",
      ]) {
        mockCreate.mockClear();
        const s = createOpenAICompatibleStream({
          ...baseParams,
          model: nonClaudeModel,
          ai: mockAi,
          contents: [
            {
              role: "user",
              parts: [
                { text: "Extracted text" },
                { inlineData: { mimeType: "application/pdf", data: "JVBERi0xLjQ=" } },
              ],
            },
          ],
        });
        await consumeStream(s);
        const p = mockCreate.mock.calls[0][0];
        expect(p.plugins).toBeUndefined();
        expect(typeof p.messages[1].content).toBe("string");
        expect(p.messages[1].content).toBe("Extracted text");
      }

      // 4. savePartialOnce persists initialUrlContext on abort
      const upsertMock = vi.fn().mockResolvedValue({});
      const ac = new AbortController();
      mockCreate.mockImplementationOnce(async () => ({
        [Symbol.asyncIterator]() {
          let i = 0;
          return {
            async next() {
              if (i === 0) {
                i++;
                return { value: { choices: [{ delta: { content: "Half" } }] }, done: false };
              }
              ac.abort();
              return { value: undefined, done: true };
            },
          };
        },
      }));
      const aborted = createOpenAICompatibleStream({
        ...baseParams,
        model: "x-ai/grok-4.7",
        ai: mockAi,
        signal: ac.signal,
        upsertAssistantMessage: upsertMock,
        initialUrlContext,
        contents: [{ role: "user", parts: [{ text: "hi" }] }],
      });
      await consumeStream(aborted);
      expect(upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({ urlContext: initialUrlContext }),
        })
      );
    });
  });
});
