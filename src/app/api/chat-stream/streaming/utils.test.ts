import { describe, it, expect, vi, afterEach } from "vitest";
import { withTimeout, withIdleTimeout, sendEvent, getStreamTimeout } from "./utils";
import { StreamTimeoutError, TIMEOUT_CONFIG } from "./types";

describe("streaming/utils (TC-W1-08)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("withTimeout", () => {
    it("resolves and clears pending timer when promise settles before deadline", async () => {
      vi.useFakeTimers();
      const clearSpy = vi.spyOn(globalThis, "clearTimeout");

      const res = await withTimeout(Promise.resolve("ok"), 5000);
      expect(res).toBe("ok");
      expect(clearSpy).toHaveBeenCalled();
    });

    it("rejects with StreamTimeoutError when deadline elapses", async () => {
      vi.useFakeTimers();
      const never = new Promise<string>(() => {});
      const p = withTimeout(never, 100);
      const assertion = expect(p).rejects.toBeInstanceOf(StreamTimeoutError);

      await vi.advanceTimersByTimeAsync(150);
      await assertion;
    });
  });

  describe("withIdleTimeout", () => {
    it("yields chunks normally and calls iterator.return() on completion", async () => {
      const returnSpy = vi.fn().mockResolvedValue({ done: true, value: undefined });
      const items = ["a", "b", "c"];
      let idx = 0;

      const iterable: AsyncIterable<string> = {
        [Symbol.asyncIterator]() {
          return {
            async next() {
              if (idx < items.length) return { value: items[idx++], done: false };
              return { value: undefined, done: true };
            },
            return: returnSpy,
          };
        },
      };

      const received: string[] = [];
      for await (const chunk of withIdleTimeout(iterable, 500)) {
        received.push(chunk);
      }

      expect(received).toEqual(["a", "b", "c"]);
      expect(returnSpy).toHaveBeenCalledTimes(1);
    });

    it("throws StreamTimeoutError on idle stall, closes iterator via return(), and swallows late next() rejection without UnhandledPromiseRejection", async () => {
      vi.useFakeTimers();
      const returnSpy = vi.fn().mockResolvedValue({ done: true, value: undefined });
      const deferred: { reject?: (err: Error) => void } = {};
      let yieldedFirst = false;

      const unhandled: unknown[] = [];
      const onUnhandled = (reason: unknown) => unhandled.push(reason);
      process.on("unhandledRejection", onUnhandled);

      try {
        const stalledIterable: AsyncIterable<string> = {
          [Symbol.asyncIterator]() {
            return {
              next() {
                if (!yieldedFirst) {
                  yieldedFirst = true;
                  return Promise.resolve({ value: "first", done: false });
                }
                return new Promise<IteratorResult<string>>((_resolve, reject) => {
                  deferred.reject = reject;
                });
              },
              return: returnSpy,
            };
          },
        };

        const collected: string[] = [];
        const run = (async () => {
          for await (const item of withIdleTimeout(stalledIterable, 100)) {
            collected.push(item);
          }
        })();

        const assertion = expect(run).rejects.toBeInstanceOf(StreamTimeoutError);
        await vi.advanceTimersByTimeAsync(150);
        await assertion;

        expect(collected).toEqual(["first"]);
        expect(returnSpy).toHaveBeenCalledTimes(1);

        // Simulate upstream SDK rejecting the hanging next() promise AFTER timeout
        deferred.reject?.(new Error("Upstream socket reset after timeout"));
        await vi.advanceTimersByTimeAsync(10);
        expect(unhandled).toHaveLength(0);
      } finally {
        process.off("unhandledRejection", onUnhandled);
      }
    });
  });

  describe("sendEvent", () => {
    it("encodes SSE event using shared TextEncoder", () => {
      const enqueue = vi.fn();
      const controller = { enqueue } as unknown as ReadableStreamDefaultController<Uint8Array>;

      sendEvent(controller, "token", { t: "hi" });
      expect(enqueue).toHaveBeenCalledTimes(1);
      const decoded = new TextDecoder().decode(enqueue.mock.calls[0][0]);
      expect(decoded).toBe('event: token\ndata: {"t":"hi"}\n\n');
    });
  });

  describe("getStreamTimeout (TC-SU-02)", () => {
    afterEach(() => {
      delete process.env.STREAM_TIMEOUT_MS;
    });

    it("returns CLAUDE and CLAUDE_DEEP_THINKING timeouts for Claude models", () => {
      expect(getStreamTimeout("claude-sonnet-4-5", "off")).toBe(TIMEOUT_CONFIG.CLAUDE);
      expect(getStreamTimeout("claude-sonnet-4-5", "high")).toBe(
        TIMEOUT_CONFIG.CLAUDE_DEEP_THINKING
      );
      expect(getStreamTimeout("gemini-4-argon", "high")).toBe(TIMEOUT_CONFIG.ARGON);
      expect(getStreamTimeout("unknown-model", "off")).toBe(TIMEOUT_CONFIG.DEFAULT);
    });

    it("prioritizes STREAM_TIMEOUT_MS env override", () => {
      process.env.STREAM_TIMEOUT_MS = "45000";
      expect(getStreamTimeout("claude-sonnet-4-5", "high")).toBe(45000);
    });
  });
});
