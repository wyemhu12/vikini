// /app/features/novelcrafter/components/NovelcrafterStudioApp.tsx
"use client";

import React, { useCallback, useMemo, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import Sidebar from "../../sidebar/components/Sidebar";
import HeaderBar from "../../layout/components/HeaderBar";
import FloatingMenuTrigger from "../../layout/components/FloatingMenuTrigger";
import ToastContainer from "@/components/ui/ToastContainer";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useTheme } from "../../chat/hooks/useTheme";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { useAllowedModels } from "../../chat/components/hooks/useAllowedModels";
import { countChapterWords } from "@/lib/features/novelcrafter/draftStorage";
import type { NovelcrafterBibleTarget } from "@/lib/features/novelcrafter/types";
import { useNovelcrafterModelGuard } from "../hooks/useNovelcrafterModelGuard";
import { useNovelcrafterStory } from "../hooks/useNovelcrafterStory";
import { useNovelcrafterStream } from "../hooks/useNovelcrafterStream";
import { useDirectStreamBridge } from "../hooks/useDirectStreamBridge";
import { useStudioLayout } from "../hooks/useStudioLayout";
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showLeftPane, setShowLeftPane] = useState(true);
  const [showRightPane, setShowRightPane] = useState(true);
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
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

  const {
    isDirectStreamingToChapter,
    handleStreamStarted,
    handleStreamTokenChunk,
    handleStreamTerminated,
  } = useDirectStreamBridge({
    selectedConversationId: story.selectedConversationId,
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
  const isLeftInline = layout.navigatorMode === "inline" && !focusMode;
  const isRightInline = layout.historyMode === "inline" && !focusMode;

  const navigatorNode = (
    <NovelcrafterLeftNavigator
      isStoryBibleOpen={story.storyState.isStoryBibleOpen}
      onToggleStoryBible={story.setStoryBibleOpen}
      activeBibleSection={activeBibleSection}
      onJumpToBibleSection={(sec) => {
        setActiveBibleSection(sec);
        story.setStoryBibleOpen(true);
        setBibleJumpRequest({ section: sec, nonce: Date.now() });
        setLeftDrawerOpen(false);
      }}
      chapters={story.storyState.chapters}
      activeChapterId={story.activeChapter.id}
      onSelectChapter={(chId) => {
        story.selectChapter(chId);
        setLeftDrawerOpen(false);
      }}
      onAddChapter={story.addChapter}
      onRenameChapter={(chapterId, title) => story.updateChapter(chapterId, { title })}
      onDeleteChapter={(chapterId) => void story.deleteChapter(chapterId)}
    />
  );

  const historyNode = (
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
  );

  return (
    <div
      style={{ "--nc-kb-offset": `${layout.keyboardOffsetPx}px` } as React.CSSProperties}
      className="h-dvh w-full text-(--text-primary) overflow-hidden relative font-sans bg-(--surface) flex"
    >
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
            showLeftPane={isLeftInline ? showLeftPane : leftDrawerOpen}
            onToggleLeftPane={() =>
              isLeftInline ? setShowLeftPane((p) => !p) : setLeftDrawerOpen((p) => !p)
            }
            showRightPane={isRightInline ? showRightPane : rightDrawerOpen}
            onToggleRightPane={() =>
              isRightInline ? setShowRightPane((p) => !p) : setRightDrawerOpen((p) => !p)
            }
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
            {isLeftInline && showLeftPane && navigatorNode}
            {!isLeftInline && (
              <Sheet open={leftDrawerOpen} onOpenChange={setLeftDrawerOpen}>
                <SheetContent side="left" className="p-0 flex flex-col">
                  <SheetHeader className="sr-only">
                    <SheetTitle>{t("novelcrafterChaptersTab")}</SheetTitle>
                  </SheetHeader>
                  {navigatorNode}
                </SheetContent>
              </Sheet>
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
              feedbackMode={layout.feedbackMode}
              focusMode={focusMode}
              onToggleFocusMode={() => setFocusMode((p) => !p)}
            />

            {isRightInline && showRightPane && historyNode}
            {!isRightInline && (
              <Sheet open={rightDrawerOpen} onOpenChange={setRightDrawerOpen}>
                <SheetContent side="right" className="p-0 flex flex-col">
                  <SheetHeader className="sr-only">
                    <SheetTitle>{t("novelcrafterHistoryTitle")}</SheetTitle>
                  </SheetHeader>
                  {historyNode}
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
