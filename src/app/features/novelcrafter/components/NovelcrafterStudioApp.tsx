// /app/features/novelcrafter/components/NovelcrafterStudioApp.tsx
"use client";

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import Sidebar from "../../sidebar/components/Sidebar";
import HeaderBar from "../../layout/components/HeaderBar";
import FloatingMenuTrigger from "../../layout/components/FloatingMenuTrigger";
import ToastContainer from "@/components/ui/ToastContainer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "@/lib/store/toastStore";
import { logger } from "@/lib/utils/logger";
import { useTheme } from "../../chat/hooks/useTheme";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { useAllowedModels } from "../../chat/components/hooks/useAllowedModels";
import { countChapterWords } from "@/lib/features/novelcrafter/draftStorage";
import {
  formatManuscriptExport,
  triggerManuscriptDownload,
} from "@/lib/features/novelcrafter/manuscriptExporter";
import type { NovelcrafterBibleTarget } from "@/lib/features/novelcrafter/types";
import { useChapterEditorController } from "../hooks/useChapterEditorController";
import { useDockedPanes } from "../hooks/useDockedPanes";
import { useNovelcrafterModelGuard } from "../hooks/useNovelcrafterModelGuard";
import { useNovelcrafterStory } from "../hooks/useNovelcrafterStory";
import { useNovelcrafterStream } from "../hooks/useNovelcrafterStream";
import { useDirectStreamBridge } from "../hooks/useDirectStreamBridge";
import { useStudioLayout } from "../hooks/useStudioLayout";
import ChapterAiToolbar from "./ChapterAiToolbar";
import NovelcrafterTopBar from "./NovelcrafterTopBar";
import NovelcrafterLeftNavigator, {
  type NovelcrafterBibleSectionId,
} from "./NovelcrafterLeftNavigator";
import ChapterEditorWorkspace, { type EditorSelectionRange } from "./ChapterEditorWorkspace";
import NovelcrafterHistoryPane from "./NovelcrafterHistoryPane";
import GemPersonaRoutingModal from "./GemPersonaRoutingModal";
import DestructiveSaveConfirmModal from "./DestructiveSaveConfirmModal";

export default function NovelcrafterStudioApp() {
  const { data: session, status } = useSession();
  const isAuthed = status === "authenticated";
  useTheme();
  const { t } = useLanguage();
  const layout = useStudioLayout();
  const panes = useDockedPanes(layout.config);
  const appRootRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    appRootRef.current?.style.setProperty("--nc-kb-offset", `${layout.keyboardOffsetPx}px`);
  }, [layout.keyboardOffsetPx]);

  const {
    allowedModelIds,
    loading: modelsLoading,
    isResolved: modelsResolved,
  } = useAllowedModels(isAuthed);
  const story = useNovelcrafterStory(isAuthed);
  const { handleSelectModel } = useNovelcrafterModelGuard({
    selectedModel: story.storyState.selectedModel,
    setSelectedModel: story.setSelectedModel,
    isLoadingState: story.isLoadingState,
    allowedModelIds,
    modelsLoading,
    modelsResolved,
    t,
  });

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
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

  const isLoadLocked = Boolean(story.validStoryId && story.loadErrorStoryId === story.validStoryId);

  const {
    isDirectStreamingToChapter,
    handleStreamStarted,
    handleStreamTokenChunk,
    handleStreamTerminated,
  } = useDirectStreamBridge({
    selectedConversationId: story.validStoryId,
    latestStateRef: story.latestStateRef,
    applyDirectStoryState: story.applyDirectStoryState,
    updateChapterFeedbackItems: story.updateChapterFeedbackItems,
  });

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
    chapterSummary: story.activeChapter.summary ?? "",
    chapterProse: story.activeChapter.content,
    previousChapterProseTail: story.previousChapterProseTail,
    previousChapterSummaries: story.previousChapterSummaries,
    streamCutoffWarning: t("novelcrafterStreamCutoffWarning"),
    onStreamStarted: handleStreamStarted,
    onStreamTokenChunk: handleStreamTokenChunk,
    onStreamTerminated: handleStreamTerminated,
    onCardCompleted: story.prependHistoryCard,
  });

  const feedbackPane = useMemo(
    () => ({
      isOpen: !focusMode && panes.isOpen("feedback"),
      open: () => {
        setFocusMode(false);
        panes.open("feedback");
      },
      close: () => panes.close("feedback"),
      toggle: () => {
        setFocusMode(false);
        panes.toggle("feedback");
      },
    }),
    [focusMode, panes]
  );

  const editor = useChapterEditorController({
    chapter: story.activeChapter,
    selection,
    onSelectionChange: setSelection,
    isStreaming: stream.isStreaming,
    isLoadLocked,
    onTriggerStream: stream.triggerStream,
    onUpdateChapter: story.updateChapter,
    onUpdateFeedbackItems: story.updateChapterFeedbackItems,
    feedbackPane,
    feedbackMode: layout.feedbackMode,
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
      const cleanCurrent = story.activeChapter.content.replace(/\s+$/, "");
      const cleanText = text
        .trim()
        .replace(/\r\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n");
      if (!cleanText) return;
      const nextContent = cleanCurrent.length > 0 ? `${cleanCurrent}\n\n${cleanText}` : cleanText;
      story.updateChapter(story.activeChapter.id, { content: nextContent });
    },
    [story]
  );

  const handleReplaceSelection = useCallback(
    (text: string) => {
      if (!selection) return handleAppendToChapter(text);
      const current = story.activeChapter.content;
      const cleanText = text
        .trim()
        .replace(/\r\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n");
      story.updateChapter(story.activeChapter.id, {
        content: current.slice(0, selection.start) + cleanText + current.slice(selection.end),
      });
      setSelection(null);
    },
    [selection, story, handleAppendToChapter]
  );

  const handleApplyToBible = useCallback(
    (target: NovelcrafterBibleTarget, text: string) => {
      if (target === "scenes") {
        story.updateChapter(story.activeChapter.id, { scenes: text });
      } else if (target === "chapter_summary") {
        story.updateChapter(story.activeChapter.id, { summary: text });
      } else if (target === "draft") {
        handleAppendToChapter(text);
      } else {
        story.updateStoryBible({ [target]: text });
      }
    },
    [story, handleAppendToChapter]
  );

  const jumpToBibleSection = useCallback(
    (sec: NovelcrafterBibleSectionId) => {
      setActiveBibleSection(sec);
      story.setStoryBibleOpen(true);
      setBibleJumpRequest({ section: sec, nonce: Date.now() });
      if (layout.navigatorMode === "drawer") {
        panes.close("navigator");
      }
    },
    [layout.navigatorMode, panes, story]
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
  const isLeftInline = layout.navigatorMode === "inline" && !focusMode;
  const isRightInline = layout.historyMode === "inline" && !focusMode;
  const showLeftPane = !focusMode && panes.isOpen("navigator");
  const showRightPane = !focusMode && panes.isOpen("history");

  const renderNavigator = (isInSheet: boolean) => (
    <NovelcrafterLeftNavigator
      isStoryBibleOpen={story.storyState.isStoryBibleOpen}
      onToggleStoryBible={story.setStoryBibleOpen}
      activeBibleSection={activeBibleSection}
      onJumpToBibleSection={jumpToBibleSection}
      chapters={story.storyState.chapters}
      activeChapterId={story.activeChapter.id}
      onSelectChapter={(chId) => {
        setSelection(null);
        story.selectChapter(chId);
        if (isInSheet) panes.close("navigator");
      }}
      onAddChapter={story.addChapter}
      onRenameChapter={(chapterId, title) => story.updateChapter(chapterId, { title })}
      onDeleteChapter={(chapterId) => void story.deleteChapter(chapterId)}
      isInSheet={isInSheet}
    />
  );

  const renderHistory = (isInSheet: boolean) => (
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
      isInSheet={isInSheet}
    />
  );

  return (
    <div
      ref={appRootRef}
      className="h-dvh w-full text-(--text-primary) overflow-hidden relative font-sans bg-(--surface) flex"
    >
      <a
        href="#nc-manuscript"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-3 focus:py-1.5 focus:rounded-lg focus:bg-(--accent) focus:text-(--accent-foreground) focus:text-xs focus:font-semibold"
      >
        {t("skipToMainContent")}
      </a>
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
        conversationsLabel={t("yourStories")}
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
        <HeaderBar
          hideOnDesktop
          onToggleSidebar={() => setMobileSidebarOpen(true)}
          showMobileControls={true}
        />

        <div className="flex-1 min-h-0 flex flex-col pt-[calc(3.5rem+var(--sat,0px))] md:pt-0">
          <NovelcrafterTopBar
            storyTitle={currentTitle}
            onRenameTitle={(newTitle) =>
              story.validStoryId && void story.handleRenameStory(story.validStoryId, newTitle)
            }
            selectedModel={story.storyState.selectedModel}
            onSelectModel={handleSelectModel}
            allowedModelIds={allowedModelIds}
            masterGem={masterGem}
            masterPersona={masterPersona}
            saveStatus={story.saveStatus}
            chapterWordCount={chapterWordCount}
            historyCount={story.storyState.historyCards.length}
            onRetrySave={() => void story.saveNow({ isManual: true })}
            onOpenRoutingModal={() => setIsRoutingModalOpen(true)}
            onExportManuscript={(opts) => {
              try {
                const payload = formatManuscriptExport({
                  storyTitle: currentTitle,
                  storyState: story.storyState,
                  format: opts.format === "md" ? "markdown" : "txt",
                  includeStoryBible: opts.includeStoryBible,
                  includeChapterSummaries: opts.includeChapterSummaries,
                });
                triggerManuscriptDownload(payload);
                toast.success(t("novelcrafterExportSuccessToast"));
              } catch (error: unknown) {
                const message = error instanceof Error ? error.message : "Unknown error";
                logger.error(`[NovelcrafterStudioApp] export manuscript failed: ${message}`);
                toast.error(t("exportFailed") || message);
              }
            }}
            showLeftPane={showLeftPane}
            onToggleLeftPane={() => {
              setFocusMode(false);
              panes.toggle("navigator");
            }}
            showRightPane={showRightPane}
            onToggleRightPane={() => {
              setFocusMode(false);
              panes.toggle("history");
            }}
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

          <ChapterAiToolbar {...editor.toolbarProps} onStopStream={stream.stopStream} />

          <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
            {isLeftInline && showLeftPane && renderNavigator(false)}
            {!isLeftInline && (
              <Sheet
                open={showLeftPane}
                onOpenChange={(open) => (open ? panes.open("navigator") : panes.close("navigator"))}
              >
                <SheetContent side="left" className="p-0 flex flex-col">
                  <SheetHeader className="sr-only">
                    <SheetTitle>{t("novelcrafterChaptersTab")}</SheetTitle>
                    <SheetDescription>{t("novelcrafterNavigatorSheetDesc")}</SheetDescription>
                  </SheetHeader>
                  {renderNavigator(true)}
                </SheetContent>
              </Sheet>
            )}

            <ChapterEditorWorkspace
              chapter={story.activeChapter}
              controller={editor}
              feedbackPane={feedbackPane}
              onUpdateChapter={story.updateChapter}
              onCreateSnapshot={story.createSnapshotForChapter}
              onRestoreSnapshot={story.restoreChapterSnapshot}
              onDeleteSnapshot={story.deleteChapterSnapshot}
              selection={selection}
              onSelectionChange={setSelection}
              isStreaming={stream.isStreaming}
              isDirectStreamingToChapter={isDirectStreamingToChapter}
              isLoadLocked={isLoadLocked}
              onTriggerStream={stream.triggerStream}
              onStopStream={stream.stopStream}
              storyBible={story.storyState.storyBible}
              onUpdateStoryBible={story.updateStoryBible}
              isStoryBibleOpen={story.storyState.isStoryBibleOpen}
              onToggleStoryBible={story.setStoryBibleOpen}
              onJumpToBibleSection={jumpToBibleSection}
              activeBibleSection={activeBibleSection}
              bibleJumpRequest={bibleJumpRequest}
              feedbackMode={layout.feedbackMode}
              focusMode={focusMode}
              onToggleFocusMode={() => setFocusMode((p) => !p)}
            />

            {isRightInline && showRightPane && renderHistory(false)}
            {!isRightInline && (
              <Sheet
                open={showRightPane}
                onOpenChange={(open) => (open ? panes.open("history") : panes.close("history"))}
              >
                <SheetContent side="right" className="p-0 flex flex-col">
                  <SheetHeader className="sr-only">
                    <SheetTitle>{t("novelcrafterHistoryTitle")}</SheetTitle>
                    <SheetDescription>{t("novelcrafterHistorySheetDesc")}</SheetDescription>
                  </SheetHeader>
                  {renderHistory(true)}
                </SheetContent>
              </Sheet>
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

      <DestructiveSaveConfirmModal
        prompt={story.destructivePrompt}
        onConfirmOverwrite={() => void story.confirmDestructiveSave()}
        onReloadSafe={() => void story.reloadAfterDestructiveRejection()}
      />
    </div>
  );
}
