// @vitest-environment node
import type OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";
import type { StrataConfig } from "@/lib/core/strataConfig";
import type { StrataQueue } from "@/lib/core/strataQueue";
import {
  StrataContextOverflowError,
  StrataDisabledError,
  StrataOfflineError,
} from "@/lib/features/local-llm/errors";
import { streamStrataProvider, type StrataProviderDeps } from "./novelcrafterStrataProvider.server";

const ENABLED_CONFIG: StrataConfig = {
  enabled: true,
  baseUrl: "http://127.0.0.1:8080/v1",
  origin: "http://127.0.0.1:8080",
  healthUrl: "http://127.0.0.1:8080/health",
  countTokensUrl: "http://127.0.0.1:8080/tokenize",
  apiKey: "local-key",
  modelId: "strata-qwen",
  contextWindow: 32_768,
  requestTimeoutMs: 120_000,
  idleTimeoutMs: 45_000,
  queueMaxPending: 2,
  queueMaxWaitMs: 30_000,
  allowRemote: false,
};

function createMockDeps(overrides: Partial<StrataProviderDeps> = {}) {
  const releaseMock = vi.fn();
  const acquireMock = vi.fn().mockResolvedValue(releaseMock);
  const createStreamMock = vi.fn();
  const countTokensMock = vi.fn().mockResolvedValue(120);

  const deps: StrataProviderDeps = {
    getConfig: vi.fn().mockReturnValue(ENABLED_CONFIG),
    getQueue: vi.fn().mockReturnValue({
      acquire: acquireMock,
    } as unknown as StrataQueue),
    getClient: vi.fn().mockReturnValue({
      chat: {
        completions: {
          create: createStreamMock,
        },
      },
    } as unknown as OpenAI),
    countTokens: countTokensMock,
    ...overrides,
  };

  return { deps, releaseMock, acquireMock, createStreamMock, countTokensMock };
}

describe("novelcrafterStrataProvider.server (TC-B5-01..07)", () => {
  it("TC-B5-01: acquires slot, fits prompt, builds body with creative sampling and low thinking, streams reasoning + token chunks, and releases slot once", async () => {
    async function* mockStrataChunks() {
      yield {
        choices: [{ delta: { reasoning_content: "plan" } }],
      };
      yield {
        choices: [{ delta: { content: "Hello" } }],
      };
      yield {
        choices: [{ finish_reason: "length", delta: {} }],
      };
    }

    const { deps, releaseMock, acquireMock, createStreamMock } = createMockDeps();
    createStreamMock.mockResolvedValue(mockStrataChunks());
    const emitted: Array<[string, string]> = [];

    const finishReason = await streamStrataProvider({
      systemInstruction: "System prompt",
      userPrompt: "User prompt",
      emitModelOutput: (type, content) => emitted.push([type, content]),
      deps,
    });

    expect(finishReason).toBe("length");
    expect(emitted).toEqual([
      ["thinking", "plan"],
      ["token", "Hello"],
    ]);
    expect(acquireMock).toHaveBeenCalledTimes(1);
    expect(createStreamMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: ENABLED_CONFIG.modelId,
        stream: true,
        max_tokens: 6144,
        reasoning_effort: "low",
        messages: [
          { role: "system", content: "System prompt" },
          { role: "user", content: "User prompt" },
        ],
      }),
      expect.anything()
    );
    expect(releaseMock).toHaveBeenCalledTimes(1);
  });

  it("TC-B5-02: rejects StrataDisabledError (code LOCAL_LLM_DISABLED) without calling queue.acquire or create when disabled", async () => {
    const { deps, acquireMock, createStreamMock } = createMockDeps({
      getConfig: vi.fn().mockReturnValue({ ...ENABLED_CONFIG, enabled: false }),
    });

    await expect(
      streamStrataProvider({
        systemInstruction: "Sys",
        userPrompt: "Usr",
        emitModelOutput: vi.fn(),
        deps,
      })
    ).rejects.toEqual(new StrataDisabledError());

    expect(acquireMock).not.toHaveBeenCalled();
    expect(createStreamMock).not.toHaveBeenCalled();
  });

  it("TC-B5-03 & TC-B5-04: calls release() once on error and maps ECONNREFUSED/fetch failed to StrataOfflineError", async () => {
    const { deps, releaseMock, createStreamMock } = createMockDeps();
    createStreamMock.mockRejectedValueOnce(new Error("boom"));

    await expect(
      streamStrataProvider({
        systemInstruction: "Sys",
        userPrompt: "Usr",
        emitModelOutput: vi.fn(),
        deps,
      })
    ).rejects.toThrow("boom");
    expect(releaseMock).toHaveBeenCalledTimes(1);

    // TC-B5-04: offline error mapping
    createStreamMock.mockRejectedValueOnce(
      Object.assign(new Error("fetch failed"), { cause: { code: "ECONNREFUSED" } })
    );
    await expect(
      streamStrataProvider({
        systemInstruction: "Sys",
        userPrompt: "Usr",
        emitModelOutput: vi.fn(),
        deps,
      })
    ).rejects.toEqual(new StrataOfflineError("Local Strata server is offline"));
    expect(releaseMock).toHaveBeenCalledTimes(2);
  });

  it("TC-B5-05: rejects StrataContextOverflowError, skips create, and calls release() once when countTokens exceeds budget", async () => {
    const { deps, releaseMock, createStreamMock } = createMockDeps({
      countTokens: vi.fn().mockResolvedValue(999_999),
    });

    await expect(
      streamStrataProvider({
        systemInstruction: "Sys",
        userPrompt: "Usr",
        emitModelOutput: vi.fn(),
        deps,
      })
    ).rejects.toBeInstanceOf(StrataContextOverflowError);
    expect(createStreamMock).not.toHaveBeenCalled();
    expect(releaseMock).toHaveBeenCalledTimes(1);
  });

  it("TC-B5-06: propagates AbortError without calling release or create when aborted while queued in acquire", async () => {
    const abortErr = new DOMException("Aborted", "AbortError");
    const { deps, releaseMock, createStreamMock } = createMockDeps({
      getQueue: vi.fn().mockReturnValue({
        acquire: vi.fn().mockRejectedValue(abortErr),
      } as unknown as StrataQueue),
    });

    await expect(
      streamStrataProvider({
        systemInstruction: "Sys",
        userPrompt: "Usr",
        emitModelOutput: vi.fn(),
        deps,
      })
    ).rejects.toThrow("Aborted");
    expect(releaseMock).not.toHaveBeenCalled();
    expect(createStreamMock).not.toHaveBeenCalled();
  });

  it("TC-B5-07: rejects with 'returned an empty response' and calls release() once when stream yields only reasoning without content", async () => {
    async function* reasoningOnlyChunks() {
      yield {
        choices: [{ delta: { reasoning_content: "Thinking only..." }, finish_reason: "stop" }],
      };
    }

    const { deps, releaseMock, createStreamMock } = createMockDeps();
    createStreamMock.mockResolvedValue(reasoningOnlyChunks());

    await expect(
      streamStrataProvider({
        systemInstruction: "Sys",
        userPrompt: "Usr",
        emitModelOutput: vi.fn(),
        deps,
      })
    ).rejects.toThrow(/returned an empty response/);
    expect(releaseMock).toHaveBeenCalledTimes(1);
  });
});
