// /app/features/novelcrafter/hooks/useNovelcrafterStory.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConversation, type FrontendConversation } from "../../chat/hooks/useConversation";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { useGemStore } from "../../gems/stores/useGemStore";
import { usePersonaStore } from "../../personas/stores/usePersonaStore";
import { MODEL_IDS } from "@/lib/utils/constants";
import { confirm } from "@/lib/store/confirmStore";
import { toast } from "@/lib/store/toastStore";
import { logger } from "@/lib/utils/logger";
import {
  createDefaultStoryState,
  MAX_CHAPTERS,
  MAX_HISTORY_CARDS,
  type NovelcrafterChapter,
  type NovelcrafterFeatureSlot,
  type NovelcrafterHistoryCard,
  type NovelcrafterRoutingConfig,
  type NovelcrafterStoryState,
  type StoryBible,
} from "@/lib/features/novelcrafter/types";
import { sanitizeStoryState } from "@/lib/features/novelcrafter/promptBuilder";

const storyLogger = logger.withContext("useNovelcrafterStory");

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

export type StorySaveStatus = "saved" | "saving" | "unsaved";

export function useNovelcrafterStory(isAuthed: boolean) {
  const { t } = useLanguage();
  const isGemModalOpen = useGemStore((s) => s.isOpen);
  const isPersonaModalOpen = usePersonaStore((s) => s.isOpen);

  const {
    conversations,
    selectedConversationId,
    setSelectedConversationId,
    createConversation,
    deleteConversation,
    renameConversation,
    creatingConversation,
  } = useConversation();

  const stories = useMemo(() => {
    return (conversations || []).filter(
      (c: FrontendConversation) => c.model === MODEL_IDS.NOVELCRAFTER
    );
  }, [conversations]);

  const currentStory = useMemo(() => {
    return stories.find((s) => s.id === selectedConversationId) || null;
  }, [stories, selectedConversationId]);

  const [storyState, setStoryState] = useState<NovelcrafterStoryState>(() =>
    createDefaultStoryState(t("novelcrafterDefaultChapterTitle"))
  );
  const [isLoadingState, setIsLoadingState] = useState(false);
  const [saveStatus, setSaveStatus] = useState<StorySaveStatus>("saved");
  const [gems, setGems] = useState<ClientGemItem[]>([]);
  const [personas, setPersonas] = useState<ClientPersonaItem[]>([]);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSavePayloadRef = useRef<{
    conversationId: string;
    state: NovelcrafterStoryState;
  } | null>(null);
  const activeConversationIdRef = useRef<string | null>(selectedConversationId);

  useEffect(() => {
    activeConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  // Auto-select most recent story if none selected
  useEffect(() => {
    if (!selectedConversationId && stories.length > 0) {
      setSelectedConversationId(stories[0].id);
    } else if (
      selectedConversationId &&
      stories.length > 0 &&
      !stories.some((s) => s.id === selectedConversationId)
    ) {
      setSelectedConversationId(stories[0].id);
    }
  }, [selectedConversationId, stories, setSelectedConversationId]);

  // Load GEMs and Personas for Routing Modal & TopBar badges
  const fetchGemsAndPersonas = useCallback(async () => {
    if (!isAuthed) return;
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
    } catch (err: unknown) {
      storyLogger.warn("Failed to fetch gems/personas:", err);
    }
  }, [isAuthed]);

  useEffect(() => {
    void fetchGemsAndPersonas();
  }, [fetchGemsAndPersonas, isGemModalOpen, isPersonaModalOpen]);

  const persistStateToServer = useCallback(
    async (targetConversationId: string, stateToSave: NovelcrafterStoryState) => {
      try {
        if (activeConversationIdRef.current === targetConversationId) {
          setSaveStatus("saving");
        }
        const res = await fetch("/api/novelcrafter/state", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: targetConversationId,
            state: stateToSave,
          }),
        });

        if (!res.ok) {
          const errJson = (await res.json().catch(() => ({}))) as {
            error?: { message?: string };
          };
          throw new Error(errJson.error?.message || t("novelcrafterSaveError"));
        }

        const json = (await res.json()) as {
          data?: { state?: NovelcrafterStoryState };
        };
        if (activeConversationIdRef.current === targetConversationId) {
          if (json.data?.state) {
            setStoryState((prev) => ({
              ...prev,
              version: json.data!.state!.version,
              updatedAt: json.data!.state!.updatedAt,
            }));
          }
          setSaveStatus("saved");
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : t("novelcrafterSaveError");
        storyLogger.error("Failed to save story state:", msg);
        if (activeConversationIdRef.current === targetConversationId) {
          setSaveStatus("unsaved");
        }
        toast.error(t("novelcrafterSaveError"));
      }
    },
    [t]
  );

  const flushPendingSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const pending = pendingSavePayloadRef.current;
    if (pending) {
      pendingSavePayloadRef.current = null;
      void persistStateToServer(pending.conversationId, pending.state);
    }
  }, [persistStateToServer]);

  // Load story state when selectedConversationId changes
  useEffect(() => {
    flushPendingSave();

    if (!isAuthed || !selectedConversationId) {
      setStoryState(createDefaultStoryState(t("novelcrafterDefaultChapterTitle")));
      setSaveStatus("saved");
      return;
    }

    const isNovelcrafterConvo = stories.some((s) => s.id === selectedConversationId);
    if (!isNovelcrafterConvo && stories.length > 0) {
      return;
    }

    let cancelled = false;
    setIsLoadingState(true);

    async function loadState(convId: string) {
      try {
        const res = await fetch(
          `/api/novelcrafter/state?conversationId=${encodeURIComponent(convId)}`
        );
        if (!res.ok) {
          throw new Error(t("novelcrafterLoadError"));
        }
        const json = (await res.json()) as {
          data?: { state?: unknown };
        };
        if (cancelled) return;
        const loaded = sanitizeStoryState(json.data?.state, t("novelcrafterDefaultChapterTitle"));
        setStoryState(loaded);
        setSaveStatus("saved");
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : t("novelcrafterLoadError");
          storyLogger.error("Failed to load story state:", msg);
          toast.error(t("novelcrafterLoadError"));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingState(false);
        }
      }
    }

    void loadState(selectedConversationId);

    return () => {
      cancelled = true;
    };
  }, [isAuthed, selectedConversationId, stories, flushPendingSave, t]);

  useEffect(() => {
    return () => {
      flushPendingSave();
    };
  }, [flushPendingSave]);

  const scheduleSave = useCallback(
    (updater: (prev: NovelcrafterStoryState) => NovelcrafterStoryState, immediate = false) => {
      setStoryState((prev) => {
        const now = Date.now();
        const next: NovelcrafterStoryState = {
          ...updater(prev),
          updatedAt: Math.max(now, prev.updatedAt + 1),
        };
        const targetId = activeConversationIdRef.current;
        if (targetId) {
          if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
          }
          if (immediate) {
            pendingSavePayloadRef.current = null;
            void persistStateToServer(targetId, next);
          } else {
            setSaveStatus("unsaved");
            pendingSavePayloadRef.current = { conversationId: targetId, state: next };
            saveTimerRef.current = setTimeout(() => {
              const payload = pendingSavePayloadRef.current;
              pendingSavePayloadRef.current = null;
              saveTimerRef.current = null;
              if (payload) {
                void persistStateToServer(payload.conversationId, payload.state);
              }
            }, 900);
          }
        }
        return next;
      });
    },
    [persistStateToServer]
  );

  const handleCreateStory = useCallback(async (): Promise<string | null> => {
    try {
      flushPendingSave();
      const created = await createConversation({
        title: t("novelcrafterDefaultStoryTitle"),
        model: MODEL_IDS.NOVELCRAFTER,
      });
      if (!created?.id) {
        throw new Error(t("novelcrafterCreateStoryError"));
      }
      const initialState = createDefaultStoryState(t("novelcrafterDefaultChapterTitle"));
      activeConversationIdRef.current = created.id;
      setSelectedConversationId(created.id);
      setStoryState(initialState);
      await persistStateToServer(created.id, initialState);
      return created.id;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("novelcrafterCreateStoryError");
      storyLogger.error("handleCreateStory failed:", msg);
      toast.error(t("novelcrafterCreateStoryError"));
      return null;
    }
  }, [flushPendingSave, createConversation, t, setSelectedConversationId, persistStateToServer]);

  const handleDeleteStory = useCallback(
    async (storyId: string) => {
      const confirmed = await confirm({
        title: t("novelcrafterDeleteStoryConfirmTitle"),
        description: t("novelcrafterDeleteStoryConfirmDesc"),
        variant: "danger",
      });
      if (!confirmed) return;

      try {
        await deleteConversation(storyId);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : t("deleteFailed");
        storyLogger.error("handleDeleteStory failed:", msg);
        toast.error(t("deleteFailed"));
      }
    },
    [t, deleteConversation]
  );

  const handleRenameStory = useCallback(
    async (storyId: string, newTitle: string) => {
      const trimmed = newTitle.trim();
      if (!trimmed) return;
      try {
        await renameConversation(storyId, trimmed);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : t("renameChatFailed");
        storyLogger.error("handleRenameStory failed:", msg);
        toast.error(t("renameChatFailed"));
      }
    },
    [renameConversation, t]
  );

  const updateStoryBible = useCallback(
    (patch: Partial<StoryBible>) => {
      scheduleSave((prev) => ({
        ...prev,
        storyBible: { ...prev.storyBible, ...patch },
      }));
    },
    [scheduleSave]
  );

  const updateRouting = useCallback(
    (patch: Partial<NovelcrafterRoutingConfig>) => {
      scheduleSave(
        (prev) => ({
          ...prev,
          routing: {
            ...prev.routing,
            ...patch,
            featurePersonas: {
              ...prev.routing.featurePersonas,
              ...(patch.featurePersonas || {}),
            },
          },
        }),
        true
      );
    },
    [scheduleSave]
  );

  const updateFeaturePersonaSlot = useCallback(
    (slot: NovelcrafterFeatureSlot, value: string) => {
      scheduleSave(
        (prev) => ({
          ...prev,
          routing: {
            ...prev.routing,
            featurePersonas: {
              ...prev.routing.featurePersonas,
              [slot]: value,
            },
          },
        }),
        true
      );
    },
    [scheduleSave]
  );

  const setSelectedModel = useCallback(
    (modelId: string) => {
      scheduleSave((prev) => ({ ...prev, selectedModel: modelId }), true);
    },
    [scheduleSave]
  );

  const setStoryBibleOpen = useCallback(
    (isOpen: boolean) => {
      scheduleSave((prev) => ({ ...prev, isStoryBibleOpen: isOpen }));
    },
    [scheduleSave]
  );

  const selectChapter = useCallback(
    (chapterId: string) => {
      scheduleSave((prev) => ({
        ...prev,
        isStoryBibleOpen: false,
        activeChapterId: chapterId,
      }));
    },
    [scheduleSave]
  );

  const addChapter = useCallback(() => {
    scheduleSave((prev) => {
      if (prev.chapters.length >= MAX_CHAPTERS) return prev;
      const nextIndex = prev.chapters.length + 1;
      const newChapter: NovelcrafterChapter = {
        id: `ch-${Date.now()}-${nextIndex}`,
        title: `${t("novelcrafterChaptersTab")} ${nextIndex}`,
        scenes: "",
        content: "",
        updatedAt: Date.now(),
      };
      return {
        ...prev,
        isStoryBibleOpen: false,
        activeChapterId: newChapter.id,
        chapters: [...prev.chapters, newChapter],
      };
    }, true);
  }, [scheduleSave, t]);

  const updateChapter = useCallback(
    (
      chapterId: string,
      patch: Partial<Pick<NovelcrafterChapter, "title" | "scenes" | "content">>
    ) => {
      scheduleSave((prev) => ({
        ...prev,
        chapters: prev.chapters.map((ch) =>
          ch.id === chapterId ? { ...ch, ...patch, updatedAt: Date.now() } : ch
        ),
      }));
    },
    [scheduleSave]
  );

  const deleteChapter = useCallback(
    async (chapterId: string) => {
      if (storyState.chapters.length <= 1) {
        toast.info(t("novelcrafterMinOneChapterToast"));
        return;
      }
      const confirmed = await confirm({
        title: t("novelcrafterDeleteChapterConfirmTitle"),
        description: t("novelcrafterDeleteChapterConfirmDesc"),
        variant: "danger",
      });
      if (!confirmed) return;

      scheduleSave((prev) => {
        if (prev.chapters.length <= 1) return prev;
        const remaining = prev.chapters.filter((ch) => ch.id !== chapterId);
        const nextActive =
          prev.activeChapterId === chapterId ? remaining[0].id : prev.activeChapterId;
        return {
          ...prev,
          activeChapterId: nextActive,
          chapters: remaining,
        };
      }, true);
    },
    [storyState.chapters.length, t, scheduleSave]
  );

  const prependHistoryCard = useCallback(
    (card: NovelcrafterHistoryCard) => {
      scheduleSave(
        (prev) => ({
          ...prev,
          historyCards: [card, ...prev.historyCards].slice(0, MAX_HISTORY_CARDS),
        }),
        true
      );
    },
    [scheduleSave]
  );

  const deleteHistoryCard = useCallback(
    (cardId: string) => {
      scheduleSave(
        (prev) => ({
          ...prev,
          historyCards: prev.historyCards.filter((c) => c.id !== cardId),
        }),
        true
      );
    },
    [scheduleSave]
  );

  const clearHistoryCards = useCallback(async () => {
    const confirmed = await confirm({
      title: t("novelcrafterClearHistoryConfirmTitle"),
      description: t("novelcrafterClearHistoryConfirmDesc"),
      variant: "danger",
    });
    if (!confirmed) return;

    scheduleSave((prev) => ({ ...prev, historyCards: [] }), true);
  }, [t, scheduleSave]);

  const activeChapter = useMemo(() => {
    return (
      storyState.chapters.find((c) => c.id === storyState.activeChapterId) || storyState.chapters[0]
    );
  }, [storyState.chapters, storyState.activeChapterId]);

  const previousChapterProseTail = useMemo(() => {
    const idx = storyState.chapters.findIndex((c) => c.id === activeChapter?.id);
    if (idx <= 0) return "";
    return storyState.chapters[idx - 1]?.content?.slice(-2000) || "";
  }, [storyState.chapters, activeChapter]);

  return {
    stories,
    currentStory,
    selectedConversationId,
    setSelectedConversationId,
    creatingConversation,
    storyState,
    activeChapter,
    previousChapterProseTail,
    isLoadingState,
    saveStatus,
    gems,
    personas,
    handleCreateStory,
    handleDeleteStory,
    handleRenameStory,
    updateStoryBible,
    updateRouting,
    updateFeaturePersonaSlot,
    setSelectedModel,
    setStoryBibleOpen,
    selectChapter,
    addChapter,
    updateChapter,
    deleteChapter,
    prependHistoryCard,
    deleteHistoryCard,
    clearHistoryCards,
  };
}
