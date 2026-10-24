import { describe, it, expect, beforeEach } from "vitest";
import { createStrataQueue, getStrataAdmission } from "./strataQueue";
import { StrataQueueFullError, StrataQueueTimeoutError } from "@/lib/features/local-llm/errors";

describe("strataQueue", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it("serializes concurrent jobs in FIFO order with active <= 1 (TC-12, TC-13)", async () => {
    const queue = createStrataQueue({ maxPending: 3 });
    const executionOrder: number[] = [];
    let activeCount = 0;
    let maxObservedActive = 0;

    const runJob = async (id: number, delayMs: number) => {
      const release = await queue.acquire({ maxWaitMs: 5000 });
      try {
        activeCount++;
        maxObservedActive = Math.max(maxObservedActive, activeCount);
        executionOrder.push(id);
        await new Promise((r) => setTimeout(r, delayMs));
        activeCount--;
        return id;
      } finally {
        release();
      }
    };

    const results = await Promise.all([runJob(1, 20), runJob(2, 10), runJob(3, 5)]);
    expect(results).toEqual([1, 2, 3]);
    expect(executionOrder).toEqual([1, 2, 3]);
    expect(maxObservedActive).toBe(1);
    expect(queue.snapshot()).toEqual({ active: 0, pending: 0 });
  });

  it("throws StrataQueueFullError immediately when pending reaches maxPending (TC-14)", async () => {
    const queue = createStrataQueue({ maxPending: 1 });
    const release1 = await queue.acquire({ maxWaitMs: 5000 });
    const waiter2Promise = queue.acquire({ maxWaitMs: 5000 });

    await expect(queue.acquire({ maxWaitMs: 5000 })).rejects.toBeInstanceOf(StrataQueueFullError);

    release1();
    const release2 = await waiter2Promise;
    release2();
  });

  it("evicts queued waiter when AbortSignal fires before execution (TC-15)", async () => {
    const queue = createStrataQueue({ maxPending: 2 });
    const release1 = await queue.acquire({ maxWaitMs: 5000 });

    const abortController = new AbortController();
    const waiter2Promise = queue.acquire({
      signal: abortController.signal,
      maxWaitMs: 5000,
    });

    abortController.abort();
    await expect(waiter2Promise).rejects.toThrow(/aborted/i);
    expect(queue.snapshot().pending).toBe(0);

    release1();
    expect(queue.snapshot()).toEqual({ active: 0, pending: 0 });
  });

  it("throws StrataQueueTimeoutError when waiter exceeds maxWaitMs (TC-16)", async () => {
    const queue = createStrataQueue({ maxPending: 2 });
    const release1 = await queue.acquire({ maxWaitMs: 5000 });

    const waiter2Promise = queue.acquire({ maxWaitMs: 20 });
    await expect(waiter2Promise).rejects.toBeInstanceOf(StrataQueueTimeoutError);

    release1();
  });

  it("getStrataAdmission returns LOCAL_LLM_DISABLED when STRATA_ENABLED is false (TC-33)", () => {
    const result = getStrataAdmission({ ...process.env, STRATA_ENABLED: "false" });
    expect(result).toEqual({
      ok: false,
      status: 503,
      code: "LOCAL_LLM_DISABLED",
      message: "Local LLM (Strata) is disabled",
    });
  });

  it("getStrataAdmission returns ok: true when enabled and LOCAL_LLM_BUSY when queue is full (TC-32)", () => {
    const queue = createStrataQueue({ maxPending: 0 });
    expect(getStrataAdmission({ ...process.env, STRATA_ENABLED: "true" }, queue)).toEqual({
      ok: true,
    });

    void queue.acquire({ maxWaitMs: 5000 });
    const busy = getStrataAdmission({ ...process.env, STRATA_ENABLED: "true" }, queue);
    expect(busy).toEqual({
      ok: false,
      status: 429,
      code: "LOCAL_LLM_BUSY",
      message: "Local model queue is full",
    });
    queue.resetForTests();
  });
});
