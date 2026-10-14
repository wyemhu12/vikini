// /app/features/novelcrafter/components/NovelcrafterStudioApp.tsx
"use client";

import React, { useCallback, useMemo, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import Sidebar from "../../sidebar/components/Sidebar";
import HeaderBar from "../../layout/components/HeaderBar";
import FloatingMenuTrigger from "../../layout/components/FloatingMenuTrigger";
import ToastContainer from "@/components/ui/ToastContainer";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "../../chat/hooks/useTheme";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { useAllowedModels } from "../../chat/components/hooks/useAllowedModels";
import { useNovelcrafterStory } from "../hooks/useNovelcrafterStory";
import { useNovelcrafterStream } from "../hooks/useNovelcrafterStream";
import NovelcrafterTopBar from "./NovelcrafterTopBar";
import NovelcrafterLeftNavigator from "./NovelcrafterLeftNavigator";
import StoryBibleWorkspace from "./StoryBibleWorkspace";
import ChapterEditorWorkspace, { type EditorSelectionRange } from "./ChapterEditorWorkspace";
import NovelcrafterHistoryPane from "./NovelcrafterHistoryPane";
import GemPersonaRoutingModal from "./GemPersonaRoutingModal";
import type { NovelcrafterBibleTarget } from "@/lib/features/novelcrafter/types";

export default function NovelcrafterStudioApp() {
  const { data: session, status } = useSession();
  const isAuthed = status === "authenticated";
  useTheme();
  const { t } = useLanguage();

  const { allowedModelIds, loading: modelsLoading } = useAllowedModels(isAuthed);
  const story = useNovelcrafterStory(isAuthed);

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showLeftPane, setShowLeftPane] = useState(true);
  const [showRightPane, setShowRightPane] = useState(true);
  const [isRoutingModalOpen, setIsRoutingModalOpen] = useState(false);

  // Rename story modal state
  const [renamingStoryId, setRenamingStoryId] = useState<string | null>(null);
  const [renameStoryTitle, setRenameStoryTitle] = useState("");

  // Active editor selection range
  const [selection, setSelection] = useState<EditorSelectionRange | null>(null);

  const stream = useNovelcrafterStream({
    selectedConversationId: story.selectedConversationId,
    ensureStoryConversation: story.handleCreateStory,
    selectedModel: story.storyState.selectedModel,
    routing: story.storyState.routing,
    storyBible: story.storyState.storyBible,
    activeChapterId: story.activeChapter.id,
    chapterTitle: story.activeChapter.title,
    chapterScenes: story.activeChapter.scenes,
    chapterProse: story.activeChapter.content,
    previousChapterProseTail: story.previousChapterProseTail,
    onCardCompleted: story.prependHistoryCard,
  });

  const masterGem = useMemo(() => {
    const id = story.storyState.routing.masterGemId;
    if (!id) return null;
    return story.gems.find((g) => g.id === id) || null;
  }, [story.gems, story.storyState.routing.masterGemId]);

  const masterPersona = useMemo(() => {
    const id = story.storyState.routing.masterPersonaId;
    if (!id) return null;
    return story.personas.find((p) => p.id === id) || null;
  }, [story.personas, story.storyState.routing.masterPersonaId]);

  const handleAppendToChapter = useCallback(
    (text: string) => {
      const current = story.activeChapter.content;
      const separator = current.trim().length > 0 ? "\n\n" : "";
      story.updateChapter(story.activeChapter.id, {
        content: `${current}${separator}${text}`,
      });
      story.setStoryBibleOpen(false);
    },
    [story]
  );

  const handleReplaceSelection = useCallback(
    (text: string) => {
      if (!selection) {
        handleAppendToChapter(text);
        return;
      }
      const current = story.activeChapter.content;
      const updated = current.slice(0, selection.start) + text + current.slice(selection.end);
      story.updateChapter(story.activeChapter.id, { content: updated });
      setSelection(null);
      story.setStoryBibleOpen(false);
    },
    [selection, story, handleAppendToChapter]
  );

  const handleApplyToBible = useCallback(
    (target: NovelcrafterBibleTarget, text: string) => {
      if (target === "scenes") {
        story.updateChapter(story.activeChapter.id, { scenes: text });
      } else if (target === "draft") {
        handleAppendToChapter(text);
      } else {
        story.updateStoryBible({ [target]: text });
      }
    },
    [story, handleAppendToChapter]
  );

  const openRenameStoryModal = useCallback(
    (id: string) => {
      const found = story.stories.find((s) => s.id === id);
      setRenamingStoryId(id);
      setRenameStoryTitle(found?.title || "");
    },
    [story.stories]
  );

  const confirmRenameStory = useCallback(async () => {
    if (!renamingStoryId || !renameStoryTitle.trim()) return;
    await story.handleRenameStory(renamingStoryId, renameStoryTitle.trim());
    setRenamingStoryId(null);
  }, [renamingStoryId, renameStoryTitle, story]);

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
        selectedConversationId={story.selectedConversationId}
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
        onRenameChat={openRenameStoryModal}
        onLogout={() => void signOut({ callbackUrl: "/auth/signin" })}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        session={session}
        isCreatingChat={story.creatingConversation}
      />

      {!mobileSidebarOpen && <FloatingMenuTrigger onClick={() => setMobileSidebarOpen(true)} />}

      {/* Main Content Container */}
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
              if (story.selectedConversationId) {
                void story.handleRenameStory(story.selectedConversationId, newTitle);
              }
            }}
            selectedModel={story.storyState.selectedModel}
            onSelectModel={story.setSelectedModel}
            allowedModelIds={allowedModelIds}
            modelsLoading={modelsLoading}
            masterGem={masterGem}
            masterPersona={masterPersona}
            saveStatus={story.saveStatus}
            onOpenRoutingModal={() => setIsRoutingModalOpen(true)}
            showLeftPane={showLeftPane}
            onToggleLeftPane={() => setShowLeftPane((p) => !p)}
            showRightPane={showRightPane}
            onToggleRightPane={() => setShowRightPane((p) => !p)}
          />

          {/* 3-Pane Sudowrite Workspace */}
          <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
            {showLeftPane && (
              <NovelcrafterLeftNavigator
                isStoryBibleOpen={story.storyState.isStoryBibleOpen}
                onSelectStoryBible={() => story.setStoryBibleOpen(true)}
                chapters={story.storyState.chapters}
                activeChapterId={story.activeChapter.id}
                onSelectChapter={story.selectChapter}
                onAddChapter={story.addChapter}
                onRenameChapter={(chapterId, title) => story.updateChapter(chapterId, { title })}
                onDeleteChapter={(chapterId) => void story.deleteChapter(chapterId)}
              />
            )}

            {/* Center Pane: Story Bible OR Chapter Editor */}
            {story.storyState.isStoryBibleOpen ? (
              <StoryBibleWorkspace
                storyBible={story.storyState.storyBible}
                onUpdateStoryBible={story.updateStoryBible}
                isStreaming={stream.isStreaming}
                onTriggerStream={stream.triggerStream}
              />
            ) : (
              <ChapterEditorWorkspace
                chapter={story.activeChapter}
                onUpdateChapter={story.updateChapter}
                selection={selection}
                onSelectionChange={setSelection}
                isStreaming={stream.isStreaming}
                onTriggerStream={stream.triggerStream}
                onStopStream={stream.stopStream}
              />
            )}

            {/* Right Pane: AI History Cards */}
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

      {/* Layered GEM & Persona Routing Modal */}
      <GemPersonaRoutingModal
        isOpen={isRoutingModalOpen}
        onClose={() => setIsRoutingModalOpen(false)}
        routing={story.storyState.routing}
        gems={story.gems}
        personas={story.personas}
        onUpdateRouting={story.updateRouting}
        onUpdateFeatureSlot={story.updateFeaturePersonaSlot}
      />

      {/* Rename Story Modal */}
      <Dialog
        open={Boolean(renamingStoryId)}
        onOpenChange={(open) => !open && setRenamingStoryId(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("renameChat")}</DialogTitle>
          </DialogHeader>
          <Input
            type="text"
            value={renameStoryTitle}
            onChange={(e) => setRenameStoryTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void confirmRenameStory();
            }}
            autoFocus
            className="h-11"
            placeholder={t("novelcrafterStoryTitlePlaceholder")}
          />
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setRenamingStoryId(null)}>
              {t("cancel")}
            </Button>
            <Button onClick={() => void confirmRenameStory()} disabled={!renameStoryTitle.trim()}>
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
