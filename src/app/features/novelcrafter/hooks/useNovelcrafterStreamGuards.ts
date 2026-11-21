// /app/features/novelcrafter/hooks/useNovelcrafterStreamGuards.ts
"use client";

import {
  useCallback,
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { useNovelcrafterStreamStore } from "@/lib/features/novelcrafter/novelcrafterStreamStore";
import {
  shouldAbortStreamOnConversationChange,
  type NovelcrafterStreamRunRegistry,
} from "@/lib/features/novelcrafter/streamRunRegistry";
import { hasActiveOverlayInDom, shouldCancelStreamOnEscape } from "../utils/novelcrafterKeyboard";

export interface UseNovelcrafterStreamGuardsOptions {
  selectedConversationId: string | null;
  isStreaming: boolean;
  setIsStreaming: Dispatch<SetStateAction<boolean>>;
  registry: NovelcrafterStreamRunRegistry;
  abortControllerRef: MutableRefObject<AbortController | null>;
  prevConversationIdRef: MutableRefObject<string | null>;
  isPromotingStoryRef: MutableRefObject<boolean>;
}

export function useNovelcrafterStreamGuards({
  selectedConversationId,
  isStreaming,
  setIsStreaming,
  registry,
  abortControllerRef,
  prevConversationIdRef,
  isPromotingStoryRef,
}: UseNovelcrafterStreamGuardsOptions) {
  const stopStream = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    const activeRunId = registry.getActiveRunId();
    if (activeRunId) {
      registry.endRun(activeRunId);
      useNovelcrafterStreamStore.getState().finishStreamRun(activeRunId);
    }
    setIsStreaming(false);
  }, [abortControllerRef, registry, setIsStreaming]);

  useEffect(() => {
    const prevStoryId = prevConversationIdRef.current;
    prevConversationIdRef.current = selectedConversationId;
    const activeRunId = registry.getActiveRunId();
    const activeTargetStoryId = activeRunId
      ? registry.getTarget(activeRunId)?.targetStoryId
      : undefined;

    if (
      shouldAbortStreamOnConversationChange({
        prevStoryId,
        nextStoryId: selectedConversationId,
        activeTargetStoryId,
        isPromotingPendingStory: isPromotingStoryRef.current,
      })
    ) {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      registry.reset();
      useNovelcrafterStreamStore.getState().resetStreamStore();
      setIsStreaming(false);
    }
  }, [
    selectedConversationId,
    registry,
    abortControllerRef,
    prevConversationIdRef,
    isPromotingStoryRef,
    setIsStreaming,
  ]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      registry.reset();
      useNovelcrafterStreamStore.getState().resetStreamStore();
    };
  }, [registry, abortControllerRef]);

  useEffect(() => {
    if (!isStreaming) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        shouldCancelStreamOnEscape({
          key: e.key,
          defaultPrevented: e.defaultPrevented,
          isStreaming,
          hasOpenModalOrPopover: hasActiveOverlayInDom(),
        })
      ) {
        e.preventDefault();
        stopStream();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isStreaming, stopStream]);

  return { stopStream };
}
