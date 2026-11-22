import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type OpenAI from "openai";
import { createStrataStream, type CreateStrataStreamParams } from "./strata-stream";
import { getStreamTimeout } from "./utils";
import { resetStrataClientCacheForTests } from "@/lib/core/strataClient";
import { createStrataQueue } from "@/lib/core/strataQueue";
import * as strataThinking from "@/lib/features/local-llm/strataThinking";
import { StrataOfflineError, StrataQueueFullError } from "@/lib/features/local-llm/errors";

interface ParsedSseEvent {
  event: string;
  data: Record<string, unknown>;
}

async function readAllSseEvents(stream: ReadableStream<Uint8Array>): Promise<ParsedSseEvent[]> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let raw = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    raw += decoder.decode(value, { stream: true });
  }
  return raw
    .split("\n\n")
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n");
      const eventLine = lines.find((l) => l.startsWith("event:"));
      const dataLine = lines.find((l) => l.startsWith("data:"));
      return {
        event: eventLine ? eventLine.replace(/^event:\s*/, "").trim() : "message",
        data: dataLine
          ? (JSON.parse(dataLine.replace(/^data:\s*/, "")) as Record<string, unknown>)
          : {},
      };
    });
}

function makeBaseParams(
  overrides: Partial<CreateStrataStreamParams> = {}
): CreateStrataStreamParams {
  return {
    model: "strata-local",
    contents: [{ role: "user", parts: [{ text: "Hello local model" }] }],
    sysPrompt: "Be concise",
    gemMeta: { gemId: null, hasSystemInstruction: false },
    modelMeta: { model: "strata-local", requestedModel: "strata-local", apiModel: "strata-local" },
    createdConversation: null,
    shouldGenerateTitle: false,
    enableWebSearch: false,
    WEB_SEARCH_AVAILABLE: false,
    cookieWeb: "0",
    userId: "user-1",
    conversationId: "conv-1",
    content: "Hello local model",
    contextMessages: [],
    appendToContext: vi.fn().mockResolvedValue(undefined),
    upsertAssistantMessage: vi.fn().mockResolvedValue({}),
    setConversationAutoTitle: vi.fn().mockResolvedValue(undefined),
    generateOptimisticTitle: vi.fn().mockReturnValue(""),
    generateFinalTitle: vi.fn().mockResolvedValue(""),
    countTokensFn: vi.fn().mockResolvedValue(120),
    ...overrides,
  };
}

describe("createStrataStream & getStreamTimeout", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      STRATA_ENABLED: "true",
      STRATA_BASE_URL: "http://127.0.0.1:8080/v1",
      STRATA_MODEL_ID: "orcarouter-qwen3.8-flash-next-uncensored-iq3_xxs",
    };
    resetStrataClientCacheForTests();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("getStreamTimeout returns 300_000 for strata-local even when STREAM_TIMEOUT_MS=120000 (TC-29, TC-38)", () => {
    process.env.STREAM_TIMEOUT_MS = "120000";
    expect(getStreamTimeout("strata-local")).toBe(300_000);
    expect(getStreamTimeout("gemini-3-flash-preview")).toBe(120_000);
  });

  it("emits LOCAL_LLM_OFFLINE error event when upstream connection fails (TC-27)", async () => {
    const mockAi = {
      chat: {
        completions: {
          create: vi.fn().mockRejectedValue(new StrataOfflineError()),
        },
      },
    } as unknown as OpenAI;

    const stream = createStrataStream(
      makeBaseParams({
        ai: mockAi,
        queue: createStrataQueue({ maxPending: 2 }),
      })
    );
    const events = await readAllSseEvents(stream);
    const errEvent = events.find((e) => e.event === "error");
    expect(errEvent).toBeDefined();
    expect(errEvent?.data.code).toBe("LOCAL_LLM_OFFLINE");
  });

  it("emits LOCAL_LLM_BUSY error event when queue throws StrataQueueFullError (TC-28)", async () => {
    const fullQueue = {
      canAdmit: () => false,
      acquire: vi.fn().mockRejectedValue(new StrataQueueFullError()),
      snapshot: () => ({ active: 1 as const, pending: 2 }),
      resetForTests: () => undefined,
    };

    const stream = createStrataStream(makeBaseParams({ queue: fullQueue }));
    const events = await readAllSseEvents(stream);
    const errEvent = events.find((e) => e.event === "error");
    expect(errEvent?.data.code).toBe("LOCAL_LLM_BUSY");
  });

  it("defaults thinkingLevel: undefined to 'off' (reasoning_effort: 'none') and forwards strataSampling (TC-26, TC-44, TC-49)", async () => {
    const buildBodySpy = vi.spyOn(strataThinking, "buildStrataRequestBody");
    const mockCreate = vi.fn().mockResolvedValue(
      (async function* () {
        yield { choices: [{ delta: { content: "Story output" }, finish_reason: "stop" }] };
      })()
    );

    const mockAi = {
      chat: { completions: { create: mockCreate } },
    } as unknown as OpenAI;

    const stream = createStrataStream(
      makeBaseParams({
        ai: mockAi,
        queue: createStrataQueue({ maxPending: 2 }),
        thinkingLevel: undefined,
        strataSampling: { mode: "creative" },
      })
    );
    const events = await readAllSseEvents(stream);

    expect(buildBodySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: expect.objectContaining({ level: "off", reasoningEffort: "none" }),
        samplingConfig: { mode: "creative" },
      })
    );
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        reasoning_effort: "none",
        temperature: 0.85,
        top_p: 0.92,
        top_k: 30,
        min_p: 0.05,
        presence_penalty: 0.6,
      }),
      expect.any(Object)
    );
    expect(events.some((e) => e.event === "done" && e.data.ok === true)).toBe(true);
  });

  it("propagates signal abort to upstream OpenAI request without error frame (TC-30)", async () => {
    const abortController = new AbortController();
    let capturedSignal: AbortSignal | undefined;

    const mockCreate = vi
      .fn()
      .mockImplementation((_body: unknown, opts?: { signal?: AbortSignal }) => {
        capturedSignal = opts?.signal;
        return (async function* () {
          yield { choices: [{ delta: { content: "Partial" }, finish_reason: null }] };
          abortController.abort();
          throw new DOMException("Aborted", "AbortError");
        })();
      });

    const mockAi = {
      chat: { completions: { create: mockCreate } },
    } as unknown as OpenAI;

    const stream = createStrataStream(
      makeBaseParams({
        ai: mockAi,
        queue: createStrataQueue({ maxPending: 2 }),
        signal: abortController.signal,
      })
    );
    const events = await readAllSseEvents(stream);

    expect(capturedSignal?.aborted).toBe(true);
    expect(events.some((e) => e.event === "error")).toBe(false);
    expect(events.some((e) => e.event === "done" && e.data.ok === false)).toBe(true);
  });

  it("TC-W1-08: saves partial once and does NOT duplicate write via processPostStream on mid-stream failure", async () => {
    const upsertMock = vi.fn().mockResolvedValue({});
    const mockCreate = vi.fn().mockResolvedValue({
      [Symbol.asyncIterator]() {
        let count = 0;
        return {
          async next() {
            if (count++ === 0) {
              return {
                value: { choices: [{ delta: { content: "Partial local text" } }] },
                done: false,
              };
            }
            throw new StrataOfflineError();
          },
        };
      },
    });

    const mockAi = {
      chat: { completions: { create: mockCreate } },
    } as unknown as OpenAI;

    const stream = createStrataStream(
      makeBaseParams({
        ai: mockAi,
        queue: createStrataQueue({ maxPending: 2 }),
        upsertAssistantMessage: upsertMock,
      })
    );
    const events = await readAllSseEvents(stream);

    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(events.some((e) => e.event === "error" && e.data.code === "LOCAL_LLM_OFFLINE")).toBe(
      true
    );
    expect(events.some((e) => e.event === "done" && e.data.ok === false)).toBe(true);
  });

  it("TC-CL-04: emits and persists initialUrlContext on completion & savePartialOnce while handling Google Docs text cleanly", async () => {
    const initialUrlContext = [
      {
        retrievedUrl: "https://docs.google.com/document/d/1StrataDoc123456789/edit",
        status: "GOOGLE_DOC_TEXT",
      },
    ];
    const upsertMock = vi.fn().mockResolvedValue({});
    const mockCreate = vi.fn().mockResolvedValue({
      [Symbol.asyncIterator]() {
        let done = false;
        return {
          async next() {
            if (!done) {
              done = true;
              return {
                value: {
                  choices: [{ delta: { content: "Summary from Strata" }, finish_reason: "stop" }],
                },
                done: false,
              };
            }
            return { value: undefined, done: true };
          },
        };
      },
    });
    const mockAi = { chat: { completions: { create: mockCreate } } } as unknown as OpenAI;

    const stream = createStrataStream(
      makeBaseParams({
        ai: mockAi,
        queue: createStrataQueue({ maxPending: 2 }),
        contents: [
          {
            role: "user",
            parts: [
              {
                text: "\n[GOOGLE DOC: Proposal.txt]\n<<<GOOGLE_DOC_DATA_START>>>\nBody\n<<<GOOGLE_DOC_DATA_END>>>\n",
              },
              { text: "Summarize this doc" },
            ],
          },
        ],
        upsertAssistantMessage: upsertMock,
        initialUrlContext,
      })
    );
    const events = await readAllSseEvents(stream);
    expect(events.some((e) => e.event === "meta" && e.data.type === "urlContext")).toBe(true);
    expect(events.some((e) => e.event === "error")).toBe(false);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({ urlContext: initialUrlContext }),
      })
    );

    // Partial save on abort preserves initialUrlContext
    const upsertAbort = vi.fn().mockResolvedValue({});
    const ac = new AbortController();
    const abortCreate = vi.fn().mockResolvedValue({
      [Symbol.asyncIterator]() {
        let i = 0;
        return {
          async next() {
            if (i === 0) {
              i++;
              return { value: { choices: [{ delta: { content: "Half Strata" } }] }, done: false };
            }
            ac.abort();
            return { value: undefined, done: true };
          },
        };
      },
    });
    const abortedStream = createStrataStream(
      makeBaseParams({
        ai: { chat: { completions: { create: abortCreate } } } as unknown as OpenAI,
        queue: createStrataQueue({ maxPending: 2 }),
        signal: ac.signal,
        upsertAssistantMessage: upsertAbort,
        initialUrlContext,
      })
    );
    await readAllSseEvents(abortedStream);
    expect(upsertAbort).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({ urlContext: initialUrlContext }),
      })
    );
  });
});
