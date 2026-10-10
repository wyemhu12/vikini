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
