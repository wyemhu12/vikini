// /lib/features/novelcrafter/streamRunRegistry.ts
// Run-scoped SSE stream registry with pending-story promotion and non-active chapter guard (NC-02, NC-03, NC-04, Q3)

import type { NovelcrafterBibleTarget, NovelcrafterFeatureSlot } from "./types";

export interface NovelcrafterStreamRunTarget {
  runId: string;
  targetStoryId: string | null;
  targetChapterId: string | null;
  feature: NovelcrafterFeatureSlot;
  bibleTarget?: NovelcrafterBibleTarget;
  subLabel?: string;
}

export class NovelcrafterStreamRunRegistry {
  private activeRunId: string | null = null;
  private runs = new Map<string, NovelcrafterStreamRunTarget>();

  isBusy(): boolean {
    return this.activeRunId !== null;
  }

  getActiveRunId(): string | null {
    return this.activeRunId;
  }

  getTarget(runId: string): NovelcrafterStreamRunTarget | null {
    return this.runs.get(runId) || null;
  }

  startRun(params: Omit<NovelcrafterStreamRunTarget, "runId">): string | null {
    if (this.activeRunId !== null) {
      return null;
    }
    const runId = `nc-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const record: NovelcrafterStreamRunTarget = {
      runId,
      targetStoryId: params.targetStoryId,
      targetChapterId: params.targetChapterId,
      feature: params.feature,
      bibleTarget: params.bibleTarget,
      subLabel: params.subLabel,
    };
    this.activeRunId = runId;
    this.runs.set(runId, record);
    return runId;
  }

  promotePendingRunStory(runId: string, resolvedStoryId: string): boolean {
    const existing = this.runs.get(runId);
    if (!existing) return false;
    existing.targetStoryId = resolvedStoryId;
    return true;
  }

  endRun(runId: string): boolean {
    const isCurrent = this.activeRunId === runId;
    if (isCurrent) {
      this.activeRunId = null;
    }
    this.runs.delete(runId);
    return isCurrent;
  }

  reset(): void {
    this.activeRunId = null;
    this.runs.clear();
  }
}

export function shouldAbortStreamOnConversationChange(params: {
  prevStoryId: string | null;
  nextStoryId: string | null;
  activeTargetStoryId?: string | null;
  isPromotingPendingStory?: boolean;
}): boolean {
  const { prevStoryId, nextStoryId, activeTargetStoryId, isPromotingPendingStory } = params;
  if (prevStoryId === nextStoryId) return false;
  if (
    prevStoryId === null &&
    nextStoryId !== null &&
    (isPromotingPendingStory || activeTargetStoryId === nextStoryId)
  ) {
    return false;
  }
  return true;
}
