// /app/features/novelcrafter/components/NovelcrafterStudioApp.tsx
"use client";

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Sidebar from "../../sidebar/components/Sidebar";
import HeaderBar from "../../layout/components/HeaderBar";
import ToastContainer from "@/components/ui/ToastContainer";
import { toast } from "@/lib/store/toastStore";
import { useLayoutStore } from "@/lib/store/layoutStore";
import { useCommandPaletteStore } from "@/lib/store/commandPaletteStore";
import { getShellPaddingClass } from "../../layout/utils/shellNav";
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
import NovelcrafterTopBar from "./NovelcrafterTopBar";
import NovelcrafterViewPanel from "./NovelcrafterViewPanel";
import {
  NovelcrafterViewTabs,
  useNovelcrafterViewIds,
  type NovelcrafterView,
} from "./NovelcrafterViewTabs";
import type { NovelcrafterBibleSectionId } from "./NovelcrafterLeftNavigator";
import type { EditorSelectionRange } from "./ChapterEditorWorkspace";
import NovelcrafterWriteStage from "./NovelcrafterWriteStage";
import NovelcrafterAiSettingsWorkspace from "./NovelcrafterAiSettingsWorkspace";
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
  const sidebarCollapsed = useLayoutStore((s) => s.panelCollapsedBySection.novelcrafter);
  const togglePanel = useLayoutStore((s) => s.togglePanel);
  const openPalette = useCommandPaletteStore((s) => s.open);
  const router = useRouter();
  const [view, setView] = useState<NovelcrafterView>("write");
  const viewIds = useNovelcrafterViewIds();
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
    allowedModelIds,
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
      <div className="h-dvh flex items-center justify-center bg-(--bg) text-(--text)">
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
  const toggleTopPane = (pane: "navigator" | "history") => {
    setFocusMode(false);
    if (view === "write") return panes.toggle(pane);
    setView("write");
    panes.open(pane);
  };
  const returnToWrite = (opts?: { clearSelection?: boolean; openBeats?: boolean }) => {
    if (opts?.clearSelection) setSelection(null);
    if (opts?.openBeats) editor.setBeatsOpen(true);
    setView("write");
  };

  return (
    <div
      ref={appRootRef}
      className="h-dvh w-full text-(--text) overflow-hidden relative font-sans bg-(--bg) flex"
    >
      <a
        href="#nc-manuscript"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-3 focus:py-1.5 focus:rounded-lg focus:bg-(--accent) focus:text-(--on-accent) focus:text-xs focus:font-semibold"
      >
        {t("skipToMainContent")}
      </a>
      {!isRoutingModalOpen && <h1 className="sr-only">{t("novelcrafterStudio")}</h1>}
      <ToastContainer />
      <Sidebar
        conversations={story.stories}
        selectedConversationId={story.validStoryId}
        onSelectConversation={(id) => {
          story.setSelectedConversationId(id);
          setMobileSidebarOpen(false);
        }}
        onNewChat={() => router.push("/")}
        sectionActionLabel={t("novelcrafterNewStory")}
        onSectionAction={() => void story.handleCreateStory()}
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
        onToggleCollapse={() => togglePanel("novelcrafter")}
        onOpenCommandPalette={openPalette}
        session={session}
        isCreatingChat={story.creatingConversation}
      />

      <div
        className={`flex-1 h-full flex flex-col min-w-0 relative z-10 transition-[padding] duration-300 ${getShellPaddingClass(sidebarCollapsed)} pr-[var(--sar,0px)]`}
      >
        <HeaderBar
          hideOnDesktop
          onToggleSidebar={() => setMobileSidebarOpen(true)}
          showMobileControls={true}
        />

        <div className="flex-1 min-h-0 flex flex-col pt-[calc(4.75rem+var(--sat,0px))] md:pt-0">
          {isRoutingModalOpen ? (
            <NovelcrafterAiSettingsWorkspace
              storyTitle={currentTitle}
              selectedModel={story.storyState.selectedModel}
              allowedModelIds={allowedModelIds}
              routing={story.storyState.routing}
              gems={story.gems}
              personas={story.personas}
              onUpdateRouting={story.updateRouting}
              onUpdateFeaturePersonaSlot={story.updateFeaturePersonaSlot}
              onUpdateFeatureModelSlot={story.updateFeatureModelSlot}
              onClose={() => setIsRoutingModalOpen(false)}
            />
          ) : (
            <>
              <NovelcrafterTopBar
                storyTitle={currentTitle}
                viewTabs={<NovelcrafterViewTabs value={view} onChange={setView} ids={viewIds} />}
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
                showLeftPane={view === "write" && showLeftPane}
                onToggleLeftPane={() => toggleTopPane("navigator")}
                showRightPane={view === "write" && showRightPane}
                onToggleRightPane={() => toggleTopPane("history")}
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

              <NovelcrafterViewPanel
                view={view}
                ids={viewIds}
                story={story}
                bibleNav={{ section: activeBibleSection, jump: bibleJumpRequest }}
                isStreaming={stream.isStreaming || isLoadLocked}
                onTriggerStream={stream.triggerStream}
                onStopStream={stream.stopStream}
                onReturnToWrite={returnToWrite}
              >
                <NovelcrafterWriteStage
                  chapters={story.storyState.chapters}
                  activeChapter={story.activeChapter}
                  storyBible={story.storyState.storyBible}
                  isStoryBibleOpen={story.storyState.isStoryBibleOpen}
                  onToggleStoryBible={story.setStoryBibleOpen}
                  activeBibleSection={activeBibleSection}
                  bibleJumpRequest={bibleJumpRequest}
                  onJumpToBibleSection={jumpToBibleSection}
                  onSelectChapter={story.selectChapter}
                  onAddChapter={story.addChapter}
                  onUpdateChapter={story.updateChapter}
                  onDeleteChapter={(chapterId) => void story.deleteChapter(chapterId)}
                  onUpdateStoryBible={story.updateStoryBible}
                  onCreateSnapshot={story.createSnapshotForChapter}
                  onRestoreSnapshot={story.restoreChapterSnapshot}
                  onDeleteSnapshot={story.deleteChapterSnapshot}
                  editor={editor}
                  feedbackPane={feedbackPane}
                  feedbackMode={layout.feedbackMode}
                  focusMode={focusMode}
                  onToggleFocusMode={() => setFocusMode((p) => !p)}
                  selection={selection}
                  onSelectionChange={setSelection}
                  isLeftInline={isLeftInline}
                  isRightInline={isRightInline}
                  showLeftPane={showLeftPane}
                  showRightPane={showRightPane}
                  onOpenPane={(pane) => {
                    setFocusMode(false);
                    panes.open(pane);
                  }}
                  onClosePane={(pane) => panes.close(pane)}
                  historyCards={story.storyState.historyCards}
                  isStreaming={stream.isStreaming}
                  isDirectStreamingToChapter={isDirectStreamingToChapter}
                  isLoadLocked={isLoadLocked}
                  streamingContent={stream.streamingContent}
                  streamingThinking={stream.streamingThinking}
                  streamingMeta={stream.streamingMeta}
                  onTriggerStream={stream.triggerStream}
                  onStopStream={stream.stopStream}
                  onAppendToChapter={handleAppendToChapter}
                  onReplaceSelection={handleReplaceSelection}
                  onApplyToBible={handleApplyToBible}
                  onDeleteCard={story.deleteHistoryCard}
                  onClearAllCards={() => void story.clearHistoryCards()}
                  selectedModel={story.storyState.selectedModel}
                  allowedModelIds={allowedModelIds}
                  routing={story.storyState.routing}
                  gems={story.gems}
                  personas={story.personas}
                  onOpenAiSettings={() => setIsRoutingModalOpen(true)}
                />
              </NovelcrafterViewPanel>
            </>
          )}
        </div>
      </div>

      <DestructiveSaveConfirmModal
        prompt={story.destructivePrompt}
        onConfirmOverwrite={() => void story.confirmDestructiveSave()}
        onReloadSafe={() => void story.reloadAfterDestructiveRejection()}
      />
    </div>
  );
}
