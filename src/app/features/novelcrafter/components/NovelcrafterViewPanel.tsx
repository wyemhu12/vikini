// /app/features/novelcrafter/components/NovelcrafterViewPanel.tsx
"use client";

import React from "react";
import { cn } from "@/lib/utils/cn";
import type { NovelcrafterChapter, StoryBible } from "@/lib/features/novelcrafter/types";
import type { TriggerNovelcrafterStreamParams } from "../hooks/useNovelcrafterStream";
import type { NovelcrafterBibleSectionId } from "./NovelcrafterLeftNavigator";
import NovelcrafterOutlineBoard from "./NovelcrafterOutlineBoard";
import type { NovelcrafterView, NovelcrafterViewIds } from "./NovelcrafterViewTabs";
import StoryBibleWorkspace from "./StoryBibleWorkspace";

export interface NovelcrafterViewPanelStory {
  storyState: {
    chapters: readonly NovelcrafterChapter[];
    storyBible: StoryBible;
  };
  activeChapter: NovelcrafterChapter;
  addChapter: () => void;
  selectChapter: (chapterId: string) => void;
  updateChapter: (chapterId: string, patch: Partial<NovelcrafterChapter>) => void;
  updateStoryBible: (patch: Partial<StoryBible>) => void;
}

interface NovelcrafterViewPanelProps {
  view: NovelcrafterView;
  ids: NovelcrafterViewIds;
  story: NovelcrafterViewPanelStory;
  bibleNav: {
    section: NovelcrafterBibleSectionId;
    jump: { section: NovelcrafterBibleSectionId; nonce: number } | null;
  };
  isStreaming: boolean;
  onTriggerStream: (params: TriggerNovelcrafterStreamParams) => Promise<void>;
  onReturnToWrite: (opts?: { clearSelection?: boolean; openBeats?: boolean }) => void;
  children: React.ReactNode;
}

/** Active tabpanel for Write, Outline, or full-page Story Bible views (Vikini 3.0 phase 5B). */
export default function NovelcrafterViewPanel({
  view,
  ids,
  story,
  bibleNav,
  isStreaming,
  onTriggerStream,
  onReturnToWrite,
  children,
}: NovelcrafterViewPanelProps) {
  if (view === "write") {
    return (
      <div
        role="tabpanel"
        id={ids.panel("write")}
        aria-labelledby={ids.tab("write")}
        className="flex-1 min-h-0 flex flex-col"
      >
        {children}
      </div>
    );
  }

  const { activeChapter } = story;
  return (
    <div
      role="tabpanel"
      id={ids.panel(view)}
      aria-labelledby={ids.tab(view)}
      className={cn(
        "flex-1 min-h-0",
        view === "outline" ? "overflow-y-auto custom-scrollbar" : "flex flex-col"
      )}
    >
      {view === "outline" ? (
        <NovelcrafterOutlineBoard
          chapters={story.storyState.chapters}
          activeChapterId={activeChapter.id}
          onOpenChapter={(chapterId) => {
            onReturnToWrite({ clearSelection: true });
            story.selectChapter(chapterId);
          }}
          onAddChapter={story.addChapter}
        />
      ) : (
        <StoryBibleWorkspace
          storyBible={story.storyState.storyBible}
          onUpdateStoryBible={story.updateStoryBible}
          activeSection={bibleNav.section}
          jumpRequest={bibleNav.jump}
          embedded={false}
          onClose={() => onReturnToWrite()}
          isStreaming={isStreaming}
          onTriggerStream={onTriggerStream}
          onSendOutlineToChapterScenes={(beats) => {
            const sep = activeChapter.scenes.trim() ? "\n\n" : "";
            story.updateChapter(activeChapter.id, {
              scenes: `${activeChapter.scenes}${sep}${beats.trim()}`,
            });
            onReturnToWrite({ openBeats: true });
          }}
        />
      )}
    </div>
  );
}
