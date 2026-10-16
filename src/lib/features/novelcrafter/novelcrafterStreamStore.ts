// /lib/features/novelcrafter/novelcrafterStreamStore.ts
// Dedicated Zustand micro-store with requestAnimationFrame token batching for SSE streaming (NC-16, NC-31)

import { create } from "zustand";
import type { NovelcrafterFeatureSlot } from "./types";

export interface NovelcrafterStreamingMeta {
  feature: NovelcrafterFeatureSlot;
  subLabel?: string;
  model: string;
  routedModel?: string;
  gemName: string | null;
  personaName: string | null;
}

export interface NovelcrafterStreamStoreState {
  isStreaming: boolean;
  activeRunId: string | null;
  streamingText: string;
  streamingThinking: string;
  streamingMeta: NovelcrafterStreamingMeta | null;
  beginStreamRun: (runId: string, meta: NovelcrafterStreamingMeta) => void;
  updateStreamMeta: (runId: string, patch: Partial<NovelcrafterStreamingMeta>) => void;
  flushStreamSnapshot: (runId: string, text: string, thinking: string) => void;
  finishStreamRun: (runId: string) => void;
  resetStreamStore: () => void;
}

export const useNovelcrafterStreamStore = create<NovelcrafterStreamStoreState>((set) => ({
  isStreaming: false,
  activeRunId: null,
  streamingText: "",
  streamingThinking: "",
  streamingMeta: null,
  beginStreamRun: (runId, meta) =>
    set({
      isStreaming: true,
      activeRunId: runId,
      streamingText: "",
      streamingThinking: "",
      streamingMeta: meta,
    }),
  updateStreamMeta: (runId, patch) =>
    set((prev) => {
      if (prev.activeRunId !== runId || !prev.streamingMeta) return prev;
      return {
        streamingMeta: { ...prev.streamingMeta, ...patch },
      };
    }),
  flushStreamSnapshot: (runId, text, thinking) =>
    set((prev) => {
      if (prev.activeRunId !== runId) return prev;
      return {
        streamingText: text,
        streamingThinking: thinking,
      };
    }),
  finishStreamRun: (runId) =>
    set((prev) => {
      if (prev.activeRunId !== runId) return prev;
      return {
        isStreaming: false,
        activeRunId: null,
        streamingText: "",
        streamingThinking: "",
        streamingMeta: null,
      };
    }),
  resetStreamStore: () =>
    set({
      isStreaming: false,
      activeRunId: null,
      streamingText: "",
      streamingThinking: "",
      streamingMeta: null,
    }),
}));

export function createRafStreamBatcher(
  runId: string,
  onFlush: (runId: string, text: string, thinking: string) => void
) {
  let latestText = "";
  let latestThinking = "";
  let rafId: number | null = null;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  const flushNow = () => {
    if (rafId !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
    onFlush(runId, latestText, latestThinking);
  };

  const scheduleUpdate = (text: string, thinking: string) => {
    latestText = text;
    latestThinking = thinking;
    if (rafId !== null || timerId !== null) return;
    if (typeof requestAnimationFrame === "function") {
      rafId = requestAnimationFrame(() => {
        rafId = null;
        onFlush(runId, latestText, latestThinking);
      });
    } else {
      timerId = setTimeout(() => {
        timerId = null;
        onFlush(runId, latestText, latestThinking);
      }, 16);
    }
  };

  const cancel = () => {
    if (rafId !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  };

  return { scheduleUpdate, flushNow, cancel };
}
