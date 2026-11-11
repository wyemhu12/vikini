// /app/features/novelcrafter/components/NovelcrafterViewPanel.tsx
"use client";

import React, { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils/cn";
import type { NovelcrafterChapter, StoryBible } from "@/lib/features/novelcrafter/types";
import { useLanguage } from "../../chat/hooks/useLanguage";
import type { TriggerNovelcrafterStreamParams } from "../hooks/useNovelcrafterStream";
import type { NovelcrafterBibleSectionId } from "./NovelcrafterLeftNavigator";
import NovelcrafterOutlineBoard from "./NovelcrafterOutlineBoard";
import NovelcrafterOutlineDetailPanel from "./NovelcrafterOutlineDetailPanel";
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
  onStopStream?: () => void;
  onReturnToWrite: (opts?: { clearSelection?: boolean; openBeats?: boolean }) => void;
  children: React.ReactNode;
}

/** Active tabpanel for Write, Outline (+ detail panel), or Story Bible views (phase 5B–5E). */
export default function NovelcrafterViewPanel({
  view,
  ids,
  story,
  bibleNav,
  isStreaming,
  onTriggerStream,
  onStopStream = () => {},
  onReturnToWrite,
  children,
}: NovelcrafterViewPanelProps) {
  const { t } = useLanguage();
  const [isDesktopDetail, setIsDesktopDetail] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true
  );
  const [inlineDetailOpen, setInlineDetailOpen] = useState(true);
  const [sheetDetailOpen, setSheetDetailOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setIsDesktopDetail(window.innerWidth >= 1024);
    onResize();
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

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
  const chapters = story.storyState.chapters;
  const activeIndex = Math.max(
    0,
    chapters.findIndex((c) => c.id === activeChapter.id)
  );

  const handleOpenChapter = (chapterId: string) => {
    setSheetDetailOpen(false);
    onReturnToWrite({ clearSelection: true });
    story.selectChapter(chapterId);
  };

  const handleSelectOutlineChapter = (chapterId: string) => {
    story.selectChapter(chapterId);
    if (isDesktopDetail) {
      setInlineDetailOpen(true);
    } else {
      setSheetDetailOpen(true);
    }
  };

  return (
    <div
      role="tabpanel"
      id={ids.panel(view)}
      aria-labelledby={ids.tab(view)}
      className={cn(
        "flex-1 min-h-0 flex",
        view === "outline" ? "flex-row overflow-hidden" : "flex-col"
      )}
    >
      {view === "outline" ? (
        <>
          <div className="flex-1 min-w-0 min-h-0 overflow-y-auto custom-scrollbar">
            <NovelcrafterOutlineBoard
              chapters={chapters}
              activeChapterId={activeChapter.id}
              selectedChapterId={activeChapter.id}
              onSelectChapter={handleSelectOutlineChapter}
              onOpenChapter={handleOpenChapter}
              onAddChapter={story.addChapter}
            />
          </div>

          {isDesktopDetail && inlineDetailOpen && chapters.length > 0 && (
            <NovelcrafterOutlineDetailPanel
              chapter={activeChapter}
              chapterIndex={activeIndex}
              storyBible={story.storyState.storyBible}
              isStreaming={isStreaming}
              onUpdateChapter={story.updateChapter}
              onTriggerStream={onTriggerStream}
              onStopStream={onStopStream}
              onOpenChapter={handleOpenChapter}
              onClose={() => setInlineDetailOpen(false)}
            />
          )}

          {!isDesktopDetail && chapters.length > 0 && (
            <Sheet open={sheetDetailOpen} onOpenChange={setSheetDetailOpen}>
              <SheetContent side="right" className="p-0 flex flex-col">
                <SheetHeader className="sr-only">
                  <SheetTitle>
                    {t("novelcrafterOutlineDetailAria").replace(
                      "{number}",
                      String(activeIndex + 1)
                    )}
                  </SheetTitle>
                  <SheetDescription>{activeChapter.title}</SheetDescription>
                </SheetHeader>
                <NovelcrafterOutlineDetailPanel
                  chapter={activeChapter}
                  chapterIndex={activeIndex}
                  storyBible={story.storyState.storyBible}
                  isStreaming={isStreaming}
                  onUpdateChapter={story.updateChapter}
                  onTriggerStream={onTriggerStream}
                  onStopStream={onStopStream}
                  onOpenChapter={handleOpenChapter}
                  onClose={() => setSheetDetailOpen(false)}
                  isInSheet
                />
              </SheetContent>
            </Sheet>
          )}
        </>
      ) : (
        <StoryBibleWorkspace
          storyBible={story.storyState.storyBible}
          onUpdateStoryBible={story.updateStoryBible}
          chapters={chapters}
          onOpenChapter={handleOpenChapter}
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
