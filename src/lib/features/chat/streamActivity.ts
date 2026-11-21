/**
 * Pure client-side streaming activity state machine and formatting helpers.
 *
 * Consumes structured SSE meta events (codeExecutionStatus, webSearchStatus,
 * webFetchStatus, functionCall, localQueue, localPromptProgress) as well as
 * thinking/token lifecycle transitions to keep users informed during long
 * tool runs or silent streaming pauses without triggering 60fps re-renders.
 */

import type { LocalStreamProgress } from "./thinkingStats";
import type { ParsedSSEEvent } from "./streamProtocol";

export type StreamActivityPhase =
  | "connecting"
  | "thinking"
  | "code_writing"
  | "code_running"
  | "web_searching"
  | "web_fetching"
  | "tool_running"
  | "local_queue"
  | "local_prompt"
  | "responding";

export interface StreamActivity {
  phase: StreamActivityPhase;
  startedAt: number;
  updatedAt: number;
  chars?: number;
  toolName?: string;
  queuePosition?: number;
  promptPercent?: number;
}

export const QUIET_STREAM_THRESHOLD_MS = 8_000;
export const TOKEN_ACTIVITY_THROTTLE_MS = 2_000;

export function createInitialStreamActivity(now = Date.now()): StreamActivity {
  return {
    phase: "connecting",
    startedAt: now,
    updatedAt: now,
  };
}

function parseNonNegativeInt(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return Math.floor(value);
}

function transitionPhase(
  current: StreamActivity | null,
  phase: StreamActivityPhase,
  now: number,
  extra?: Partial<Omit<StreamActivity, "phase" | "startedAt" | "updatedAt">>
): StreamActivity {
  const startedAt = current?.phase === phase ? current.startedAt : now;
  return {
    phase,
    startedAt,
    updatedAt: now,
    ...extra,
  };
}

export function reduceStreamActivityFromMeta(
  current: StreamActivity | null,
  data: ParsedSSEEvent["data"],
  now = Date.now()
): StreamActivity | undefined {
  if (!data || typeof data.type !== "string") return undefined;

  if (data.type === "codeExecutionStatus") {
    if (typeof data.status !== "string") return undefined;
    const chars = parseNonNegativeInt(data.chars);
    if (data.status === "writing") {
      return transitionPhase(current, "code_writing", now, {
        chars: chars ?? (current?.phase === "code_writing" ? current.chars : undefined),
      });
    }
    if (data.status === "running") {
      return transitionPhase(current, "code_running", now, {
        chars: chars ?? current?.chars,
      });
    }
    if (data.status === "done") {
      return transitionPhase(current, "responding", now);
    }
    return undefined;
  }

  if (data.type === "webSearchStatus") {
    if (typeof data.status !== "string") return undefined;
    if (data.status === "searching") {
      return transitionPhase(current, "web_searching", now);
    }
    if (data.status === "done") {
      return transitionPhase(current, "responding", now);
    }
    return undefined;
  }

  if (data.type === "webFetchStatus") {
    if (typeof data.status !== "string") return undefined;
    if (data.status === "fetching") {
      return transitionPhase(current, "web_fetching", now);
    }
    if (data.status === "done") {
      return transitionPhase(current, "responding", now);
    }
    return undefined;
  }

  if (data.type === "functionCall") {
    if (typeof data.name !== "string" || !data.name.trim()) return undefined;
    return transitionPhase(current, "tool_running", now, { toolName: data.name.trim() });
  }

  if (data.type === "localQueue") {
    if (typeof data.position !== "number" || !Number.isFinite(data.position)) return undefined;
    return transitionPhase(current, "local_queue", now, { queuePosition: data.position });
  }

  if (data.type === "localPromptProgress") {
    if (
      typeof data.total !== "number" ||
      !Number.isFinite(data.total) ||
      typeof data.processed !== "number" ||
      !Number.isFinite(data.processed)
    ) {
      return undefined;
    }
    const cache = typeof data.cache === "number" && Number.isFinite(data.cache) ? data.cache : 0;
    const pct = Math.min(
      100,
      Math.max(0, Math.round(((cache + data.processed) / Math.max(1, data.total)) * 100))
    );
    return transitionPhase(current, "local_prompt", now, { promptPercent: pct });
  }

  return undefined;
}

export function reduceStreamActivityOnThinking(
  current: StreamActivity | null,
  now = Date.now()
): StreamActivity | undefined {
  if (current?.phase === "thinking") {
    if (now - current.updatedAt < TOKEN_ACTIVITY_THROTTLE_MS) {
      return undefined;
    }
    return { ...current, updatedAt: now };
  }
  return { phase: "thinking", startedAt: now, updatedAt: now };
}

export function reduceStreamActivityOnToken(
  current: StreamActivity | null,
  now = Date.now()
): StreamActivity | undefined {
  if (current?.phase === "responding") {
    if (now - current.updatedAt < TOKEN_ACTIVITY_THROTTLE_MS) {
      return undefined;
    }
    return { ...current, updatedAt: now };
  }
  return { phase: "responding", startedAt: now, updatedAt: now };
}

export function isQuietStream(
  activity: StreamActivity | null,
  now: number,
  thresholdMs = QUIET_STREAM_THRESHOLD_MS
): boolean {
  if (!activity) return false;
  return now - activity.updatedAt >= thresholdMs;
}

export function shouldShowActivityBar(
  activity: StreamActivity | null,
  now: number,
  hasDisplayContent: boolean
): boolean {
  if (!activity) return false;
  if (activity.phase === "responding") {
    return isQuietStream(activity, now);
  }
  if (activity.phase === "connecting") {
    return !hasDisplayContent || isQuietStream(activity, now);
  }
  return true;
}

export function formatElapsedDuration(elapsedMs: number): string {
  const safeSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  if (safeSeconds < 60) {
    return `${safeSeconds}s`;
  }
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins}m ${String(secs).padStart(2, "0")}s`;
}

export function formatStreamChars(chars: number): string {
  if (!Number.isFinite(chars) || chars <= 0) return "0";
  if (chars < 1000) return String(Math.floor(chars));
  return `${(chars / 1000).toFixed(1)}K`;
}

export function formatLocalProgressText(
  localProgress: LocalStreamProgress | undefined,
  t: (key: string) => string
): string | undefined {
  if (!localProgress) return undefined;
  if (localProgress.type === "localQueue") {
    return (t("localLlmQueued") || "Waiting in queue ({position})").replace(
      "{position}",
      String(localProgress.position)
    );
  }
  if (localProgress.type === "localPromptProgress") {
    const pct = Math.min(
      100,
      Math.max(
        0,
        Math.round(
          ((localProgress.cache + localProgress.processed) / Math.max(1, localProgress.total)) * 100
        )
      )
    );
    return (t("localPromptProgress") || "Reading context {pct}%").replace("{pct}", String(pct));
  }
  return undefined;
}
