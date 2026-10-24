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
});
