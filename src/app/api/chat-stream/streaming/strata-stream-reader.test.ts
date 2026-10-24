import { describe, it, expect } from "vitest";
import { consumeStrataChunks } from "./strata-stream-reader";

async function* makeAsyncStream(chunks: unknown[]): AsyncIterable<unknown> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

describe("consumeStrataChunks", () => {
  it("routes reasoning_content, content, throttled prompt_progress, and usage (TC-24)", async () => {
    const reasoningChunks: string[] = [];
    const contentChunks: string[] = [];
    const progressEvents: unknown[] = [];
    let finishReason = "";
    let now = 1000;

    const stream = makeAsyncStream([
      { prompt_progress: { total: 500, cache: 250, processed: 100, time_ms: 50 } },
      { prompt_progress: { total: 500, cache: 250, processed: 300, time_ms: 90 } }, // throttled
      { choices: [{ delta: { reasoning_content: "Thinking step 1. " }, finish_reason: null }] },
      { choices: [{ delta: { reasoning_content: "Thinking step 2." }, finish_reason: null }] },
      { choices: [{ delta: { content: "Hello " }, finish_reason: null }] },
      { choices: [{ delta: { content: "world!" }, finish_reason: "stop" }] },
      {
        usage: {
          prompt_tokens: 500,
          completion_tokens: 50,
          total_tokens: 550,
          prompt_tokens_details: { cached_tokens: 250 },
        },
      },
    ]);

    let capturedUsage: unknown = null;
    await consumeStrataChunks(stream, {
      isCancelled: () => false,
      now: () => {
        now += 400; // 1st at 1400 (emits), 2nd at 1800 (< 1000ms delta, throttled)
        return now;
      },
      progressThrottleMs: 1000,
      onProgress: (p) => progressEvents.push(p),
      onReasoning: (r) => reasoningChunks.push(r),
      onContent: (c) => contentChunks.push(c),
      onFinish: (reason) => {
        finishReason = reason;
      },
      onUsage: (u) => {
        capturedUsage = u;
      },
    });

    expect(progressEvents).toHaveLength(1);
    expect(reasoningChunks.join("")).toBe("Thinking step 1. Thinking step 2.");
    expect(contentChunks.join("")).toBe("Hello world!");
    expect(finishReason).toBe("stop");
    expect(capturedUsage).toEqual({
      promptTokens: 500,
      completionTokens: 50,
      totalTokens: 550,
      cachedTokens: 250,
    });
  });

  it("reports finish_reason 'length' when thinking exhausts budget with empty content (TC-25)", async () => {
    let finishReason = "";
    const contentChunks: string[] = [];

    const stream = makeAsyncStream([
      {
        choices: [
          { delta: { reasoning_content: "Long chain of thought..." }, finish_reason: null },
        ],
      },
      { choices: [{ delta: {}, finish_reason: "length" }] },
    ]);

    await consumeStrataChunks(stream, {
      isCancelled: () => false,
      onReasoning: () => undefined,
      onContent: (c) => contentChunks.push(c),
      onFinish: (r) => {
        finishReason = r;
      },
    });

    expect(contentChunks).toHaveLength(0);
    expect(finishReason).toBe("length");
  });
});
