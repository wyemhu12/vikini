// /lib/features/novelcrafter/streamTargetGuard.ts
// Pure target lock and termination state resolution for Novelcrafter Direct Live Streaming (M13, m16)

import type { NovelcrafterBibleTarget, NovelcrafterStoryState } from "./types";

export interface StoryScopedState {
  ownerStoryId: string | null;
  state: NovelcrafterStoryState;
}

export type DirectStreamTargetKind = "chapter_prose" | "chapter_scenes" | "bible_field";

export interface DirectStreamTarget {
  storyId: string | null;
  kind: DirectStreamTargetKind;
  chapterId?: string;
  bibleField?: Exclude<NovelcrafterBibleTarget, "draft" | "scenes">;
  baseContent: string;
}

export function joinBaseAndStreamedText(baseContent: string, streamedText: string): string {
  const trimmedStream = streamedText;
  if (!trimmedStream) {
    return baseContent;
  }
  const baseTrimmedRight = baseContent.replace(/\s+$/, "");
  if (!baseTrimmedRight) {
    return trimmedStream;
  }
  return `${baseTrimmedRight}\n\n${trimmedStream}`;
}

/**
 * Apply streamed text to the locked target ONLY if scopedState.ownerStoryId matches target.storyId.
 * Prevents cross-story write contamination when switching stories that share chapter id "ch-1" (M13).
 */
export function applyStreamTargetUpdate(
  scoped: StoryScopedState,
  target: DirectStreamTarget,
  streamedText: string,
  now = Date.now()
): { nextState: NovelcrafterStoryState; applied: boolean } {
  if (scoped.ownerStoryId !== target.storyId) {
    return { nextState: scoped.state, applied: false };
  }

  if (target.kind === "chapter_prose") {
    if (!target.chapterId) {
      return { nextState: scoped.state, applied: false };
    }
    let found = false;
    const nextChapters = scoped.state.chapters.map((ch) => {
      if (ch.id !== target.chapterId) return ch;
      found = true;
      return {
        ...ch,
        content: joinBaseAndStreamedText(target.baseContent, streamedText),
        updatedAt: now,
      };
    });
    if (!found) {
      return { nextState: scoped.state, applied: false };
    }
    return {
      nextState: {
        ...scoped.state,
        chapters: nextChapters,
        updatedAt: Math.max(scoped.state.updatedAt + 1, now),
      },
      applied: true,
    };
  }

  if (target.kind === "chapter_scenes") {
    if (!target.chapterId) {
      return { nextState: scoped.state, applied: false };
    }
    let found = false;
    const nextChapters = scoped.state.chapters.map((ch) => {
      if (ch.id !== target.chapterId) return ch;
      found = true;
      return {
        ...ch,
        scenes: streamedText,
        updatedAt: now,
      };
    });
    if (!found) {
      return { nextState: scoped.state, applied: false };
    }
    return {
      nextState: {
        ...scoped.state,
        chapters: nextChapters,
        updatedAt: Math.max(scoped.state.updatedAt + 1, now),
      },
      applied: true,
    };
  }

  if (!target.bibleField) {
    return { nextState: scoped.state, applied: false };
  }

  return {
    nextState: {
      ...scoped.state,
      storyBible: {
        ...scoped.state.storyBible,
        [target.bibleField]: streamedText,
      },
      updatedAt: Math.max(scoped.state.updatedAt + 1, now),
    },
    applied: true,
  };
}

export type StreamTerminationReason = "completed" | "stopped" | "error";

const REFUSAL_PREFIX_REGEX =
  /^\s*(i cannot fulfill this request|i'm sorry,?\s+but i cannot|i'm sorry,?\s+[^,.]{1,30},\s+i cannot fulfill|i am unable to (fulfill|generate|continue|write)|as an ai(?:\s+(?:language model|assistant))?,?\s+i\s+(?:cannot|can't|am unable|do not|don't)|i cannot (continue|generate|write) this (story|scene|content))/i;

/**
 * Detects standard short LLM behavioral refusal responses so they are never appended
 * into the author's chapter prose, scenes, or Story Bible fields during direct streaming.
 */
export function isLikelyModelRefusalOutput(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 600) {
    return false;
  }
  return REFUSAL_PREFIX_REGEX.test(trimmed);
}

export function resolveStreamTerminationState(params: {
  reason: StreamTerminationReason;
  baseContent: string;
  accumulatedStreamText: string;
  isAppendMode: boolean;
}): {
  finalFieldContent: string;
  shouldSavePartialHistory: boolean;
  shouldPersistState: boolean;
  refusalDetected?: boolean;
  refusalMessage?: string;
} {
  const { reason, baseContent, accumulatedStreamText, isAppendMode } = params;
  const trimmed = accumulatedStreamText.trim();
  const hasGeneratedTokens = trimmed.length > 0;

  if (!hasGeneratedTokens) {
    return {
      finalFieldContent: baseContent,
      shouldSavePartialHistory: false,
      shouldPersistState: false,
    };
  }

  if (isLikelyModelRefusalOutput(trimmed)) {
    return {
      finalFieldContent: baseContent,
      shouldSavePartialHistory: false,
      shouldPersistState: false,
      refusalDetected: true,
      refusalMessage: trimmed,
    };
  }

  const finalFieldContent = isAppendMode
    ? joinBaseAndStreamedText(baseContent, accumulatedStreamText)
    : accumulatedStreamText;

  return {
    finalFieldContent,
    shouldSavePartialHistory: reason === "completed" || reason === "stopped" || reason === "error",
    shouldPersistState: true,
  };
}
