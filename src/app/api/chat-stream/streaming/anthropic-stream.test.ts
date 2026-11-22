import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAnthropicStream } from "./anthropic-stream";
import type { ChatStreamParams } from "./types";
import type Anthropic from "@anthropic-ai/sdk";

vi.mock("./post-processing", () => ({
  processPostStream: vi.fn().mockResolvedValue(undefined),
}));

function createAsyncIterable<T>(items: T[]): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]() {
      let index = 0;
      return {
        async next() {
          if (index < items.length) {
            return { value: items[index++], done: false };
          }
          return { value: undefined as unknown as T, done: true };
        },
      };
    },
  };
}

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

describe("createAnthropicStream (M-1, M-2, m-15)", () => {
  let mockAi: {
    beta: {
      messages: {
        create: ReturnType<typeof vi.fn>;
      };
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAi = {
      beta: {
        messages: {
          create: vi.fn(),
        },
      },
    };
  });

  const baseParams = {
    model: "claude-haiku-45",
    contents: [{ role: "user", parts: [{ text: "Hello Claude" }] }],
    sysPrompt: "System instruction",
    gemMeta: { gemId: null },
    modelMeta: { maxOutputTokens: 8192 },
    createdConversation: null,
    shouldGenerateTitle: false,
    enableWebSearch: false,
    WEB_SEARCH_AVAILABLE: false,
    cookieWeb: "",
    userId: "user-1",
    conversationId: "conv-1",
    content: "Hello Claude",
    contextMessages: [],
    appendToContext: vi.fn().mockResolvedValue(undefined),
    upsertAssistantMessage: vi.fn().mockResolvedValue({}),
    setConversationAutoTitle: vi.fn().mockResolvedValue(undefined),
    generateFinalTitle: vi.fn().mockResolvedValue(null),
    generateOptimisticTitle: vi.fn().mockResolvedValue(null),
  } as unknown as ChatStreamParams;

  it("emits ragSources SSE event on stream start when ragSources are provided (M-2, m-15)", async () => {
    mockAi.beta.messages.create.mockResolvedValue(
      createAsyncIterable([
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Answer with RAG." },
        },
      ])
    );

    const ragSources = [
      {
        filename: "doc1.pdf",
        documentId: "doc-1",
        chunkId: "chunk-1",
        similarity: 0.88,
      },
    ];

    const stream = createAnthropicStream({
      ...baseParams,
      ai: mockAi as unknown as Anthropic,
      ragSources,
    });

    const output = await readStream(stream);

    expect(output).toContain("event: meta");
    expect(output).toContain('"type":"ragSources"');
    expect(output).toContain('"filename":"doc1.pdf"');
    expect(output).toContain("Answer with RAG.");
  });

  it("emits thinking events on thinking_delta without <think> tags (M-1, STR-01)", async () => {
    mockAi.beta.messages.create.mockResolvedValue(
      createAsyncIterable([
        {
          type: "content_block_delta",
          delta: { type: "thinking_delta", thinking: "Analyzing prompt deeply..." },
        },
        {
          type: "content_block_start",
          content_block: { type: "text" },
        },
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Here is the final response." },
        },
      ])
    );

    const stream = createAnthropicStream({
      ...baseParams,
      ai: mockAi as unknown as Anthropic,
      thinkingLevel: "high",
    });

    const output = await readStream(stream);

    expect(output).toContain("event: thinking");
    expect(output).toContain('"thinking":"Analyzing prompt deeply..."');
    expect(output).toContain("event: token");
    expect(output).toContain('"t":"Here is the final response."');
    expect(output).not.toContain("<think>");
    expect(output).not.toContain("</think>");
  });

  it("TC-W1-08: emits standardized initial meta events + optimisticTitle and skips processPostStream on mid-stream failure", async () => {
    const { processPostStream } = await import("./post-processing");
    const upsertMock = vi.fn().mockResolvedValue({});
    const generateOptimisticTitle = vi.fn().mockResolvedValue("Quick Title");

    mockAi.beta.messages.create.mockResolvedValue({
      [Symbol.asyncIterator]() {
        let count = 0;
        return {
          async next() {
            if (count++ === 0) {
              return {
                value: {
                  type: "content_block_delta",
                  delta: { type: "text_delta", text: "Partial Claude text" },
                },
                done: false,
              };
            }
            throw new Error("Anthropic socket reset");
          },
        };
      },
    });

    const stream = createAnthropicStream({
      ...baseParams,
      ai: mockAi as unknown as Anthropic,
      shouldGenerateTitle: true,
      generateOptimisticTitle,
      upsertAssistantMessage: upsertMock,
    });

    const output = await readStream(stream);
    expect(output).toContain('"type":"webSearch"');
    expect(output).toContain('"type":"optimisticTitle"');
    expect(output).toContain('"title":"Quick Title"');
    expect(output).toContain('"ok":false');
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(processPostStream).not.toHaveBeenCalled();
  });

  it("TC-W2A-16: captures message_start input/cache tokens + message_delta output tokens and passes usageMetadata to processPostStream", async () => {
    const { processPostStream } = await import("./post-processing");

    mockAi.beta.messages.create.mockResolvedValue(
      createAsyncIterable([
        {
          type: "message_start",
          message: { usage: { input_tokens: 100, cache_read_input_tokens: 50 } },
        },
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Hello with usage" },
        },
        {
          type: "message_delta",
          usage: { output_tokens: 40 },
        },
      ])
    );

    const stream = createAnthropicStream({
      ...baseParams,
      ai: mockAi as unknown as Anthropic,
    });

    const output = await readStream(stream);
    expect(output).toContain('"promptTokenCount":150');
    expect(output).toContain('"candidatesTokenCount":40');
    expect(output).toContain('"totalTokenCount":190');
    expect(output).toContain('"outputTokens":40');
    expect(processPostStream).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        usageMetadata: {
          promptTokenCount: 150,
          candidatesTokenCount: 40,
          totalTokenCount: 190,
        },
      })
    );
  });

  it("TC-SU-01: emits codeExecutionStatus writing -> running -> done and streams code_execution_tool_result stdout without leaking input into subsequent tool_use", async () => {
    const chunks: Array<Record<string, unknown>> = [
      {
        type: "content_block_start",
        content_block: { type: "server_tool_use", id: "srv-1", name: "code_execution" },
      },
      ...Array.from({ length: 10 }, () => ({
        type: "content_block_delta",
        delta: { type: "input_json_delta", partial_json: "x".repeat(40) },
      })),
      { type: "content_block_stop" },
      {
        type: "content_block_start",
        content_block: {
          type: "code_execution_tool_result",
          tool_use_id: "srv-1",
          content: {
            type: "code_execution_result",
            stdout: "OK\n",
            stderr: "",
            return_code: 0,
            content: [],
          },
        },
      },
      {
        type: "content_block_start",
        content_block: { type: "tool_use", id: "tool-1", name: "get_current_time" },
      },
      {
        type: "content_block_delta",
        delta: { type: "input_json_delta", partial_json: '{"timezone":"UTC"}' },
      },
      { type: "content_block_stop" },
    ];

    mockAi.beta.messages.create
      .mockResolvedValueOnce(createAsyncIterable(chunks))
      .mockResolvedValueOnce(
        createAsyncIterable([
          { type: "content_block_delta", delta: { type: "text_delta", text: "Done!" } },
        ])
      );

    const stream = createAnthropicStream({
      ...baseParams,
      ai: mockAi as unknown as Anthropic,
    });

    const output = await readStream(stream);
    expect(output).toContain('"type":"codeExecutionStatus","status":"writing","chars":0');
    expect(output).toContain('"type":"codeExecutionStatus","status":"writing","chars":280');
    expect(output).toContain('"type":"codeExecutionStatus","status":"running","chars":400');
    expect(output).toContain('"type":"codeExecutionStatus","status":"done"');
    expect(output).toContain("OK\\n");
    expect(output).toContain(
      '"type":"functionCall","name":"get_current_time","args":{"timezone":"UTC"}'
    );
    expect(output).toContain('"t":"Done!"');
  });

  it.each(["claude-sonnet-5-5", "claude-haiku-5-5"])(
    "TC-MC-04: sends Adaptive Thinking (no budget_tokens) and temperature=1 for %s when thinkingLevel is high",
    async (claudeModel) => {
      mockAi.beta.messages.create.mockResolvedValue(
        createAsyncIterable([
          { type: "content_block_delta", delta: { type: "text_delta", text: "Adaptive ok" } },
        ])
      );

      const stream = createAnthropicStream({
        ...baseParams,
        model: claudeModel,
        ai: mockAi as unknown as Anthropic,
        thinkingLevel: "high",
      });

      await readStream(stream);
      const callArg = mockAi.beta.messages.create.mock.calls[0][0] as {
        thinking?: Record<string, unknown>;
        temperature?: number;
      };
      expect(callArg.thinking).toEqual({ type: "adaptive" });
      expect(callArg.thinking).not.toHaveProperty("budget_tokens");
      expect(callArg.temperature).toBe(1);
    }
  );

  it("TC-MC-04: omits thinking and uses temperature=0.7 for Claude 5.5 when thinkingLevel is off", async () => {
    mockAi.beta.messages.create.mockResolvedValue(
      createAsyncIterable([
        { type: "content_block_delta", delta: { type: "text_delta", text: "No thinking" } },
      ])
    );

    const stream = createAnthropicStream({
      ...baseParams,
      model: "claude-sonnet-5-5",
      ai: mockAi as unknown as Anthropic,
      thinkingLevel: "off",
    });

    await readStream(stream);
    const callArg = mockAi.beta.messages.create.mock.calls[0][0] as {
      thinking?: Record<string, unknown>;
      temperature?: number;
    };
    expect(callArg.thinking).toBeUndefined();
    expect(callArg.temperature).toBe(0.7);
  });

  it("TC-CL-01: sends native PDF document block, emits & persists initialUrlContext, and saves urlContext in savePartialOnce on abort", async () => {
    const { processPostStream } = await import("./post-processing");
    const initialUrlContext = [
      {
        retrievedUrl: "https://docs.google.com/document/d/1ClaudeDoc1234567890/edit",
        status: "GOOGLE_DOC_PDF",
      },
    ];

    mockAi.beta.messages.create.mockResolvedValueOnce(
      createAsyncIterable([
        { type: "content_block_delta", delta: { type: "text_delta", text: "Reviewed PDF" } },
      ])
    );

    const stream = createAnthropicStream({
      ...baseParams,
      ai: mockAi as unknown as Anthropic,
      contents: [
        {
          role: "user",
          parts: [
            { text: "Review proposal" },
            {
              inlineData: { mimeType: "application/pdf", data: "JVBERi0xLjQ=" },
              filename: "Proposal.pdf",
            },
          ],
        },
      ],
      initialUrlContext,
    });

    const output = await readStream(stream);
    expect(output).toContain('"type":"urlContext"');
    expect(output).toContain("GOOGLE_DOC_PDF");

    const callArg = mockAi.beta.messages.create.mock.calls[0][0] as {
      messages: Array<{ role: string; content: unknown }>;
    };
    expect(callArg.messages[0]).toEqual({
      role: "user",
      content: [
        { type: "text", text: "Review proposal" },
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: "JVBERi0xLjQ=" },
          title: "Proposal.pdf",
        },
      ],
    });
    expect(processPostStream).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ urlContext: initialUrlContext })
    );

    // Abort mid-stream -> savePartialOnce persists initialUrlContext
    const upsertMock = vi.fn().mockResolvedValue({});
    const ac = new AbortController();
    mockAi.beta.messages.create.mockResolvedValueOnce({
      [Symbol.asyncIterator]() {
        let step = 0;
        return {
          async next() {
            if (step === 0) {
              step++;
              return {
                value: {
                  type: "content_block_delta",
                  delta: { type: "text_delta", text: "Partial" },
                },
                done: false,
              };
            }
            ac.abort();
            return { value: undefined, done: true };
          },
        };
      },
    });

    const abortedStream = createAnthropicStream({
      ...baseParams,
      ai: mockAi as unknown as Anthropic,
      signal: ac.signal,
      upsertAssistantMessage: upsertMock,
      initialUrlContext,
    });
    await readStream(abortedStream);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({ urlContext: initialUrlContext }),
      })
    );
  });
});
