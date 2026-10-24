import { estimateTokens } from "@/lib/utils/tokenEstimate";

export interface ThinkingStatsSnapshot {
  tokens: number;
  elapsedMs: number;
  live?: boolean;
}

export type LocalStreamProgress =
  | {
      type: "localQueue";
      position: number;
    }
  | {
      type: "localPromptProgress";
      total: number;
      cache: number;
      processed: number;
      time_ms: number;
    };

export function computeThinkingStats(params: {
  startedAt: number;
  now: number;
  text: string;
  live?: boolean;
}): ThinkingStatsSnapshot {
  const elapsedMs = Math.max(0, params.now - params.startedAt);
  const tokens = params.text ? estimateTokens(params.text) : 0;
  return {
    tokens,
    elapsedMs,
    ...(params.live !== undefined ? { live: params.live } : {}),
  };
}

export function formatThinkingDuration(elapsedMs: number): string {
  const seconds = Math.max(0, elapsedMs) / 1000;
  return seconds.toFixed(1);
}
