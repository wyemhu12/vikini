// /lib/features/novelcrafter/storySyncCoordinator.ts
// Pure per-story single-flight save coordinator, conflict recovery lock, and story creation handoff

import { STALE_STORY_STATE_MESSAGE, type NovelcrafterStoryState } from "./types";

export const SERVER_SYNC_DEBOUNCE_MS = 3000 as const;
export const MAX_CONSECUTIVE_CONFLICT_RECOVERIES = 2 as const;

export type StorySaveStatus = "saved" | "saving" | "unsaved" | "error";

export type SaveTransportResult =
  | { status: "saved"; savedState: NovelcrafterStoryState }
  | { status: "rate_limited"; retryAfterSeconds: number }
  | { status: "conflict" }
  | { status: "destructive_rejected"; previousChars: number; nextChars: number }
  | { status: "payload_too_large" }
  | { status: "error"; message: string };

export type SaveExecutionOutcome =
  | { status: "saved"; version: number; updatedAt: number; ackedSnapshotUpdatedAt: number }
  | { status: "rate_limited"; retryAfterMs: number }
  | {
      status: "conflict";
      unsavedState: NovelcrafterStoryState;
      newEpoch: number;
      canAutoRecover: boolean;
    }
  | {
      status: "destructive_rejected";
      previousChars: number;
      nextChars: number;
      unsavedState: NovelcrafterStoryState;
    }
  | { status: "superseded" }
  | { status: "payload_too_large" }
  | { status: "error"; message: string };

export interface ServerStoryMeta {
  version: number;
  updatedAt: number;
}

interface QueuedSaveEntry {
  state: NovelcrafterStoryState;
  epoch: number;
}

export function isStaleStoryStateErrorResponse(status: number, body: unknown): boolean {
  if ((status !== 400 && status !== 409) || !body || typeof body !== "object") return false;
  const record = body as Record<string, unknown>;
  const nestedError =
    record.error && typeof record.error === "object"
      ? (record.error as Record<string, unknown>)
      : null;
  const code =
    typeof nestedError?.code === "string"
      ? nestedError.code
      : typeof record.code === "string"
        ? record.code
        : "";
  if (code === "STALE_STORY_STATE") return true;
  const message =
    typeof nestedError?.message === "string"
      ? nestedError.message
      : typeof record.message === "string"
        ? record.message
        : "";
  return message.includes(STALE_STORY_STATE_MESSAGE);
}

export function extractDestructiveSaveRejection(
  status: number,
  body: unknown
): { previousChars: number; nextChars: number } | null {
  if (status !== 409 || !body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const nestedError =
    record.error && typeof record.error === "object"
      ? (record.error as Record<string, unknown>)
      : null;
  const code =
    typeof nestedError?.code === "string"
      ? nestedError.code
      : typeof record.code === "string"
        ? record.code
        : "";
  if (code !== "DESTRUCTIVE_SAVE_REJECTED") return null;
  const prev =
    typeof record.previousChars === "number"
      ? record.previousChars
      : typeof nestedError?.previousChars === "number"
        ? nestedError.previousChars
        : 0;
  const next =
    typeof record.nextChars === "number"
      ? record.nextChars
      : typeof nestedError?.nextChars === "number"
        ? nestedError.nextChars
        : 0;
  return { previousChars: prev, nextChars: next };
}

export class NovelcrafterSyncCoordinator {
  private readonly metaByStory = new Map<string, ServerStoryMeta>();
  private readonly inFlightByStory = new Map<string, Promise<SaveExecutionOutcome>>();
  private readonly queuedByStory = new Map<string, QueuedSaveEntry>();
  private readonly epochByStory = new Map<string, number>();
  private readonly recoveringByStory = new Map<string, Promise<unknown>>();
  private readonly consecutiveRecoveriesByStory = new Map<string, number>();
  private readonly skipInitialGetIds = new Set<string>();

  private creatingStoryPromise: Promise<string | null> | null = null;
  private creatingStoryInFlight = false;
  private knownStoryIdsAtCreateStart = new Set<string>();

  seedServerMeta(storyId: string, meta: ServerStoryMeta): void {
    const existing = this.metaByStory.get(storyId);
    if (!existing) {
      this.metaByStory.set(storyId, {
        version: Math.max(1, meta.version),
        updatedAt: Math.max(0, meta.updatedAt),
      });
      return;
    }
    this.metaByStory.set(storyId, {
      version: Math.max(existing.version, meta.version),
      updatedAt: Math.max(existing.updatedAt, meta.updatedAt),
    });
  }

  getServerMeta(storyId: string): ServerStoryMeta | undefined {
    const meta = this.metaByStory.get(storyId);
    return meta ? { ...meta } : undefined;
  }

  getConfirmedVersion(storyId: string): number {
    return this.metaByStory.get(storyId)?.version ?? 1;
  }

  advanceConfirmedVersion(storyId: string, version: number, updatedAt = Date.now()): void {
    this.seedServerMeta(storyId, { version, updatedAt });
  }

  getEpoch(storyId: string): number {
    return this.epochByStory.get(storyId) ?? 0;
  }

  bumpEpoch(storyId: string): number {
    const next = this.getEpoch(storyId) + 1;
    this.epochByStory.set(storyId, next);
    this.queuedByStory.delete(storyId);
    return next;
  }

  resetConsecutiveRecoveries(storyId: string): void {
    this.consecutiveRecoveriesByStory.set(storyId, 0);
  }

  isRecovering(storyId: string): boolean {
    return this.recoveringByStory.has(storyId);
  }

  async runConflictRecovery<T>(storyId: string, recoveryStepFn: () => Promise<T>): Promise<T> {
    const existing = this.recoveringByStory.get(storyId);
    if (existing) return existing as Promise<T>;
    const promise = (async () => {
      try {
        return await recoveryStepFn();
      } finally {
        this.recoveringByStory.delete(storyId);
      }
    })();
    this.recoveringByStory.set(storyId, promise);
    return promise;
  }

  hasInFlightSave(storyId: string): boolean {
    return this.inFlightByStory.has(storyId);
  }

  isCreatingStory(): boolean {
    return this.creatingStoryInFlight;
  }

  isCandidateNewStoryId(storyId: string): boolean {
    if (!storyId || !this.creatingStoryInFlight) return false;
    return !this.knownStoryIdsAtCreateStart.has(storyId);
  }

  markSkipInitialGet(storyId: string): void {
    if (storyId) this.skipInitialGetIds.add(storyId);
  }

  consumeSkipInitialGet(storyId: string): boolean {
    if (!storyId || !this.skipInitialGetIds.has(storyId)) return false;
    this.skipInitialGetIds.delete(storyId);
    return true;
  }

  async ensureStory(
    knownStoryIds: Iterable<string>,
    createFn: () => Promise<string | null>
  ): Promise<string | null> {
    if (this.creatingStoryPromise) return this.creatingStoryPromise;
    this.knownStoryIdsAtCreateStart = new Set(knownStoryIds);
    this.creatingStoryInFlight = true;
    const promise = (async () => {
      try {
        return await createFn();
      } finally {
        this.creatingStoryInFlight = false;
        this.creatingStoryPromise = null;
        this.knownStoryIdsAtCreateStart.clear();
      }
    })();
    this.creatingStoryPromise = promise;
    return promise;
  }

  private stampStateForPut(storyId: string, state: NovelcrafterStoryState): NovelcrafterStoryState {
    const meta = this.metaByStory.get(storyId);
    if (!meta) return state;
    return {
      ...state,
      version: Math.max(state.version, meta.version),
      updatedAt: Math.max(state.updatedAt, meta.updatedAt + 1),
    };
  }

  async enqueueSave(
    storyId: string,
    state: NovelcrafterStoryState,
    sendPut: (
      storyId: string,
      preparedState: NovelcrafterStoryState
    ) => Promise<SaveTransportResult>,
    options?: { epoch?: number }
  ): Promise<SaveExecutionOutcome> {
    const currentEpoch = this.getEpoch(storyId);
    const callerEpoch = options?.epoch ?? currentEpoch;

    if (this.isRecovering(storyId) || callerEpoch !== currentEpoch) {
      return { status: "superseded" };
    }

    const existingInFlight = this.inFlightByStory.get(storyId);
    if (existingInFlight) {
      this.queuedByStory.set(storyId, { state, epoch: callerEpoch });
      return existingInFlight;
    }

    const runQueue = async (
      initialState: NovelcrafterStoryState,
      initialEpoch: number
    ): Promise<SaveExecutionOutcome> => {
      let currentCandidate = initialState;
      let candidateEpoch = initialEpoch;
      let lastOutcome: SaveExecutionOutcome = { status: "superseded" };

      while (true) {
        if (this.isRecovering(storyId) || candidateEpoch !== this.getEpoch(storyId)) {
          this.queuedByStory.delete(storyId);
          return { status: "superseded" };
        }

        const ackedSnapshotUpdatedAt = currentCandidate.updatedAt;
        const prepared = this.stampStateForPut(storyId, currentCandidate);
        const transportResult = await sendPut(storyId, prepared);

        if (transportResult.status === "saved") {
          const { version, updatedAt } = transportResult.savedState;
          this.seedServerMeta(storyId, { version, updatedAt });
          this.consecutiveRecoveriesByStory.set(storyId, 0);
          lastOutcome = { status: "saved", version, updatedAt, ackedSnapshotUpdatedAt };
        } else if (transportResult.status === "rate_limited") {
          this.queuedByStory.delete(storyId);
          return {
            status: "rate_limited",
            retryAfterMs: Math.max(1000, transportResult.retryAfterSeconds * 1000),
          };
        } else if (transportResult.status === "conflict") {
          const latestQueued = this.queuedByStory.get(storyId);
          const unsavedState = latestQueued ? latestQueued.state : currentCandidate;
          const nextCount = (this.consecutiveRecoveriesByStory.get(storyId) ?? 0) + 1;
          this.consecutiveRecoveriesByStory.set(storyId, nextCount);
          const newEpoch = this.bumpEpoch(storyId);
          return {
            status: "conflict",
            unsavedState,
            newEpoch,
            canAutoRecover: nextCount <= MAX_CONSECUTIVE_CONFLICT_RECOVERIES,
          };
        } else if (transportResult.status === "destructive_rejected") {
          const latestQueued = this.queuedByStory.get(storyId);
          const unsavedState = latestQueued ? latestQueued.state : currentCandidate;
          this.queuedByStory.delete(storyId);
          return {
            status: "destructive_rejected",
            previousChars: transportResult.previousChars,
            nextChars: transportResult.nextChars,
            unsavedState,
          };
        } else if (transportResult.status === "payload_too_large") {
          this.queuedByStory.delete(storyId);
          return { status: "payload_too_large" };
        } else {
          this.queuedByStory.delete(storyId);
          return { status: "error", message: transportResult.message };
        }

        const nextQueued = this.queuedByStory.get(storyId);
        if (!nextQueued) return lastOutcome;
        this.queuedByStory.delete(storyId);
        currentCandidate = nextQueued.state;
        candidateEpoch = nextQueued.epoch;
      }
    };

    const flightPromise = (async () => {
      try {
        return await runQueue(state, callerEpoch);
      } finally {
        this.inFlightByStory.delete(storyId);
      }
    })();

    this.inFlightByStory.set(storyId, flightPromise);
    return flightPromise;
  }
}

export function shouldApplyRemoteStoryLoad(params: {
  storyId: string;
  coordinator: NovelcrafterSyncCoordinator;
  currentOwnerStoryId: string | null;
}): { shouldFetch: boolean; shouldPromoteUnsaved: boolean } {
  const { storyId, coordinator, currentOwnerStoryId } = params;
  if (coordinator.consumeSkipInitialGet(storyId)) {
    return { shouldFetch: false, shouldPromoteUnsaved: false };
  }
  if (currentOwnerStoryId === null && coordinator.isCandidateNewStoryId(storyId)) {
    return { shouldFetch: false, shouldPromoteUnsaved: true };
  }
  return { shouldFetch: true, shouldPromoteUnsaved: false };
}

export function resolveSaveFailurePresentation(
  outcome: SaveExecutionOutcome,
  isManual: boolean
): {
  nextSaveStatus: StorySaveStatus;
  shouldShowErrorToast: boolean;
  shouldTrimPayloadAndRetry: boolean;
  shouldRunConflictRecovery: boolean;
} {
  if (outcome.status === "saved") {
    return {
      nextSaveStatus: "saved",
      shouldShowErrorToast: false,
      shouldTrimPayloadAndRetry: false,
      shouldRunConflictRecovery: false,
    };
  }
  if (outcome.status === "superseded" || outcome.status === "rate_limited") {
    return {
      nextSaveStatus: "unsaved",
      shouldShowErrorToast: false,
      shouldTrimPayloadAndRetry: false,
      shouldRunConflictRecovery: false,
    };
  }
  if (outcome.status === "conflict") {
    return {
      nextSaveStatus: outcome.canAutoRecover ? "saving" : "error",
      shouldShowErrorToast: !outcome.canAutoRecover && isManual,
      shouldTrimPayloadAndRetry: false,
      shouldRunConflictRecovery: outcome.canAutoRecover,
    };
  }
  if (outcome.status === "destructive_rejected") {
    return {
      nextSaveStatus: "unsaved",
      shouldShowErrorToast: false,
      shouldTrimPayloadAndRetry: false,
      shouldRunConflictRecovery: false,
    };
  }
  if (outcome.status === "payload_too_large") {
    return {
      nextSaveStatus: "error",
      shouldShowErrorToast: isManual,
      shouldTrimPayloadAndRetry: true,
      shouldRunConflictRecovery: false,
    };
  }
  return {
    nextSaveStatus: "error",
    shouldShowErrorToast: isManual,
    shouldTrimPayloadAndRetry: false,
    shouldRunConflictRecovery: false,
  };
}
