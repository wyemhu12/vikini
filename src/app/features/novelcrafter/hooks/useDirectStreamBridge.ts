// /app/features/novelcrafter/hooks/useDirectStreamBridge.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/lib/store/toastStore";
import {
  mergeStreamedFeedbackItems,
  parseFeedbackItems,
} from "@/lib/features/novelcrafter/feedbackParser";
import {
  applyStreamTargetUpdate,
  resolveStreamTerminationState,
  type DirectStreamTarget,
  type StoryScopedState,
} from "@/lib/features/novelcrafter/streamTargetGuard";
import type {
  NovelcrafterChapter,
  NovelcrafterFeedbackItem,
  NovelcrafterStoryState,
} from "@/lib/features/novelcrafter/types";
import type {
  StreamTerminatedPayload,
  TriggerNovelcrafterStreamParams,
} from "./useNovelcrafterStream";

interface UseDirectStreamBridgeParams {
  selectedConversationId: string | null;
  latestStateRef: React.MutableRefObject<StoryScopedState>;
  applyDirectStoryState: (
    nextState: NovelcrafterStoryState,
    options?: { immediate?: boolean; skipSave?: boolean }
  ) => void;
  updateChapterFeedbackItems: (
    chapterId: string,
    updater: (items: NovelcrafterFeedbackItem[]) => NovelcrafterFeedbackItem[],
    immediate?: boolean
  ) => void;
}

export function useDirectStreamBridge({
  selectedConversationId,
  latestStateRef,
  applyDirectStoryState,
  updateChapterFeedbackItems,
}: UseDirectStreamBridgeParams) {
  const [isDirectStreamingToChapter, setIsDirectStreamingToChapter] = useState(false);
  const directStreamTargetRef = useRef<DirectStreamTarget | null>(null);
  const feedbackBaseItemsRef = useRef<{
    storyId: string;
    chapterId: string;
    baseItems: NovelcrafterFeedbackItem[];
    isReplyMode: boolean;
    nowMs: number;
  } | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const pendingChunkRef = useRef<{
    storyId: string;
    fullContent: string;
    params: TriggerNovelcrafterStreamParams;
  } | null>(null);

  const cancelRaf = useCallback(() => {
    if (rafIdRef.current !== null && typeof window !== "undefined") {
      window.cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    pendingChunkRef.current = null;
  }, []);

  useEffect(() => {
    cancelRaf();
    directStreamTargetRef.current = null;
    feedbackBaseItemsRef.current = null;
    setIsDirectStreamingToChapter(false);
    return () => cancelRaf();
  }, [selectedConversationId, cancelRaf]);

  const handleStreamStarted = useCallback(
    ({ storyId, params }: { storyId: string; params: TriggerNovelcrafterStreamParams }) => {
      cancelRaf();
      const currentState = latestStateRef.current.state;
      const activeCh =
        currentState.chapters.find(
          (c: NovelcrafterChapter) => c.id === currentState.activeChapterId
        ) || currentState.chapters[0];
      const isDirectProse =
        (params.feature === "write" && params.writeMode !== "openings_3") ||
        (params.feature === "bible" && params.bibleTarget === "draft");

      if (params.feature === "feedback") {
        feedbackBaseItemsRef.current = {
          storyId,
          chapterId: activeCh.id,
          baseItems: activeCh.feedbackItems ?? [],
          isReplyMode: Boolean(params.replyToFeedbackId),
          nowMs: Date.now(),
        };
        directStreamTargetRef.current = null;
        setIsDirectStreamingToChapter(false);
        return;
      }

      feedbackBaseItemsRef.current = null;

      if (isDirectProse) {
        directStreamTargetRef.current = {
          storyId,
          kind: "chapter_prose",
          chapterId: activeCh.id,
          baseContent: activeCh.content,
        };
        setIsDirectStreamingToChapter(true);
      } else if (params.feature === "bible" && params.bibleTarget === "scenes") {
        directStreamTargetRef.current = {
          storyId,
          kind: "chapter_scenes",
          chapterId: activeCh.id,
          baseContent: activeCh.scenes,
        };
        setIsDirectStreamingToChapter(true);
      } else if (params.feature === "bible" && params.bibleTarget === "chapter_summary") {
        directStreamTargetRef.current = {
          storyId,
          kind: "chapter_summary",
          chapterId: activeCh.id,
          baseContent: activeCh.summary ?? "",
        };
        setIsDirectStreamingToChapter(true);
      } else if (
        params.feature === "bible" &&
        params.bibleTarget &&
        params.bibleTarget !== "draft" &&
        params.bibleTarget !== "scenes" &&
        params.bibleTarget !== "chapter_summary"
      ) {
        const field = params.bibleTarget;
        directStreamTargetRef.current = {
          storyId,
          kind: "bible_field",
          bibleField: field,
          baseContent: currentState.storyBible[field],
        };
        setIsDirectStreamingToChapter(false);
      } else {
        directStreamTargetRef.current = null;
        setIsDirectStreamingToChapter(false);
      }
    },
    [cancelRaf, latestStateRef]
  );

  const handleStreamTokenChunk = useCallback(
    (payload: {
      storyId: string;
      fullContent: string;
      params: TriggerNovelcrafterStreamParams;
    }) => {
      pendingChunkRef.current = payload;
      if (rafIdRef.current !== null || typeof window === "undefined") return;
      rafIdRef.current = window.requestAnimationFrame(() => {
        rafIdRef.current = null;
        const pending = pendingChunkRef.current;
        if (!pending) return;

        if (pending.params.feature === "feedback") {
          if (latestStateRef.current.ownerStoryId !== pending.storyId) return;
          const fbTarget = feedbackBaseItemsRef.current;
          const targetChapterId =
            fbTarget && fbTarget.storyId === pending.storyId
              ? fbTarget.chapterId
              : latestStateRef.current.state.activeChapterId;
          const parsedItems = parseFeedbackItems(pending.fullContent, {
            isStreaming: true,
            nowMs: fbTarget?.nowMs,
          });
          if (parsedItems.length === 0) return;
          const currentState = latestStateRef.current.state;
          applyDirectStoryState(
            {
              ...currentState,
              chapters: currentState.chapters.map((ch: NovelcrafterChapter) =>
                ch.id === targetChapterId
                  ? {
                      ...ch,
                      feedbackItems: mergeStreamedFeedbackItems({
                        parsedItems,
                        baseItems: fbTarget?.baseItems ?? ch.feedbackItems,
                        isReplyMode:
                          fbTarget?.isReplyMode ?? Boolean(pending.params.replyToFeedbackId),
                      }),
                    }
                  : ch
              ),
            },
            { skipSave: true }
          );
          return;
        }

        const target = directStreamTargetRef.current;
        if (!target || target.storyId !== pending.storyId) return;
        const applied = applyStreamTargetUpdate(
          latestStateRef.current,
          target,
          pending.fullContent
        );
        if (applied.applied) applyDirectStoryState(applied.nextState, { skipSave: true });
      });
    },
    [latestStateRef, applyDirectStoryState]
  );

  const handleStreamTerminated = useCallback(
    (payload: StreamTerminatedPayload): { handledRefusal?: boolean } | void => {
      cancelRaf();
      setIsDirectStreamingToChapter(false);
      if (payload.params.feature === "feedback") {
        const fbTarget = feedbackBaseItemsRef.current;
        feedbackBaseItemsRef.current = null;
        if (latestStateRef.current.ownerStoryId === payload.storyId && payload.fullContent.trim()) {
          const parsedItems = parseFeedbackItems(payload.fullContent, {
            isStreaming: false,
            nowMs: fbTarget?.nowMs,
          });
          const targetChapterId =
            fbTarget && fbTarget.storyId === payload.storyId
              ? fbTarget.chapterId
              : latestStateRef.current.state.activeChapterId;
          if (parsedItems.length > 0) {
            updateChapterFeedbackItems(
              targetChapterId,
              (existing) =>
                mergeStreamedFeedbackItems({
                  parsedItems,
                  baseItems: fbTarget?.baseItems ?? existing,
                  isReplyMode: fbTarget?.isReplyMode ?? Boolean(payload.params.replyToFeedbackId),
                }),
              true
            );
          }
        }
        directStreamTargetRef.current = null;
        return;
      }

      const target = directStreamTargetRef.current;
      directStreamTargetRef.current = null;
      if (!target || latestStateRef.current.ownerStoryId !== target.storyId) return;

      const resolved = resolveStreamTerminationState({
        reason: payload.reason,
        baseContent: target.baseContent,
        accumulatedStreamText: payload.fullContent,
        isAppendMode: target.kind === "chapter_prose",
      });
      const applied = applyStreamTargetUpdate(
        latestStateRef.current,
        { ...target, baseContent: "" },
        resolved.finalFieldContent
      );
      if (applied.applied) {
        applyDirectStoryState(applied.nextState, {
          immediate: resolved.shouldPersistState,
          skipSave: !resolved.shouldPersistState,
        });
      }
      if (resolved.refusalDetected && resolved.refusalMessage) {
        toast.error(resolved.refusalMessage.slice(0, 240));
        return { handledRefusal: true };
      }
    },
    [cancelRaf, latestStateRef, applyDirectStoryState, updateChapterFeedbackItems]
  );

  return {
    isDirectStreamingToChapter,
    handleStreamStarted,
    handleStreamTokenChunk,
    handleStreamTerminated,
  };
}
