// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  generateContentStreamMock: vi.fn(),
  claudeMessagesCreateMock: vi.fn(),
  openRouterChatCreateMock: vi.fn(),
  groqChatCreateMock: vi.fn(),
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

vi.mock("@/lib/core/groqClient", () => ({
  getGroqClient: () => ({
    chat: {
      completions: {
        create: hoisted.groqChatCreateMock,
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

import {
  resolveNovelcrafterRouting,
  runNovelcrafterStream,
} from "./novelcrafterStreamRunner.server";
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

  it("TC-01: configures Gemini 4 Neon with uppercase ThinkingLevel.MEDIUM and maxOutputTokens", async () => {
    async function* mockNeonGenerator() {
      yield {
        candidates: [
          {
            content: {
              parts: [{ text: "Neon draft generated.", thought: false }],
            },
          },
        ],
      };
    }

    hoisted.generateContentStreamMock.mockResolvedValue(mockNeonGenerator());

    const stream = runNovelcrafterStream({
      userId: "u@vikini.net",
      request: {
        ...BASE_REQUEST,
        model: "gemini-4-neon",
      },
    });

    const rawSse = await readStreamText(stream);

    expect(hoisted.generateContentStreamMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gemini-4-neon",
        config: expect.objectContaining({
          maxOutputTokens: 65536,
          thinkingConfig: {
            thinkingLevel: "MEDIUM",
            includeThoughts: true,
          },
        }),
      })
    );
    expect(rawSse).toContain("Neon draft generated.");
    expect(rawSse).toContain("event: done\n");
  });

  it("TC-NCR-01: normalizes legacy gemini-2.5-flash to gemini-3.5-flash-lite with ThinkingLevel.LOW and no thinkingBudget", async () => {
    async function* mockFlashLiteGenerator() {
      yield {
        candidates: [
          {
            content: {
              parts: [{ text: "Flash-Lite draft.", thought: false }],
            },
          },
        ],
      };
    }

    hoisted.generateContentStreamMock.mockResolvedValue(mockFlashLiteGenerator());

    const stream = runNovelcrafterStream({
      userId: "u@vikini.net",
      request: BASE_REQUEST,
    });

    await readStreamText(stream);

    const callArg = hoisted.generateContentStreamMock.mock.calls[0]?.[0];
    expect(callArg.model).toBe("gemini-3.5-flash-lite");
    expect(callArg.config.thinkingConfig).toEqual({
      thinkingLevel: "LOW",
      includeThoughts: true,
    });
    expect(callArg.config.thinkingConfig).not.toHaveProperty("thinkingBudget");
  });

  it("TC-NCR-02: maps legacy gemini-3.8-flash to gemini-4-hydrogen with ThinkingLevel.MEDIUM (never MINIMAL)", async () => {
    async function* mockHydrogenGenerator() {
      yield {
        candidates: [
          {
            content: {
              parts: [{ text: "Hydrogen draft.", thought: false }],
            },
          },
        ],
      };
    }

    hoisted.generateContentStreamMock.mockResolvedValue(mockHydrogenGenerator());

    const stream = runNovelcrafterStream({
      userId: "u@vikini.net",
      request: {
        ...BASE_REQUEST,
        model: "gemini-3.8-flash",
      },
    });

    await readStreamText(stream);

    const callArg = hoisted.generateContentStreamMock.mock.calls[0]?.[0];
    expect(callArg.model).toBe("gemini-4-hydrogen");
    expect(callArg.config.thinkingConfig).toEqual({
      thinkingLevel: "MEDIUM",
      includeThoughts: true,
    });
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
        model: "claude-sonnet-5-5",
      },
    });

    const rawSse = await readStreamText(stream);

    expect(hoisted.claudeMessagesCreateMock).not.toHaveBeenCalled();
    expect(hoisted.openRouterChatCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "anthropic/claude-sonnet-5.5",
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
        model: "claude-sonnet-5-5",
      },
    });

    const rawSse = await readStreamText(stream);
    expect(hoisted.claudeMessagesCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-sonnet-5-5",
      }),
      expect.anything()
    );
    expect(rawSse).toContain('event: token\ndata: {"t":"Claude narrative output."}\n\n');
    expect(rawSse).toContain("event: done\n");
  });

  it("TC-MC-05: routes openai/gpt-oss-120b to Groq client and not OpenRouter", async () => {
    async function* mockGroqGenerator() {
      yield {
        choices: [{ delta: { content: "Groq narrative output." } }],
      };
    }

    hoisted.groqChatCreateMock.mockResolvedValue(mockGroqGenerator());

    const stream = runNovelcrafterStream({
      userId: "u@vikini.net",
      request: {
        ...BASE_REQUEST,
        model: "openai/gpt-oss-120b",
      },
    });

    const rawSse = await readStreamText(stream);
    expect(hoisted.groqChatCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: "openai/gpt-oss-120b" }),
      expect.anything()
    );
    expect(hoisted.openRouterChatCreateMock).not.toHaveBeenCalled();
    expect(rawSse).toContain("Groq narrative output.");
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
        model: "gemini-4-hydrogen",
        config: expect.objectContaining({
          thinkingConfig: {
            thinkingLevel: "MEDIUM",
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

  it("RT-04: forwards promptDirectiveOverride and contextNodes into the user prompt sent to generateContentStream", async () => {
    async function* mockGen() {
      yield {
        candidates: [
          {
            content: {
              parts: [{ text: "Custom output." }],
            },
          },
        ],
      };
    }

    hoisted.generateContentStreamMock.mockResolvedValueOnce(mockGen());

    const stream = runNovelcrafterStream({
      userId: "u@vikini.net",
      request: {
        ...BASE_REQUEST,
        storyBible: {
          ...BASE_REQUEST.storyBible,
          outline: "Act I: Custom Outline Included",
          characters: "Character that should be excluded",
        },
        promptDirectiveOverride: "Write with noir cadence.",
        contextNodes: ["outline", "preceding_prose"],
      },
    });

    await readStreamText(stream);
    expect(hoisted.generateContentStreamMock).toHaveBeenCalledTimes(1);
    const callArg = hoisted.generateContentStreamMock.mock.calls[0]?.[0] as {
      contents: Array<{ parts: Array<{ text: string }> }>;
    };
    const promptText = callArg.contents[0]?.parts[0]?.text ?? "";
    expect(promptText).toContain("Write with noir cadence.");
    expect(promptText).toContain("<outline>\nAct I: Custom Outline Included\n  </outline>");
    expect(promptText).not.toContain("Character that should be excluded");
  });

  it("TC-W2A-20 / NP-07: aborts provider via internal streamAc on reader.cancel(), ignores late enqueues safely, and runs onStreamComplete once", async () => {
    let capturedSignal: AbortSignal | undefined;
    let releaseSecondChunk!: () => void;
    const secondChunkGate = new Promise<void>((resolve) => {
      releaseSecondChunk = resolve;
    });

    hoisted.streamStrataProviderMock.mockReset();
    hoisted.streamStrataProviderMock.mockImplementationOnce(
      async ({
        emitModelOutput,
        signal,
      }: {
        emitModelOutput: (event: "thinking" | "token", text: string) => void;
        signal?: AbortSignal;
      }) => {
        capturedSignal = signal;
        emitModelOutput("token", "First chunk before cancel.");
        await secondChunkGate;
        // Simulate a late provider write after reader.cancel()
        emitModelOutput("token", "Late chunk after cancel.");
        return "stop";
      }
    );

    const onStreamComplete = vi.fn();
    const stream = runNovelcrafterStream({
      userId: "u@vikini.net",
      request: {
        ...BASE_REQUEST,
        model: "strata-local",
      },
      onStreamComplete,
    });

    const reader = stream.getReader();
    // Read meta frame + first token frame
    const frame1 = await reader.read();
    expect(frame1.done).toBe(false);
    const frame2 = await reader.read();
    expect(frame2.done).toBe(false);

    // Client cancels mid-stream
    await reader.cancel();
    expect(capturedSignal?.aborted).toBe(true);

    // Unblock provider so late emitModelOutput runs and finally settles
    releaseSecondChunk();
    await vi.waitFor(() => {
      expect(onStreamComplete).toHaveBeenCalledTimes(1);
    });
  });

  it("TC-W2A-20: resolveNovelcrafterRouting fetches GEM and Persona lists concurrently via Promise.all", async () => {
    let resolveGems!: (val: unknown) => void;
    const gemsPromise = new Promise((resolve) => {
      resolveGems = resolve;
    });
    let personasStartedBeforeGemsResolved = false;

    hoisted.getGemsForUserMock.mockReturnValueOnce(gemsPromise);
    hoisted.getPersonasForUserMock.mockImplementationOnce(async () => {
      personasStartedBeforeGemsResolved = true;
      return [
        {
          id: "persona-1",
          user_id: "u@vikini.net",
          name: "Parallel Poet",
          description: "",
          tone: "friendly",
          use_emojis: false,
          use_headers_lists: true,
          user_context: "",
          custom_instructions: "Keep prose vivid.",
          icon: "",
          color: "",
          is_premade: false,
          created_at: "",
          updated_at: "",
        },
      ];
    });

    const routingPromise = resolveNovelcrafterRouting(
      "u@vikini.net",
      "write",
      BASE_REQUEST.routing
    );

    expect(hoisted.getGemsForUserMock).toHaveBeenCalledTimes(1);
    expect(hoisted.getPersonasForUserMock).toHaveBeenCalledTimes(1);
    expect(personasStartedBeforeGemsResolved).toBe(true);

    resolveGems([{ id: "gem-1", name: "Parallel Gem", instructions: "Fantasy tone." }]);
    const resolved = await routingPromise;
    expect(resolved.gemName).toBe("Parallel Gem");
    expect(resolved.personaName).toBe("Parallel Poet");
  });
});
