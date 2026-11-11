// /app/features/novelcrafter/components/NovelcrafterWriteStage.tsx
"use client";

import React, { useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { CatalogItemSummary } from "@/lib/features/novelcrafter/aiInheritanceTable";
import { parseSceneBeats } from "@/lib/features/novelcrafter/chapterOutline";
import type {
  NovelcrafterBibleTarget,
  NovelcrafterChapter,
  NovelcrafterHistoryCard,
  NovelcrafterRoutingConfig,
  StoryBible,
} from "@/lib/features/novelcrafter/types";
import { useLanguage } from "../../chat/hooks/useLanguage";
import type {
  ChapterEditorController,
  FeedbackPaneControl,
} from "../hooks/useChapterEditorController";
import type {
  StreamingCardMeta,
  TriggerNovelcrafterStreamParams,
} from "../hooks/useNovelcrafterStream";
import ChapterAiToolbar from "./ChapterAiToolbar";
import ChapterEditorWorkspace, { type EditorSelectionRange } from "./ChapterEditorWorkspace";
import NovelcrafterAiComposer from "./NovelcrafterAiComposer";
import NovelcrafterHistoryPane from "./NovelcrafterHistoryPane";
import NovelcrafterLeftNavigator, {
  type NovelcrafterBibleSectionId,
} from "./NovelcrafterLeftNavigator";
import { NovelcrafterMobileAiDock, NovelcrafterMobileBeatBar } from "./NovelcrafterMobileAiDock";

interface NovelcrafterWriteStageProps {
  chapters: NovelcrafterChapter[];
  activeChapter: NovelcrafterChapter;
  storyBible: StoryBible;
  isStoryBibleOpen: boolean;
  onToggleStoryBible: (open: boolean) => void;
  activeBibleSection: NovelcrafterBibleSectionId;
  bibleJumpRequest: { section: NovelcrafterBibleSectionId; nonce: number } | null;
  onJumpToBibleSection: (section: NovelcrafterBibleSectionId) => void;
  onSelectChapter: (chapterId: string) => void;
  onAddChapter: () => void;
  onUpdateChapter: (chapterId: string, patch: Partial<NovelcrafterChapter>) => void;
  onDeleteChapter: (chapterId: string) => void;
  onUpdateStoryBible: (patch: Partial<StoryBible>) => void;
  onCreateSnapshot: (chapterId: string, label?: string) => void;
  onRestoreSnapshot: (chapterId: string, snapshotId: string) => void;
  onDeleteSnapshot: (chapterId: string, snapshotId: string) => void;
  editor: ChapterEditorController;
  feedbackPane: FeedbackPaneControl;
  feedbackMode: "inline" | "bottom-sheet";
  focusMode: boolean;
  onToggleFocusMode: () => void;
  selection: EditorSelectionRange | null;
  onSelectionChange: (sel: EditorSelectionRange | null) => void;
  isLeftInline: boolean;
  isRightInline: boolean;
  showLeftPane: boolean;
  showRightPane: boolean;
  onOpenPane: (pane: "navigator" | "history") => void;
  onClosePane: (pane: "navigator" | "history") => void;
  historyCards: NovelcrafterHistoryCard[];
  isStreaming: boolean;
  isDirectStreamingToChapter: boolean;
  isLoadLocked: boolean;
  streamingContent: string;
  streamingThinking: string;
  streamingMeta: StreamingCardMeta | null;
  onTriggerStream: (params: TriggerNovelcrafterStreamParams) => Promise<void>;
  onStopStream: () => void;
  onAppendToChapter: (text: string) => void;
  onReplaceSelection: (text: string) => void;
  onApplyToBible: (target: NovelcrafterBibleTarget, text: string) => void;
  onDeleteCard: (cardId: string) => void;
  onClearAllCards: () => void;
  selectedModel: string;
  allowedModelIds?: ReadonlySet<string>;
  routing: NovelcrafterRoutingConfig;
  gems: readonly CatalogItemSummary[];
  personas: readonly CatalogItemSummary[];
  onOpenAiSettings: () => void;
}

/** Write view stage combining desktop toolbar, mobile beat bar/dock, 3 panes & AI composer (5E). */
export default function NovelcrafterWriteStage({
  chapters,
  activeChapter,
  storyBible,
  isStoryBibleOpen,
  onToggleStoryBible,
  activeBibleSection,
  bibleJumpRequest,
  onJumpToBibleSection,
  onSelectChapter,
  onAddChapter,
  onUpdateChapter,
  onDeleteChapter,
  onUpdateStoryBible,
  onCreateSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot,
  editor,
  feedbackPane,
  feedbackMode,
  focusMode,
  onToggleFocusMode,
  selection,
  onSelectionChange,
  isLeftInline,
  isRightInline,
  showLeftPane,
  showRightPane,
  onOpenPane,
  onClosePane,
  historyCards,
  isStreaming,
  isDirectStreamingToChapter,
  isLoadLocked,
  streamingContent,
  streamingThinking,
  streamingMeta,
  onTriggerStream,
  onStopStream,
  onAppendToChapter,
  onReplaceSelection,
  onApplyToBible,
  onDeleteCard,
  onClearAllCards,
  selectedModel,
  allowedModelIds,
  routing,
  gems,
  personas,
  onOpenAiSettings,
}: NovelcrafterWriteStageProps) {
  const { t } = useLanguage();
  const hasActiveSelection = Boolean(selection && selection.text.length > 0);
  const sceneBeats = useMemo(() => parseSceneBeats(activeChapter.scenes), [activeChapter.scenes]);

  const renderNavigator = (isInSheet: boolean) => (
    <NovelcrafterLeftNavigator
      isStoryBibleOpen={isStoryBibleOpen}
      onToggleStoryBible={onToggleStoryBible}
      activeBibleSection={activeBibleSection}
      onJumpToBibleSection={onJumpToBibleSection}
      chapters={chapters}
      activeChapterId={activeChapter.id}
      onSelectChapter={(chId) => {
        onSelectionChange(null);
        onSelectChapter(chId);
        if (isInSheet) onClosePane("navigator");
      }}
      onAddChapter={onAddChapter}
      onRenameChapter={(chapterId, title) => onUpdateChapter(chapterId, { title })}
      onDeleteChapter={onDeleteChapter}
      isInSheet={isInSheet}
    />
  );

  const renderHistory = (isInSheet: boolean) => (
    <NovelcrafterHistoryPane
      historyCards={historyCards}
      activeChapterId={activeChapter.id}
      isStreaming={isStreaming}
      streamingContent={streamingContent}
      streamingThinking={streamingThinking}
      streamingMeta={streamingMeta}
      hasActiveSelection={hasActiveSelection}
      onAppendToChapter={onAppendToChapter}
      onReplaceSelection={onReplaceSelection}
      onApplyToBible={onApplyToBible}
      onDeleteCard={onDeleteCard}
      onClearAllCards={onClearAllCards}
      isInSheet={isInSheet}
      composer={
        <NovelcrafterAiComposer
          isStreaming={isStreaming}
          hasActiveSelection={hasActiveSelection}
          selectedText={selection?.text}
          selectedModel={selectedModel}
          allowedModelIds={allowedModelIds}
          routing={routing}
          gems={gems}
          personas={personas}
          onTriggerStream={onTriggerStream}
          onStopStream={onStopStream}
          onOpenAiSettings={() => {
            if (isInSheet) onClosePane("history");
            onOpenAiSettings();
          }}
        />
      }
    />
  );

  const renderDrawer = (pane: "navigator" | "history") => {
    const isNav = pane === "navigator";
    return (
      <Sheet
        open={isNav ? showLeftPane : showRightPane}
        onOpenChange={(open) => (open ? onOpenPane(pane) : onClosePane(pane))}
      >
        <SheetContent side={isNav ? "left" : "right"} className="p-0 flex flex-col">
          <SheetHeader className="sr-only">
            <SheetTitle>
              {t(isNav ? "novelcrafterChaptersTab" : "novelcrafterHistoryTitle")}
            </SheetTitle>
            <SheetDescription>
              {t(isNav ? "novelcrafterNavigatorSheetDesc" : "novelcrafterHistorySheetDesc")}
            </SheetDescription>
          </SheetHeader>
          {isNav ? renderNavigator(true) : renderHistory(true)}
        </SheetContent>
      </Sheet>
    );
  };

  return (
    <>
      <div className="hidden md:block shrink-0">
        <ChapterAiToolbar {...editor.toolbarProps} onStopStream={onStopStream} />
      </div>

      <NovelcrafterMobileBeatBar
        beats={sceneBeats}
        onToggleBeats={() => editor.setBeatsOpen(!editor.beatsOpen)}
      />

      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
        {isLeftInline ? showLeftPane && renderNavigator(false) : renderDrawer("navigator")}

        <ChapterEditorWorkspace
          chapter={activeChapter}
          controller={editor}
          feedbackPane={feedbackPane}
          onUpdateChapter={onUpdateChapter}
          onCreateSnapshot={onCreateSnapshot}
          onRestoreSnapshot={onRestoreSnapshot}
          onDeleteSnapshot={onDeleteSnapshot}
          selection={selection}
          onSelectionChange={onSelectionChange}
          isStreaming={isStreaming}
          isDirectStreamingToChapter={isDirectStreamingToChapter}
          isLoadLocked={isLoadLocked}
          onTriggerStream={onTriggerStream}
          onStopStream={onStopStream}
          storyBible={storyBible}
          onUpdateStoryBible={onUpdateStoryBible}
          isStoryBibleOpen={isStoryBibleOpen}
          onToggleStoryBible={onToggleStoryBible}
          onJumpToBibleSection={onJumpToBibleSection}
          activeBibleSection={activeBibleSection}
          bibleJumpRequest={bibleJumpRequest}
          feedbackMode={feedbackMode}
          focusMode={focusMode}
          onToggleFocusMode={onToggleFocusMode}
        />

        {isRightInline ? showRightPane && renderHistory(false) : renderDrawer("history")}
      </div>

      <NovelcrafterMobileAiDock
        isStreaming={isStreaming}
        historyCount={historyCards.length}
        onRunAutoWrite={() => {
          if (isStreaming || isLoadLocked) return;
          void onTriggerStream({
            feature: "write",
            writeMode: "auto",
            subLabel: t("novelcrafterWriteAuto"),
          });
        }}
        onStopStream={onStopStream}
        onRunRewriteSelection={() =>
          editor.handleRunRewrite("rephrase", t("novelcrafterRewriteRephrase"))
        }
        onRunBrainstorm={() => {
          onOpenPane("history");
          editor.toolbarProps.onRunBrainstorm("plot_twists", t("novelcrafterMobileBrainstormAria"));
        }}
        onOpenHistoryDrawer={() => onOpenPane("history")}
      />
    </>
  );
}
