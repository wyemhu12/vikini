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
});
