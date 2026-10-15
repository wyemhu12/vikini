// /app/features/novelcrafter/components/NovelcrafterStudioApp.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import Sidebar from "../../sidebar/components/Sidebar";
import HeaderBar from "../../layout/components/HeaderBar";
import FloatingMenuTrigger from "../../layout/components/FloatingMenuTrigger";
import ToastContainer from "@/components/ui/ToastContainer";
import { useTheme } from "../../chat/hooks/useTheme";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { useAllowedModels } from "../../chat/components/hooks/useAllowedModels";
import { countChapterWords } from "@/lib/features/novelcrafter/draftStorage";
import { parseFeedbackItems } from "@/lib/features/novelcrafter/feedbackParser";
import {
  applyStreamTargetUpdate,
  resolveStreamTerminationState,
  type DirectStreamTarget,
} from "@/lib/features/novelcrafter/streamTargetGuard";
import type { NovelcrafterBibleTarget } from "@/lib/features/novelcrafter/types";
import { useNovelcrafterStory } from "../hooks/useNovelcrafterStory";
import {
  useNovelcrafterStream,
  type StreamTerminatedPayload,
  type TriggerNovelcrafterStreamParams,
} from "../hooks/useNovelcrafterStream";
import NovelcrafterTopBar from "./NovelcrafterTopBar";
import NovelcrafterLeftNavigator, {
  type NovelcrafterBibleSectionId,
} from "./NovelcrafterLeftNavigator";
import ChapterEditorWorkspace, { type EditorSelectionRange } from "./ChapterEditorWorkspace";
import NovelcrafterHistoryPane from "./NovelcrafterHistoryPane";
import GemPersonaRoutingModal from "./GemPersonaRoutingModal";

export default function NovelcrafterStudioApp() {
  const { data: session, status } = useSession();
  const isAuthed = status === "authenticated";
  useTheme();
  const { t } = useLanguage();

  const { allowedModelIds } = useAllowedModels(isAuthed);
  const story = useNovelcrafterStory(isAuthed);

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showLeftPane, setShowLeftPane] = useState(true);
  const [showRightPane, setShowRightPane] = useState(true);
  const [isRoutingModalOpen, setIsRoutingModalOpen] = useState(false);
  const [activeBibleSection, setActiveBibleSection] =
    useState<NovelcrafterBibleSectionId>("braindump");
  const [bibleJumpRequest, setBibleJumpRequest] = useState<{
    section: NovelcrafterBibleSectionId;
    nonce: number;
  } | null>(null);
  const [renamingStoryId, setRenamingStoryId] = useState<string | null>(null);
  const [renameStoryTitle, setRenameStoryTitle] = useState("");
  const [selection, setSelection] = useState<EditorSelectionRange | null>(null);
  const [isDirectStreamingToChapter, setIsDirectStreamingToChapter] = useState(false);

  const directStreamTargetRef = useRef<DirectStreamTarget | null>(null);
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
    setIsDirectStreamingToChapter(false);
    return () => cancelRaf();
  }, [story.selectedConversationId, cancelRaf]);

  const handleStreamStarted = useCallback(
    ({ storyId, params }: { storyId: string; params: TriggerNovelcrafterStreamParams }) => {
      cancelRaf();
      const currentState = story.latestStateRef.current.state;
      const activeCh =
        currentState.chapters.find((c) => c.id === currentState.activeChapterId) ||
        currentState.chapters[0];
      if (
        params.feature === "write" ||
        (params.feature === "bible" && params.bibleTarget === "draft")
      ) {
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
      } else if (
        params.feature === "bible" &&
        params.bibleTarget &&
        params.bibleTarget !== "draft" &&
        params.bibleTarget !== "scenes"
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
    [cancelRaf, story.latestStateRef]
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
          if (story.latestStateRef.current.ownerStoryId !== pending.storyId) return;
          const parsedItems = parseFeedbackItems(pending.fullContent, { isStreaming: true });
          if (parsedItems.length === 0) return;
          const currentState = story.latestStateRef.current.state;
          story.applyDirectStoryState(
            {
              ...currentState,
              chapters: currentState.chapters.map((ch) =>
                ch.id === currentState.activeChapterId ? { ...ch, feedbackItems: parsedItems } : ch
              ),
            },
            { skipSave: true }
          );
          return;
        }

        const target = directStreamTargetRef.current;
        if (!target || target.storyId !== pending.storyId) return;
        const applied = applyStreamTargetUpdate(
          story.latestStateRef.current,
          target,
          pending.fullContent
        );
        if (applied.applied) story.applyDirectStoryState(applied.nextState, { skipSave: true });
      });
    },
    [story]
  );

  const handleStreamTerminated = useCallback(
    (payload: StreamTerminatedPayload) => {
      cancelRaf();
      setIsDirectStreamingToChapter(false);
      if (payload.params.feature === "feedback") {
        if (
          story.latestStateRef.current.ownerStoryId === payload.storyId &&
          payload.fullContent.trim()
        ) {
          const parsedItems = parseFeedbackItems(payload.fullContent, { isStreaming: false });
          if (parsedItems.length > 0) {
            story.updateChapterFeedbackItems(
              story.latestStateRef.current.state.activeChapterId,
              (existing) => [...parsedItems, ...existing.filter((i) => i.status === "resolved")],
              true
            );
          }
        }
        directStreamTargetRef.current = null;
        return;
      }

      const target = directStreamTargetRef.current;
      directStreamTargetRef.current = null;
      if (!target || story.latestStateRef.current.ownerStoryId !== target.storyId) return;

      const resolved = resolveStreamTerminationState({
        reason: payload.reason,
        baseContent: target.baseContent,
        accumulatedStreamText: payload.fullContent,
        isAppendMode: target.kind === "chapter_prose",
      });
      const applied = applyStreamTargetUpdate(
        story.latestStateRef.current,
        { ...target, baseContent: "" },
        resolved.finalFieldContent
      );
      if (applied.applied) {
        story.applyDirectStoryState(applied.nextState, {
          immediate: resolved.shouldPersistState,
          skipSave: !resolved.shouldPersistState,
        });
      }
    },
    [cancelRaf, story]
  );

  const stream = useNovelcrafterStream({
    selectedConversationId: story.validStoryId,
    ensureStoryConversation: () => story.ensureActiveStory(),
    selectedModel: story.storyState.selectedModel,
    routing: story.storyState.routing,
    storyBible: story.storyState.storyBible,
    activeChapterId: story.activeChapter.id,
    chapterTitle: story.activeChapter.title,
    chapterScenes: story.activeChapter.scenes,
    chapterExtraInstructions: story.activeChapter.extraInstructions,
    chapterProse: story.activeChapter.content,
    previousChapterProseTail: story.previousChapterProseTail,
    onStreamStarted: handleStreamStarted,
    onStreamTokenChunk: handleStreamTokenChunk,
    onStreamTerminated: handleStreamTerminated,
    onCardCompleted: story.prependHistoryCard,
  });

  const masterGem = useMemo(
    () => story.gems.find((g) => g.id === story.storyState.routing.masterGemId) || null,
    [story.gems, story.storyState.routing.masterGemId]
  );
  const masterPersona = useMemo(
    () => story.personas.find((p) => p.id === story.storyState.routing.masterPersonaId) || null,
    [story.personas, story.storyState.routing.masterPersonaId]
  );
  const chapterWordCount = useMemo(
    () => countChapterWords(story.activeChapter?.content || ""),
    [story.activeChapter?.content]
  );

  const handleAppendToChapter = useCallback(
    (text: string) => {
      const current = story.activeChapter.content;
      const separator = current.trim().length > 0 ? "\n\n" : "";
      story.updateChapter(story.activeChapter.id, { content: `${current}${separator}${text}` });
    },
    [story]
  );

  const handleReplaceSelection = useCallback(
    (text: string) => {
      if (!selection) return handleAppendToChapter(text);
      const current = story.activeChapter.content;
      story.updateChapter(story.activeChapter.id, {
        content: current.slice(0, selection.start) + text + current.slice(selection.end),
      });
      setSelection(null);
    },
    [selection, story, handleAppendToChapter]
  );

  const handleApplyToBible = useCallback(
    (target: NovelcrafterBibleTarget, text: string) => {
      if (target === "scenes") story.updateChapter(story.activeChapter.id, { scenes: text });
      else if (target === "draft") handleAppendToChapter(text);
      else story.updateStoryBible({ [target]: text });
    },
    [story, handleAppendToChapter]
  );

  if (status === "loading") {
    return (
      <div className="h-dvh flex items-center justify-center bg-(--surface) text-(--text-primary)">
        {t("loading")}
      </div>
    );
  }
  if (!isAuthed) {
    void signIn();
    return null;
  }

  const currentTitle = story.currentStory?.title || t("novelcrafterDefaultStoryTitle");

  return (
    <div className="h-dvh w-full text-(--text-primary) overflow-hidden relative font-sans bg-(--surface) flex">
      <ToastContainer />

      <Sidebar
        conversations={story.stories}
        selectedConversationId={story.validStoryId}
        onSelectConversation={(id) => {
          story.setSelectedConversationId(id);
          setMobileSidebarOpen(false);
        }}
        onNewChat={() => {
          void story.handleCreateStory();
          setMobileSidebarOpen(false);
        }}
        newChatLabel={t("novelcrafterNewStory")}
        onDeleteConversation={(id) => void story.handleDeleteStory(id)}
        onRenameChat={(id) => {
          const found = story.stories.find((s) => s.id === id);
          setRenamingStoryId(id);
          setRenameStoryTitle(found?.title || "");
        }}
        onLogout={() => void signOut({ callbackUrl: "/auth/signin" })}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        session={session}
        isCreatingChat={story.creatingConversation}
      />

      {!mobileSidebarOpen && <FloatingMenuTrigger onClick={() => setMobileSidebarOpen(true)} />}

      <div
        className={`flex-1 h-full flex flex-col min-w-0 relative z-10 transition-[padding] duration-300 ${
          sidebarCollapsed
            ? "md:pl-[calc(5rem+var(--sal,0px))]"
            : "md:pl-[calc(18rem+var(--sal,0px))] lg:pl-[calc(20rem+var(--sal,0px))]"
        } pr-[var(--sar,0px)]`}
      >
        <HeaderBar onToggleSidebar={() => setMobileSidebarOpen(true)} showMobileControls={true} />

        <div className="flex-1 min-h-0 flex flex-col pt-[calc(3.5rem+var(--sat,0px))] md:pt-0">
          <NovelcrafterTopBar
            storyTitle={currentTitle}
            onRenameTitle={(newTitle) => {
              if (story.validStoryId) void story.handleRenameStory(story.validStoryId, newTitle);
            }}
            selectedModel={story.storyState.selectedModel}
            onSelectModel={story.setSelectedModel}
            allowedModelIds={allowedModelIds}
            masterGem={masterGem}
            masterPersona={masterPersona}
            saveStatus={story.saveStatus}
            chapterWordCount={chapterWordCount}
            onRetrySave={() => void story.saveNow({ isManual: true })}
            onOpenRoutingModal={() => setIsRoutingModalOpen(true)}
            showLeftPane={showLeftPane}
            onToggleLeftPane={() => setShowLeftPane((p) => !p)}
            showRightPane={showRightPane}
            onToggleRightPane={() => setShowRightPane((p) => !p)}
            renamingStoryId={renamingStoryId}
            renameStoryTitle={renameStoryTitle}
            onChangeRenameStoryTitle={setRenameStoryTitle}
            onCloseRenameStoryModal={() => setRenamingStoryId(null)}
            onConfirmRenameStory={() => {
              if (!renamingStoryId || !renameStoryTitle.trim()) return;
              void story.handleRenameStory(renamingStoryId, renameStoryTitle.trim());
              setRenamingStoryId(null);
            }}
          />

          <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
            {showLeftPane && (
              <NovelcrafterLeftNavigator
                isStoryBibleOpen={story.storyState.isStoryBibleOpen}
                onToggleStoryBible={story.setStoryBibleOpen}
                activeBibleSection={activeBibleSection}
                onJumpToBibleSection={(sec) => {
                  setActiveBibleSection(sec);
                  story.setStoryBibleOpen(true);
                  setBibleJumpRequest({ section: sec, nonce: Date.now() });
                }}
                chapters={story.storyState.chapters}
                activeChapterId={story.activeChapter.id}
                onSelectChapter={story.selectChapter}
                onAddChapter={story.addChapter}
                onRenameChapter={(chapterId, title) => story.updateChapter(chapterId, { title })}
                onDeleteChapter={(chapterId) => void story.deleteChapter(chapterId)}
              />
            )}

            <ChapterEditorWorkspace
              chapter={story.activeChapter}
              onUpdateChapter={story.updateChapter}
              onUpdateFeedbackItems={story.updateChapterFeedbackItems}
              selection={selection}
              onSelectionChange={setSelection}
              isStreaming={stream.isStreaming}
              isDirectStreamingToChapter={isDirectStreamingToChapter}
              onTriggerStream={stream.triggerStream}
              onStopStream={stream.stopStream}
              storyBible={story.storyState.storyBible}
              onUpdateStoryBible={story.updateStoryBible}
              isStoryBibleOpen={story.storyState.isStoryBibleOpen}
              onToggleStoryBible={story.setStoryBibleOpen}
              activeBibleSection={activeBibleSection}
              bibleJumpRequest={bibleJumpRequest}
            />

            {showRightPane && (
              <NovelcrafterHistoryPane
                historyCards={story.storyState.historyCards}
                isStreaming={stream.isStreaming}
                streamingContent={stream.streamingContent}
                streamingThinking={stream.streamingThinking}
                streamingMeta={stream.streamingMeta}
                hasActiveSelection={Boolean(selection && selection.text.length > 0)}
                onAppendToChapter={handleAppendToChapter}
                onReplaceSelection={handleReplaceSelection}
                onApplyToBible={handleApplyToBible}
                onDeleteCard={story.deleteHistoryCard}
                onClearAllCards={() => void story.clearHistoryCards()}
              />
            )}
          </div>
        </div>
      </div>

      <GemPersonaRoutingModal
        isOpen={isRoutingModalOpen}
        onClose={() => setIsRoutingModalOpen(false)}
        routing={story.storyState.routing}
        gems={story.gems}
        personas={story.personas}
        onUpdateRouting={story.updateRouting}
        onUpdateFeatureSlot={story.updateFeaturePersonaSlot}
      />
    </div>
  );
}
