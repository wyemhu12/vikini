import { STRATA_DEFAULTS } from "@/lib/utils/constants";
import { getStrataConfig } from "./strataConfig";
import { StrataQueueFullError, StrataQueueTimeoutError } from "@/lib/features/local-llm/errors";

export interface StrataQueueSnapshot {
  active: 0 | 1;
  pending: number;
}

export interface StrataQueueAcquireOptions {
  signal?: AbortSignal;
  maxWaitMs?: number;
  onQueued?: (position: number) => void;
}

export interface StrataQueue {
  canAdmit: () => boolean;
  acquire: (options?: StrataQueueAcquireOptions) => Promise<() => void>;
  snapshot: () => StrataQueueSnapshot;
  resetForTests: () => void;
}

export type StrataAdmissionResult =
  | { ok: true }
  | {
      ok: false;
      status: 503 | 429;
      code: "LOCAL_LLM_DISABLED" | "LOCAL_LLM_BUSY";
      message: string;
    };

interface QueueWaiter {
  resolve: (release: () => void) => void;
  reject: (err: Error) => void;
  cleanup: () => void;
}

function createAbortError(): Error {
  const err = new Error("The operation was aborted");
  err.name = "AbortError";
  return err;
}

export function createStrataQueue(options?: { maxPending?: number }): StrataQueue {
  const maxPending = options?.maxPending ?? STRATA_DEFAULTS.QUEUE_MAX_PENDING;
  let active: 0 | 1 = 0;
  const waiters: QueueWaiter[] = [];

  const createRelease = (): (() => void) => {
    let released = false;
    return () => {
      if (released) return;
      released = true;

      const next = waiters.shift();
      if (next) {
        next.cleanup();
        // Keep active = 1 and hand over the slot to the next waiter
        next.resolve(createRelease());
      } else {
        active = 0;
      }
    };
  };

  const canAdmit = (): boolean => {
    return active === 0 || waiters.length < maxPending;
  };

  const acquire = (acquireOpts?: StrataQueueAcquireOptions): Promise<() => void> => {
    const signal = acquireOpts?.signal;
    const maxWaitMs = acquireOpts?.maxWaitMs ?? STRATA_DEFAULTS.QUEUE_MAX_WAIT_MS;

    if (signal?.aborted) {
      return Promise.reject(createAbortError());
    }

    if (active === 0) {
      active = 1;
      return Promise.resolve(createRelease());
    }

    if (waiters.length >= maxPending) {
      return Promise.reject(new StrataQueueFullError());
    }

    return new Promise<() => void>((resolve, reject) => {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const removeWaiter = () => {
        const idx = waiters.indexOf(waiter);
        if (idx !== -1) {
          waiters.splice(idx, 1);
        }
      };

      const onAbort = () => {
        removeWaiter();
        waiter.cleanup();
        reject(createAbortError());
      };

      const cleanup = () => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (signal) {
          signal.removeEventListener("abort", onAbort);
        }
      };

      const waiter: QueueWaiter = {
        resolve,
        reject,
        cleanup,
      };

      if (maxWaitMs > 0 && Number.isFinite(maxWaitMs)) {
        timeoutId = setTimeout(() => {
          removeWaiter();
          cleanup();
          reject(new StrataQueueTimeoutError());
        }, maxWaitMs);
      }

      if (signal) {
        signal.addEventListener("abort", onAbort, { once: true });
      }

      waiters.push(waiter);
      acquireOpts?.onQueued?.(waiters.length);
    });
  };

  const snapshot = (): StrataQueueSnapshot => ({
    active,
    pending: waiters.length,
  });

  const resetForTests = () => {
    while (waiters.length > 0) {
      const w = waiters.shift();
      w?.cleanup();
    }
    active = 0;
  };

  return {
    canAdmit,
    acquire,
    snapshot,
    resetForTests,
  };
}

declare global {
  var __vikiniStrataQueue: StrataQueue | undefined;
  var __vikiniStrataQueueMaxPending: number | undefined;
}

export function getStrataQueue(env: NodeJS.ProcessEnv = process.env): StrataQueue {
  let maxPending: number = STRATA_DEFAULTS.QUEUE_MAX_PENDING;
  try {
    maxPending = getStrataConfig(env).queueMaxPending;
  } catch {
    // Keep default maxPending if config is invalid
  }

  if (!globalThis.__vikiniStrataQueue || globalThis.__vikiniStrataQueueMaxPending !== maxPending) {
    globalThis.__vikiniStrataQueue = createStrataQueue({ maxPending });
    globalThis.__vikiniStrataQueueMaxPending = maxPending;
  }

  return globalThis.__vikiniStrataQueue;
}

/**
 * Pure pre-DB admission check: verifies `STRATA_ENABLED=true` and queue capacity
 * before mutating conversations/messages in Supabase (`M-1`).
 */
export function getStrataAdmission(
  env: NodeJS.ProcessEnv = process.env,
  queue?: StrataQueue
): StrataAdmissionResult {
  const cfg = getStrataConfig(env);
  if (!cfg.enabled) {
    return {
      ok: false,
      status: 503,
      code: "LOCAL_LLM_DISABLED",
      message: "Local LLM (Strata) is disabled",
    };
  }

  const targetQueue = queue ?? getStrataQueue(env);
  if (!targetQueue.canAdmit()) {
    return {
      ok: false,
      status: 429,
      code: "LOCAL_LLM_BUSY",
      message: "Local model queue is full",
    };
  }

  return { ok: true };
}
