// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  generateContentStreamMock: vi.fn(),
  claudeMessagesCreateMock: vi.fn(),
  openRouterChatCreateMock: vi.fn(),
  streamStrataProviderMock: vi.fn(),
  getGemsForUserMock: vi.fn(),
  getPersonasForUserMock: vi.fn(),
}));

vi.mock("./novelcrafterStrataProvider.server", () => ({
  streamStrataProvider: hoisted.streamStrataProviderMock,
}));

vi.mock("@/lib/core/genaiClient", () => ({
  getGenAIClient: () => ({
    models: {
      generateContentStream: hoisted.generateContentStreamMock,
    },
  }),
}));

vi.mock("@/lib/core/claudeClient", () => ({
  getClaudeClient: () => ({
    messages: {
      create: hoisted.claudeMessagesCreateMock,
    },
  }),
}));

vi.mock("@/lib/core/openRouterClient", () => ({
  getOpenRouterClient: () => ({
    chat: {
      completions: {
        create: hoisted.openRouterChatCreateMock,
      },
    },
  }),
}));

vi.mock("@/lib/features/gems/gems", () => ({
  getGemsForUser: hoisted.getGemsForUserMock,
}));

vi.mock("@/lib/features/personas/personas", () => ({
  getPersonasForUser: hoisted.getPersonasForUserMock,
}));

import { runNovelcrafterStream } from "./novelcrafterStreamRunner.server";
import { createDefaultStoryState, type NovelcrafterStreamRequest } from "./types";

async function readStreamText(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let output = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    output += decoder.decode(value, { stream: true });
  }
  return output;
}

const BASE_REQUEST: NovelcrafterStreamRequest = {
  conversationId: "123e4567-e89b-12d3-a456-426614174000",
  model: "gemini-2.5-flash",
  feature: "write",
  routing: {
    masterGemId: "gem-1",
    masterPersonaId: "persona-1",
    featurePersonas: {
      bible: "inherit",
      write: "inherit",
      rewrite: "inherit",
      feedback: "inherit",
      expand: "inherit",
      brainstorm: "inherit",
    },
  },
  storyBible: createDefaultStoryState().storyBible,
  chapterTitle: "Chapter 1",
  chapterScenes: "Beat 1: The arrival.",
  chapterExtraInstructions: "",
  chapterProse: "The ship landed in the mist.",
  previousChapterProseTail: "",
  selectedText: "",
  actionMode: "generate",
  writeMode: "auto",
  keyDetails: "",
  rewriteMode: "rephrase",
  feedbackMode: "developmental",
  expandMode: "expand",
  brainstormCategory: "plot_twists",
  customInstruction: "",
};

describe("novelcrafterStreamRunner.server (TC-06)", () => {
  beforeEach(() => {
    hoisted.generateContentStreamMock.mockReset();
    hoisted.claudeMessagesCreateMock.mockReset();
    hoisted.openRouterChatCreateMock.mockReset();
    hoisted.getGemsForUserMock.mockReset();
    hoisted.getPersonasForUserMock.mockReset();

    hoisted.getGemsForUserMock.mockResolvedValue([
      {
        id: "gem-1",
        name: "Epic Fantasy Architect",
        instructions: "Always maintain high-fantasy archaic diction.",
      },
    ]);

    hoisted.getPersonasForUserMock.mockResolvedValue([
      {
        id: "persona-1",
        user_id: "u@vikini.net",
        name: "Dark Poet",
        description: "",
        tone: "candid",
        use_emojis: false,
        use_headers_lists: false,
        user_context: "Fantasy author",
        custom_instructions: "Focus on atmospheric dread.",
        icon: "",
        color: "",
        is_premade: false,
        created_at: "",
        updated_at: "",
      },
    ]);
  });

  it("emits meta, thinking, token, and done SSE frames in exact wire format for Gemini models", async () => {
    async function* mockGeminiGenerator() {
      yield {
        candidates: [
          {
            content: {
              parts: [{ text: "Planning the scene transition...", thought: true }],
            },
          },
        ],
      };
      yield {
        candidates: [
          {
            content: {
              parts: [{ text: "A cold wind swept across the landing pad." }],
            },
          },
        ],
      };
    }

    hoisted.generateContentStreamMock.mockResolvedValue(mockGeminiGenerator());

    const stream = runNovelcrafterStream({
      userId: "u@vikini.net",
      request: BASE_REQUEST,
    });

    const rawSse = await readStreamText(stream);

    expect(rawSse).toContain("event: meta\n");
    expect(rawSse).toContain('"gemName":"Epic Fantasy Architect"');
    expect(rawSse).toContain('"personaName":"Dark Poet"');
    expect(rawSse).toContain('event: thinking\ndata: {"t":"Planning the scene transition..."}\n\n');
    expect(rawSse).toContain(
      'event: token\ndata: {"t":"A cold wind swept across the landing pad."}\n\n'
    );
    expect(rawSse).toContain("event: done\n");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("TC-01: configures Gemini 4 Argon with uppercase ThinkingLevel.MEDIUM and maxOutputTokens", async () => {
    async function* mockArgonGenerator() {
      yield {
        candidates: [
          {
            content: {
              parts: [{ text: "Argon draft generated.", thought: false }],
            },
          },
        ],
      };
    }

    hoisted.generateContentStreamMock.mockResolvedValue(mockArgonGenerator());

    const stream = runNovelcrafterStream({
      userId: "u@vikini.net",
      request: {
        ...BASE_REQUEST,
        model: "gemini-4-argon",
      },
    });

    const rawSse = await readStreamText(stream);

    expect(hoisted.generateContentStreamMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gemini-4-argon",
        config: expect.objectContaining({
          maxOutputTokens: 65536,
          thinkingConfig: {
            thinkingLevel: "MEDIUM",
            includeThoughts: true,
          },
        }),
      })
    );
    expect(rawSse).toContain("Argon draft generated.");
    expect(rawSse).toContain("event: done\n");
  });

  it("TC-02: falls back to OpenRouter for Claude models when ANTHROPIC_API_KEY is unset", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");

    async function* mockOpenRouterGenerator() {
      yield {
        choices: [
          {
            delta: {
              content: "Claude output via OpenRouter fallback.",
            },
          },
        ],
      };
    }

    hoisted.openRouterChatCreateMock.mockResolvedValue(mockOpenRouterGenerator());

    const stream = runNovelcrafterStream({
      userId: "u@vikini.net",
      request: {
        ...BASE_REQUEST,
        model: "claude-sonnet-4.5",
      },
    });

    const rawSse = await readStreamText(stream);

    expect(hoisted.claudeMessagesCreateMock).not.toHaveBeenCalled();
    expect(hoisted.openRouterChatCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "anthropic/claude-sonnet-4-6",
      }),
      expect.anything()
    );
    expect(rawSse).toContain("Claude output via OpenRouter fallback.");
    expect(rawSse).toContain("event: done\n");
  });

  it("TC-03: maps Claude model IDs via CLAUDE_API_MODELS.ANTHROPIC when ANTHROPIC_API_KEY is present", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-anthropic-key");

    async function* mockClaudeGenerator() {
      yield {
        type: "content_block_delta",
        delta: { type: "text_delta", text: "Claude narrative output." },
      };
    }

    hoisted.claudeMessagesCreateMock.mockResolvedValue(mockClaudeGenerator());

    const stream = runNovelcrafterStream({
      userId: "u@vikini.net",
      request: {
        ...BASE_REQUEST,
        model: "claude-sonnet-4.5",
      },
    });

    const rawSse = await readStreamText(stream);
    expect(hoisted.claudeMessagesCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-sonnet-4-6",
      }),
      expect.anything()
    );
    expect(rawSse).toContain('event: token\ndata: {"t":"Claude narrative output."}\n\n');
    expect(rawSse).toContain("event: done\n");
  });

  it("stops streaming immediately when AbortSignal is triggered and emits error frame on provider failure", async () => {
    const abortController = new AbortController();

    async function* mockAbortingGenerator() {
      yield { text: "First chunk" };
      abortController.abort();
      yield { text: "Second chunk after abort" };
    }

    hoisted.generateContentStreamMock.mockResolvedValueOnce(mockAbortingGenerator());

    const abortedStream = runNovelcrafterStream({
      userId: "u@vikini.net",
      request: BASE_REQUEST,
      signal: abortController.signal,
    });

    const abortedOutput = await readStreamText(abortedStream);
    expect(abortedOutput).toContain("First chunk");
    expect(abortedOutput).not.toContain("Second chunk after abort");
    expect(abortedOutput).not.toContain("event: done\n");

    // Provider error case
    hoisted.generateContentStreamMock.mockRejectedValueOnce(new Error("Upstream quota error"));
    const errorStream = runNovelcrafterStream({
      userId: "u@vikini.net",
      request: BASE_REQUEST,
    });
    const errorOutput = await readStreamText(errorStream);
    expect(errorOutput).toContain("event: error\n");
    expect(errorOutput).toContain('"code":"STREAM_ERROR"');
  });

  it("TC-02 & TC-09: configures Gemini 3 with ThinkingLevel.LOW + 4 BLOCK_NONE safetySettings and emits SSE error on empty/blocked stream", async () => {
    async function* mockGemini3Generator() {
      yield {
        candidates: [
          {
            content: {
              parts: [
                { text: "Brief reasoning.", thought: true },
                { text: "Gemini 3 prose output.", thought: false },
              ],
            },
          },
        ],
      };
    }

    hoisted.generateContentStreamMock.mockResolvedValueOnce(mockGemini3Generator());

    const gemini3Stream = runNovelcrafterStream({
      userId: "u@vikini.net",
      request: {
        ...BASE_REQUEST,
        model: "gemini-3.1-pro-preview",
      },
    });

    const gemini3Sse = await readStreamText(gemini3Stream);
    expect(hoisted.generateContentStreamMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gemini-3.1-pro-preview",
        config: expect.objectContaining({
          thinkingConfig: {
            thinkingLevel: "LOW",
            includeThoughts: true,
          },
          safetySettings: expect.arrayContaining([
            expect.objectContaining({ threshold: "BLOCK_NONE" }),
          ]),
        }),
      })
    );
    expect(gemini3Sse).toContain('event: thinking\ndata: {"t":"Brief reasoning."}\n\n');
    expect(gemini3Sse).toContain('event: token\ndata: {"t":"Gemini 3 prose output."}\n\n');
    expect(gemini3Sse).toContain("event: done\n");

    // Empty / blocked stream detection (TC-09)
    async function* mockBlockedGenerator() {
      yield {
        promptFeedback: { blockReason: "SAFETY" },
        candidates: [{ finishReason: "SAFETY", content: { parts: [] } }],
      };
    }

    hoisted.generateContentStreamMock.mockResolvedValueOnce(mockBlockedGenerator());

    const blockedStream = runNovelcrafterStream({
      userId: "u@vikini.net",
      request: {
        ...BASE_REQUEST,
        model: "gemini-3.1-pro-preview",
      },
    });

    const blockedSse = await readStreamText(blockedStream);
    expect(blockedSse).toContain("event: error\n");
    expect(blockedSse).toContain("SAFETY");
    expect(blockedSse).not.toContain("event: done\n");
  });

  it("TC-01 Case 1A & 1B: only triggers onFirstModelOutput on token chunks (not thinking-only) and sanitizes upstream error messages", async () => {
    const onFirstModelOutput = vi.fn();

    async function* thinkingOnlyGenerator() {
      yield {
        candidates: [
          {
            content: {
              parts: [{ text: "Planning only without prose...", thought: true }],
            },
          },
        ],
      };
    }

    hoisted.generateContentStreamMock.mockResolvedValueOnce(thinkingOnlyGenerator());

    const thinkingOnlyStream = runNovelcrafterStream({
      userId: "u@vikini.net",
      request: BASE_REQUEST,
      onFirstModelOutput,
    });

    const thinkingOnlySse = await readStreamText(thinkingOnlyStream);
    expect(onFirstModelOutput).toHaveBeenCalledTimes(0);
    expect(thinkingOnlySse).toContain("event: error\n");
    expect(thinkingOnlySse).toContain('"code":"STREAM_ERROR"');

    // Valid token chunk triggers onFirstModelOutput once
    async function* validTokenGenerator() {
      yield {
        candidates: [
          {
            content: {
              parts: [
                { text: "Reasoning...", thought: true },
                { text: "First prose token.", thought: false },
                { text: "Second prose token.", thought: false },
              ],
            },
          },
        ],
      };
    }

    hoisted.generateContentStreamMock.mockResolvedValueOnce(validTokenGenerator());
    const validStream = runNovelcrafterStream({
      userId: "u@vikini.net",
      request: BASE_REQUEST,
      onFirstModelOutput,
    });
    await readStreamText(validStream);
    expect(onFirstModelOutput).toHaveBeenCalledTimes(1);

    // Case 1B: Sensitive upstream error is sanitized via sanitizeError(err, true)
    hoisted.generateContentStreamMock.mockRejectedValueOnce(
      new Error("Fatal at 10.0.0.1 with GEMINI_API_KEY=secret123")
    );
    const sensitiveErrStream = runNovelcrafterStream({
      userId: "u@vikini.net",
      request: BASE_REQUEST,
    });
    const sensitiveErrSse = await readStreamText(sensitiveErrStream);
    expect(sensitiveErrSse).toContain("event: error\n");
    expect(sensitiveErrSse).toContain("An error occurred. Please try again later.");
    expect(sensitiveErrSse).not.toContain("10.0.0.1");
    expect(sensitiveErrSse).not.toContain("secret123");
  });

  it("TC-B5-08 & TC-B5-09: routes strata-local to streamStrataProvider (never OpenRouter/GenAI/Claude) and emits LOCAL_LLM_BUSY error on StrataQueueFullError", async () => {
    const { isStrataLocalModel } = await import("@/lib/core/modelRegistry");
    const { StrataQueueFullError } = await import("@/lib/features/local-llm/errors");

    expect(isStrataLocalModel("strata-local")).toBe(true);

    hoisted.streamStrataProviderMock.mockReset();
    hoisted.streamStrataProviderMock.mockImplementationOnce(
      async ({
        emitModelOutput,
      }: {
        emitModelOutput: (event: "thinking" | "token", text: string) => void;
      }) => {
        emitModelOutput("token", "Local Strata chapter prose.");
        return "stop";
      }
    );

    const onFirstModelOutput = vi.fn();
    const localStream = runNovelcrafterStream({
      userId: "u@vikini.net",
      request: {
        ...BASE_REQUEST,
        model: "strata-local",
      },
      onFirstModelOutput,
    });

    const localSse = await readStreamText(localStream);
    expect(hoisted.streamStrataProviderMock).toHaveBeenCalledTimes(1);
    expect(hoisted.openRouterChatCreateMock).toHaveBeenCalledTimes(0);
    expect(hoisted.generateContentStreamMock).toHaveBeenCalledTimes(0);
    expect(hoisted.claudeMessagesCreateMock).toHaveBeenCalledTimes(0);
    expect(onFirstModelOutput).toHaveBeenCalledTimes(1);
    expect(localSse).toContain('event: token\ndata: {"t":"Local Strata chapter prose."}\n\n');
    expect(localSse).toContain("event: done\n");

    // Queue full error case
    const onQueueFullFirstOutput = vi.fn();
    hoisted.streamStrataProviderMock.mockRejectedValueOnce(new StrataQueueFullError());
    const busyStream = runNovelcrafterStream({
      userId: "u@vikini.net",
      request: {
        ...BASE_REQUEST,
        model: "strata-local",
      },
      onFirstModelOutput: onQueueFullFirstOutput,
    });
    const busySse = await readStreamText(busyStream);
    expect(onQueueFullFirstOutput).toHaveBeenCalledTimes(0);
    expect(busySse).toContain("event: error\n");
    expect(busySse).toContain('"code":"STREAM_ERROR"');
    expect(busySse).toContain('"message":"Local model queue is full"');
  });
});
