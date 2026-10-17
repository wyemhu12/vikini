// /app/features/novelcrafter/hooks/useNovelcrafterCatalog.ts
"use client";

import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { useGemStore } from "../../gems/stores/useGemStore";
import { usePersonaStore } from "../../personas/stores/usePersonaStore";
import { MODEL_IDS } from "@/lib/utils/constants";
import { logger } from "@/lib/utils/logger";
import {
  DEFAULT_MAX_STATE_PAYLOAD_BYTES,
  enforceStatePayloadBudget,
  promoteUnsavedDraftToStory,
  readLocalStoryDraft,
  reconcileStoryStateWithDraft,
  writeLocalStoryDraft,
} from "@/lib/features/novelcrafter/draftStorage";
import { sanitizeStoryState } from "@/lib/features/novelcrafter/promptBuilder";
import {
  extractDestructiveSaveRejection,
  isStaleStoryStateErrorResponse,
  type NovelcrafterSyncCoordinator,
  type SaveTransportResult,
} from "@/lib/features/novelcrafter/storySyncCoordinator";
import type { StoryScopedState } from "@/lib/features/novelcrafter/streamTargetGuard";
import type { NovelcrafterStoryState } from "@/lib/features/novelcrafter/types";

const catalogLogger = logger.withContext("useNovelcrafterCatalog");

export interface ClientGemItem {
  id: string;
  name: string;
  description?: string;
  icon?: string | null;
  color?: string | null;
}

export interface ClientPersonaItem {
  id: string;
  name: string;
  description?: string;
  tone?: string;
  icon?: string | null;
  color?: string | null;
}

export class StoryLoadError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "StoryLoadError";
    this.status = status;
    this.code = code;
  }
}

export async function fetchRemoteStoryState(
  conversationId: string,
  defaultChapterTitle: string,
  loadErrorMsg: string
): Promise<NovelcrafterStoryState> {
  const res = await fetch(
    `/api/novelcrafter/state?conversationId=${encodeURIComponent(conversationId)}`
  );
  if (!res.ok) {
    const errJson = (await res.json().catch(() => ({}))) as {
      error?: { message?: string; code?: string };
      code?: string;
    };
    const errCode = errJson.error?.code || errJson.code;
    throw new StoryLoadError(loadErrorMsg, res.status, errCode);
  }
  const json = (await res.json()) as { data?: { state?: unknown }; state?: unknown };
  return sanitizeStoryState(json.data?.state ?? json.state, defaultChapterTitle);
}

export async function loadAndReconcileStoryState(params: {
  convId: string;
  defaultChapterTitle: string;
  loadErrorMsg: string;
  coordinator: NovelcrafterSyncCoordinator;
}) {
  const remoteState = await fetchRemoteStoryState(
    params.convId,
    params.defaultChapterTitle,
    params.loadErrorMsg
  );
  params.coordinator.seedServerMeta(params.convId, {
    version: remoteState.version,
    updatedAt: remoteState.updatedAt,
  });
  const localEnvelope = readLocalStoryDraft(params.convId, params.defaultChapterTitle);
  const reconciled = reconcileStoryStateWithDraft(remoteState, localEnvelope);
  writeLocalStoryDraft(params.convId, reconciled.state, {
    baseVersion: remoteState.version,
    dirty: reconciled.shouldSyncDraftToServer,
  });
  return reconciled;
}

export async function spawnAndBindStoryConversation(params: {
  knownStoryIds: string[];
  stateToSeed: NovelcrafterStoryState;
  promoteUnsaved: boolean;
  defaultStoryTitle: string;
  coordinator: NovelcrafterSyncCoordinator;
  latestStateRef: MutableRefObject<StoryScopedState>;
  setStoryState: Dispatch<SetStateAction<NovelcrafterStoryState>>;
  createConversation: (opts: {
    title: string;
    model: string;
    projectId: null;
    onBeforeActivate: (newId: string) => void;
  }) => Promise<{ id?: string } | null>;
}): Promise<string | null> {
  const {
    knownStoryIds,
    stateToSeed,
    promoteUnsaved,
    defaultStoryTitle,
    coordinator,
    latestStateRef,
    setStoryState,
    createConversation,
  } = params;
  return coordinator.ensureStory(knownStoryIds, async () => {
    const bindState = (newStoryId: string) => {
      if (promoteUnsaved) {
        const promoted = promoteUnsavedDraftToStory(newStoryId, stateToSeed, coordinator, {
          markSkipNextGet: true,
        });
        latestStateRef.current = { ownerStoryId: newStoryId, state: promoted };
        setStoryState(promoted);
      } else {
        coordinator.seedServerMeta(newStoryId, { version: 1, updatedAt: 0 });
        coordinator.markSkipInitialGet(newStoryId);
        latestStateRef.current = { ownerStoryId: newStoryId, state: stateToSeed };
        setStoryState(stateToSeed);
      }
    };
    const created = await createConversation({
      title: defaultStoryTitle,
      model: MODEL_IDS.NOVELCRAFTER,
      projectId: null,
      onBeforeActivate: bindState,
    });
    if (!created?.id) return null;
    if (latestStateRef.current.ownerStoryId !== created.id) bindState(created.id);
    return created.id;
  });
}

export async function putStoryStateOnServer(
  storyId: string,
  preparedState: NovelcrafterStoryState,
  fallbackErrorMsg: string,
  options?: { allowDestructive?: boolean }
): Promise<SaveTransportResult> {
  const budgeted = enforceStatePayloadBudget(preparedState, DEFAULT_MAX_STATE_PAYLOAD_BYTES);
  if (!budgeted.fits) return { status: "payload_too_large" };

  try {
    const res = await fetch("/api/novelcrafter/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId: storyId,
        state: budgeted.state,
        ...(options?.allowDestructive ? { allowDestructive: true } : {}),
      }),
    });
    if (res.status === 429) {
      const retryHeader = Number(res.headers.get("Retry-After") || "3");
      const bodyJson = (await res.json().catch(() => ({}))) as {
        error?: { retryAfterSeconds?: number };
      };
      const retryAfterSeconds =
        bodyJson.error?.retryAfterSeconds || (Number.isFinite(retryHeader) ? retryHeader : 3);
      return { status: "rate_limited", retryAfterSeconds };
    }
    if (res.status === 413) return { status: "payload_too_large" };

    const json = (await res.json().catch(() => ({}))) as {
      data?: { state?: NovelcrafterStoryState };
      state?: NovelcrafterStoryState;
      error?: { message?: string; code?: string };
      code?: string;
      previousChars?: number;
      nextChars?: number;
    };
    if (!res.ok) {
      const destructiveRej = extractDestructiveSaveRejection(res.status, json);
      if (destructiveRej) {
        return {
          status: "destructive_rejected",
          previousChars: destructiveRej.previousChars,
          nextChars: destructiveRej.nextChars,
        };
      }
      if (isStaleStoryStateErrorResponse(res.status, json)) return { status: "conflict" };
      return { status: "error", message: json.error?.message || fallbackErrorMsg };
    }
    return { status: "saved", savedState: json.data?.state || json.state || budgeted.state };
  } catch (err: unknown) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : fallbackErrorMsg,
    };
  }
}

export function useNovelcrafterCatalog(isAuthed: boolean) {
  const isGemModalOpen = useGemStore((s) => s.isOpen);
  const isPersonaModalOpen = usePersonaStore((s) => s.isOpen);

  const [gems, setGems] = useState<ClientGemItem[]>([]);
  const [personas, setPersonas] = useState<ClientPersonaItem[]>([]);

  const refreshCatalog = useCallback(async () => {
    if (!isAuthed) return;
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const [gemsRes, personasRes] = await Promise.all([
          fetch("/api/gems"),
          fetch("/api/personas"),
        ]);
        if (gemsRes.ok) {
          const gJson = (await gemsRes.json()) as {
            data?: { gems?: ClientGemItem[] };
            gems?: ClientGemItem[];
          };
          setGems(gJson.data?.gems || gJson.gems || []);
        }
        if (personasRes.ok) {
          const pJson = (await personasRes.json()) as {
            data?: { personas?: ClientPersonaItem[] };
            personas?: ClientPersonaItem[];
          };
          setPersonas(pJson.data?.personas || pJson.personas || []);
        }
        if (gemsRes.ok && personasRes.ok) return;
      } catch (err: unknown) {
        catalogLogger.warn(`Failed to fetch gems/personas (attempt ${attempt}):`, err);
      }
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, attempt * 600));
      }
    }
  }, [isAuthed]);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog, isGemModalOpen, isPersonaModalOpen]);

  return {
    gems,
    personas,
    refreshCatalog,
  };
}
