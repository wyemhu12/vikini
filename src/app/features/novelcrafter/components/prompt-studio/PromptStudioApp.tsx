// /app/features/novelcrafter/components/prompt-studio/PromptStudioApp.tsx
"use client";

import React, { useMemo, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import ToastContainer from "@/components/ui/ToastContainer";
import { useCommandPaletteStore } from "@/lib/store/commandPaletteStore";
import { useLayoutStore } from "@/lib/store/layoutStore";
import { useAllowedModels } from "../../../chat/components/hooks/useAllowedModels";
import { useLanguage } from "../../../chat/hooks/useLanguage";
import { useTheme } from "../../../chat/hooks/useTheme";
import HeaderBar from "../../../layout/components/HeaderBar";
import { getShellPaddingClass } from "../../../layout/utils/shellNav";
import Sidebar from "../../../sidebar/components/Sidebar";
import { useNovelcrafterModelGuard } from "../../hooks/useNovelcrafterModelGuard";
import { useNovelcrafterStory } from "../../hooks/useNovelcrafterStory";
import DestructiveSaveConfirmModal from "../DestructiveSaveConfirmModal";
import NovelcrafterAiSettingsWorkspace from "../NovelcrafterAiSettingsWorkspace";

export default function PromptStudioApp() {
  const { data: session, status } = useSession();
  const isAuthed = status === "authenticated";
  useTheme();
  const { t } = useLanguage();
  const router = useRouter();

  const {
    allowedModelIds,
    loading: modelsLoading,
    isResolved: modelsResolved,
  } = useAllowedModels(isAuthed);
  const story = useNovelcrafterStory(isAuthed);
  useNovelcrafterModelGuard({
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

  const previewSource = useMemo(
    () => ({
      storyBible: story.storyState.storyBible,
      chapter: {
        title: story.activeChapter.title,
        content: story.activeChapter.content,
        scenes: story.activeChapter.scenes,
        summary: story.activeChapter.summary ?? "",
        extraInstructions: story.activeChapter.extraInstructions ?? "",
      },
      previousChapterProseTail: story.previousChapterProseTail,
      previousChapterSummaries: story.previousChapterSummaries,
    }),
    [
      story.storyState.storyBible,
      story.activeChapter,
      story.previousChapterProseTail,
      story.previousChapterSummaries,
    ]
  );

  const currentStoryObj = story.stories.find((s) => s.id === story.validStoryId);
  const currentTitle = currentStoryObj?.title || t("novelcrafterUntitledStory");

  return (
    <div className="h-dvh w-full bg-(--bg) text-(--text) overflow-hidden relative font-sans flex">
      <a
        href="#nc-ai-settings"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-3 focus:py-1.5 focus:rounded-lg focus:bg-(--accent) focus:text-(--on-accent) focus:text-xs focus:font-semibold"
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
        onNewChat={() => router.push("/")}
        sectionActionLabel={t("novelcrafterNewStory")}
        onSectionAction={() => void story.handleCreateStory()}
        conversationsLabel={t("yourStories")}
        onDeleteConversation={(id) => void story.handleDeleteStory(id)}
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

        <div
          id="nc-ai-settings"
          className="flex-1 min-h-0 flex flex-col pt-[calc(4.75rem+var(--sat,0px))] md:pt-0"
        >
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
            backHref="/novelcrafter"
            previewSource={previewSource}
          />
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
