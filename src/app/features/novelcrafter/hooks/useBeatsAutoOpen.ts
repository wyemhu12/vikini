// /app/features/novelcrafter/hooks/useBeatsAutoOpen.ts
// Open/close state of the Scenes (Chapter Beats) card: auto-opens only for genuinely empty chapters
// once the story state has settled, and keeps the user's choice while they write or the AI streams.
"use client";

import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";

export interface StoryStateSettledInput {
  isAuthed: boolean;
  isLoadingConversations: boolean;
  isLoadingState: boolean;
  validStoryId: string | null;
  /** Story id whose state is currently shown; `undefined` until the first hydration finished. */
  hydratedStoryId: string | null | undefined;
  storyCount: number;
  hasUnsavedDraft: boolean;
}

/** True when the story state on screen is the real state of the selected story (not a placeholder). */
export function resolveStoryStateSettled(input: StoryStateSettledInput): boolean {
  if (input.isAuthed && input.isLoadingConversations) return false;
  if (
    input.isAuthed &&
    input.validStoryId === null &&
    input.storyCount > 0 &&
    !input.hasUnsavedDraft
  ) {
    return false; // the first story is about to be auto-selected
  }
  if (input.isLoadingState) return false;
  return input.hydratedStoryId !== undefined && input.hydratedStoryId === input.validStoryId;
}

export interface UseBeatsAutoOpenOptions {
  storyId: string | null;
  chapterId: string;
  chapterContent: string;
  isStateSettled: boolean;
  isStreaming: boolean;
  promotedDraftStoryId: string | null;
}

/** Story-level inputs the editor controller receives from the story hook. */
export type BeatsStoryContext = Pick<
  UseBeatsAutoOpenOptions,
  "storyId" | "isStateSettled" | "promotedDraftStoryId"
>;

interface BeatsChoice {
  storyId: string | null;
  chapterId: string;
  open: boolean;
}

export function useBeatsAutoOpen({
  storyId,
  chapterId,
  chapterContent,
  isStateSettled,
  isStreaming,
  promotedDraftStoryId,
}: UseBeatsAutoOpenOptions) {
  const [choice, setChoice] = useState<BeatsChoice | null>(null);

  // A choice made on an unsaved draft (storyId null) carries over only to the story it was promoted into.
  const storyMatches =
    choice !== null &&
    (choice.storyId === storyId ||
      (choice.storyId === null && storyId !== null && storyId === promotedDraftStoryId));
  const activeChoice = choice && choice.chapterId === chapterId && storyMatches ? choice : null;
  const autoOpen = isStateSettled && chapterContent.trim().length === 0;
  const beatsOpen = activeChoice ? activeChoice.open : autoOpen;

  const commit = useCallback(
    (open: boolean) => setChoice({ storyId, chapterId, open }),
    [storyId, chapterId]
  );

  const setBeatsOpen = useCallback(
    (next: SetStateAction<boolean>) => commit(typeof next === "function" ? next(beatsOpen) : next),
    [commit, beatsOpen]
  );

  /** Freeze the currently shown state (called on user edits) so content changes don't toggle the card. */
  const lockCurrent = useCallback(() => {
    if (!activeChoice) commit(beatsOpen);
  }, [activeChoice, commit, beatsOpen]);

  // An AI run starting → freeze before the first token changes the chapter content.
  const prevStreamingRef = useRef(isStreaming);
  useEffect(() => {
    if (isStreaming && !prevStreamingRef.current) lockCurrent();
    prevStreamingRef.current = isStreaming;
  }, [isStreaming, lockCurrent]);

  return { beatsOpen, setBeatsOpen, lockCurrent };
}
