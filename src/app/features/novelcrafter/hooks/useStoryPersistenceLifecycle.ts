// /app/features/novelcrafter/hooks/useStoryPersistenceLifecycle.ts
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { toast } from "@/lib/store/toastStore";
import { logger } from "@/lib/utils/logger";
import {
  enforceStatePayloadBudget,
  hasUnsavedDraftContent,
  LOCAL_DRAFT_THROTTLE_MS,
  markLocalDraftSynced,
  reconcileStoryStateWithDraft,
  writeLocalStoryDraft,
} from "@/lib/features/novelcrafter/draftStorage";
import {
  resolveSaveFailurePresentation,
  SERVER_SYNC_DEBOUNCE_MS,
  type NovelcrafterSyncCoordinator,
  type StorySaveStatus,
} from "@/lib/features/novelcrafter/storySyncCoordinator";
import type { StoryScopedState } from "@/lib/features/novelcrafter/streamTargetGuard";
import type { NovelcrafterStoryState } from "@/lib/features/novelcrafter/types";
import type { TranslationKey } from "@/lib/utils/translations";
import { fetchRemoteStoryState, putStoryStateOnServer } from "./useNovelcrafterCatalog";

const lifecycleLogger = logger.withContext("useStoryPersistenceLifecycle");
const FALLBACK_TRIM_PAYLOAD_BYTES = 1_500_000;

export interface DestructiveSavePromptState {
  storyId: string;
  previousChars: number;
  nextChars: number;
  pendingState: NovelcrafterStoryState;
}

interface UseStoryPersistenceLifecycleParams {
  isAuthed: boolean;
  validStoryId: string | null;
  coordinator: NovelcrafterSyncCoordinator;
  latestStateRef: MutableRefObject<StoryScopedState>;
  setStoryState: Dispatch<SetStateAction<NovelcrafterStoryState>>;
  setSaveStatus: Dispatch<SetStateAction<StorySaveStatus>>;
  ensureActiveStory: (seedState?: NovelcrafterStoryState) => Promise<string | null>;
  t: (key: TranslationKey) => string;
}

export function useStoryPersistenceLifecycle(params: UseStoryPersistenceLifecycleParams) {
  const {
    isAuthed,
    validStoryId,
    coordinator,
    latestStateRef,
    setStoryState,
    setSaveStatus,
    ensureActiveStory,
    t,
  } = params;

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftThrottleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyStoryIdsRef = useRef<Set<string>>(new Set());
  const quotaWarningShownRef = useRef(false);
  const [destructivePrompt, setDestructivePrompt] = useState<DestructiveSavePromptState | null>(
    null
  );

  const cancelPendingSaveTimers = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    saveTimerRef.current = null;
    retryTimerRef.current = null;
  }, []);

  const flushLocalDraftSync = useCallback(
    (targetStoryId: string | null, stateToWrite: NovelcrafterStoryState): boolean => {
      if (draftThrottleTimerRef.current) clearTimeout(draftThrottleTimerRef.current);
      draftThrottleTimerRef.current = null;
      const baseVersion = targetStoryId
        ? (coordinator.getServerMeta(targetStoryId)?.version ?? stateToWrite.version)
        : stateToWrite.version;
      const ok = writeLocalStoryDraft(targetStoryId, stateToWrite, { baseVersion, dirty: true });
      const quotaExceeded = !ok && typeof window !== "undefined";
      if (quotaExceeded && !quotaWarningShownRef.current) {
        quotaWarningShownRef.current = true;
        toast.info(t("novelcrafterLocalStorageQuotaWarning"));
      }
      return quotaExceeded;
    },
    [coordinator, t]
  );

  const executeCoordinatorSave = useCallback(
    async (
      storyId: string,
      stateToSave: NovelcrafterStoryState,
      options?: {
        epoch?: number;
        isManual?: boolean;
        isRetryAfterTrim?: boolean;
        allowDestructive?: boolean;
      }
    ): Promise<boolean> => {
      if (!isAuthed || !storyId) return false;
      if (latestStateRef.current.ownerStoryId === storyId) setSaveStatus("saving");
      const sendPut = (id: string, st: NovelcrafterStoryState) =>
        putStoryStateOnServer(id, st, t("novelcrafterSaveError"), {
          allowDestructive: options?.allowDestructive,
        });
      const outcome = await coordinator.enqueueSave(storyId, stateToSave, sendPut, {
        epoch: options?.epoch,
      });

      if (outcome.status === "saved") {
        setDestructivePrompt((prev) => (prev?.storyId === storyId ? null : prev));
        const syncedEnv = markLocalDraftSynced(
          storyId,
          outcome.version,
          outcome.ackedSnapshotUpdatedAt,
          outcome.updatedAt
        );
        if (!syncedEnv?.dirty) dirtyStoryIdsRef.current.delete(storyId);
        if (latestStateRef.current.ownerStoryId === storyId) {
          latestStateRef.current.state = {
            ...latestStateRef.current.state,
            version: outcome.version,
          };
          setSaveStatus(syncedEnv?.dirty ? "unsaved" : "saved");
        }
        return true;
      }

      if (outcome.status === "destructive_rejected") {
        if (latestStateRef.current.ownerStoryId === storyId) {
          setSaveStatus("error");
          setDestructivePrompt({
            storyId,
            previousChars: outcome.previousChars,
            nextChars: outcome.nextChars,
            pendingState: stateToSave,
          });
        }
        return false;
      }

      if (outcome.status === "rate_limited") {
        if (latestStateRef.current.ownerStoryId === storyId) {
          setSaveStatus("unsaved");
          if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null;
            if (latestStateRef.current.ownerStoryId === storyId) {
              void executeCoordinatorSave(storyId, latestStateRef.current.state, {
                epoch: coordinator.getEpoch(storyId),
              });
            }
          }, outcome.retryAfterMs);
        }
        return false;
      }

      const presentation = resolveSaveFailurePresentation(outcome, Boolean(options?.isManual));
      if (presentation.shouldTrimPayloadAndRetry && !options?.isRetryAfterTrim) {
        const trimmed = enforceStatePayloadBudget(stateToSave, FALLBACK_TRIM_PAYLOAD_BYTES);
        if (trimmed.fits && (trimmed.trimmedHistoryCount > 0 || trimmed.trimmedFeedbackCount > 0)) {
          if (latestStateRef.current.ownerStoryId === storyId) {
            latestStateRef.current = { ownerStoryId: storyId, state: trimmed.state };
            setStoryState(trimmed.state);
          }
          return executeCoordinatorSave(storyId, trimmed.state, {
            epoch: coordinator.getEpoch(storyId),
            isManual: options?.isManual,
            isRetryAfterTrim: true,
          });
        }
        toast.error(t("novelcrafterPayloadTooLargeError"));
      }

      if (outcome.status === "conflict" && presentation.shouldRunConflictRecovery) {
        cancelPendingSaveTimers();
        try {
          const recoveryResult = await coordinator.runConflictRecovery(storyId, async () => {
            const remoteState = await fetchRemoteStoryState(
              storyId,
              t("novelcrafterDefaultChapterTitle"),
              t("novelcrafterLoadError")
            );
            coordinator.seedServerMeta(storyId, {
              version: remoteState.version,
              updatedAt: remoteState.updatedAt,
            });
            const postReconcileEpoch = coordinator.bumpEpoch(storyId);
            cancelPendingSaveTimers();
            const candidateLocalState =
              latestStateRef.current.ownerStoryId === storyId
                ? latestStateRef.current.state
                : outcome.unsavedState;
            const reconciled = reconcileStoryStateWithDraft(remoteState, {
              baseVersion: 0,
              dirty: true,
              savedAt: Date.now(),
              state: candidateLocalState,
            });
            if (latestStateRef.current.ownerStoryId === storyId) {
              latestStateRef.current = { ownerStoryId: storyId, state: reconciled.state };
              setStoryState(reconciled.state);
            }
            writeLocalStoryDraft(storyId, reconciled.state, {
              baseVersion: remoteState.version,
              dirty: reconciled.shouldSyncDraftToServer,
            });
            return { ...reconciled, postReconcileEpoch };
          });
          if (recoveryResult.conflictDetected) toast.info(t("novelcrafterConflictBackupNotice"));
          if (recoveryResult.shouldSyncDraftToServer) {
            return await executeCoordinatorSave(storyId, recoveryResult.state, {
              epoch: recoveryResult.postReconcileEpoch,
              isManual: options?.isManual,
            });
          }
          dirtyStoryIdsRef.current.delete(storyId);
          if (latestStateRef.current.ownerStoryId === storyId) setSaveStatus("saved");
          return true;
        } catch (err: unknown) {
          lifecycleLogger.error("Conflict recovery failed:", err);
          if (latestStateRef.current.ownerStoryId === storyId) setSaveStatus("error");
          return false;
        }
      }

      if (latestStateRef.current.ownerStoryId === storyId) {
        setSaveStatus(presentation.nextSaveStatus);
      }
      if (presentation.shouldShowErrorToast && outcome.status !== "payload_too_large") {
        toast.error(t("novelcrafterSaveError"));
      }
      return false;
    },
    [
      isAuthed,
      latestStateRef,
      setSaveStatus,
      coordinator,
      setStoryState,
      cancelPendingSaveTimers,
      t,
    ]
  );

  const confirmDestructiveSave = useCallback(async () => {
    if (!destructivePrompt) return;
    const { storyId, pendingState } = destructivePrompt;
    setDestructivePrompt(null);
    await executeCoordinatorSave(storyId, pendingState, {
      epoch: coordinator.getEpoch(storyId),
      isManual: true,
      allowDestructive: true,
    });
  }, [destructivePrompt, executeCoordinatorSave, coordinator]);

  const reloadAfterDestructiveRejection = useCallback(async () => {
    if (!destructivePrompt) return;
    const { storyId } = destructivePrompt;
    setDestructivePrompt(null);
    try {
      const remoteState = await fetchRemoteStoryState(
        storyId,
        t("novelcrafterDefaultChapterTitle"),
        t("novelcrafterLoadError")
      );
      coordinator.seedServerMeta(storyId, {
        version: remoteState.version,
        updatedAt: remoteState.updatedAt,
      });
      coordinator.bumpEpoch(storyId);
      if (latestStateRef.current.ownerStoryId === storyId) {
        latestStateRef.current = { ownerStoryId: storyId, state: remoteState };
        setStoryState(remoteState);
        setSaveStatus("saved");
      }
      writeLocalStoryDraft(storyId, remoteState, {
        baseVersion: remoteState.version,
        dirty: false,
      });
    } catch (err: unknown) {
      lifecycleLogger.error("Failed to reload after destructive save rejection:", err);
      toast.error(t("novelcrafterLoadError"));
    }
  }, [destructivePrompt, t, coordinator, latestStateRef, setStoryState, setSaveStatus]);

  const scheduleSave = useCallback(
    (nextState: NovelcrafterStoryState, options?: { immediate?: boolean }) => {
      const ownerId = latestStateRef.current.ownerStoryId;
      if (draftThrottleTimerRef.current) clearTimeout(draftThrottleTimerRef.current);
      draftThrottleTimerRef.current = setTimeout(() => {
        draftThrottleTimerRef.current = null;
        const quotaExceeded = flushLocalDraftSync(
          latestStateRef.current.ownerStoryId,
          latestStateRef.current.state
        );
        if (quotaExceeded && latestStateRef.current.ownerStoryId) {
          cancelPendingSaveTimers();
          void executeCoordinatorSave(
            latestStateRef.current.ownerStoryId,
            latestStateRef.current.state,
            { epoch: coordinator.getEpoch(latestStateRef.current.ownerStoryId) }
          );
        }
      }, LOCAL_DRAFT_THROTTLE_MS);

      if (!ownerId) {
        if (isAuthed && hasUnsavedDraftContent(nextState)) {
          flushLocalDraftSync(null, nextState);
          void ensureActiveStory(nextState);
        }
        return;
      }
      dirtyStoryIdsRef.current.add(ownerId);
      setSaveStatus("unsaved");
      cancelPendingSaveTimers();
      if (options?.immediate) {
        flushLocalDraftSync(ownerId, nextState);
        void executeCoordinatorSave(ownerId, nextState, { epoch: coordinator.getEpoch(ownerId) });
        return;
      }
      const scheduledEpoch = coordinator.getEpoch(ownerId);
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        if (latestStateRef.current.ownerStoryId === ownerId) {
          flushLocalDraftSync(ownerId, latestStateRef.current.state);
          void executeCoordinatorSave(ownerId, latestStateRef.current.state, {
            epoch: scheduledEpoch,
          });
        }
      }, SERVER_SYNC_DEBOUNCE_MS);
    },
    [
      latestStateRef,
      isAuthed,
      flushLocalDraftSync,
      ensureActiveStory,
      setSaveStatus,
      cancelPendingSaveTimers,
      coordinator,
      executeCoordinatorSave,
    ]
  );

  const saveNow = useCallback(
    async (options?: { isManual?: boolean }) => {
      const isManual = options?.isManual ?? true;
      cancelPendingSaveTimers();
      const currentOwnerId = latestStateRef.current.ownerStoryId;
      const currentState = latestStateRef.current.state;
      flushLocalDraftSync(currentOwnerId, currentState);
      const targetStoryId =
        currentOwnerId || validStoryId || (await ensureActiveStory(currentState));
      if (!targetStoryId) return;
      if (isManual) coordinator.resetConsecutiveRecoveries(targetStoryId);
      await executeCoordinatorSave(targetStoryId, latestStateRef.current.state, {
        epoch: coordinator.getEpoch(targetStoryId),
        isManual,
      });
    },
    [
      cancelPendingSaveTimers,
      latestStateRef,
      flushLocalDraftSync,
      validStoryId,
      ensureActiveStory,
      coordinator,
      executeCoordinatorSave,
    ]
  );

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "hidden") return;
      const ownerId = latestStateRef.current.ownerStoryId;
      const currentState = latestStateRef.current.state;
      flushLocalDraftSync(ownerId, currentState);
      if (ownerId && dirtyStoryIdsRef.current.has(ownerId)) {
        cancelPendingSaveTimers();
        void executeCoordinatorSave(ownerId, currentState, {
          epoch: coordinator.getEpoch(ownerId),
        });
      }
    };
    const handlePageHide = () =>
      flushLocalDraftSync(latestStateRef.current.ownerStoryId, latestStateRef.current.state);
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveNow({ isManual: true });
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    latestStateRef,
    flushLocalDraftSync,
    cancelPendingSaveTimers,
    coordinator,
    executeCoordinatorSave,
    saveNow,
  ]);

  return {
    scheduleSave,
    saveNow,
    executeCoordinatorSave,
    cancelPendingSaveTimers,
    flushLocalDraftSync,
    dirtyStoryIdsRef,
    destructivePrompt,
    confirmDestructiveSave,
    reloadAfterDestructiveRejection,
  };
}
