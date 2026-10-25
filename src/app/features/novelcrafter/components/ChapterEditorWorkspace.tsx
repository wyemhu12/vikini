// /app/features/novelcrafter/components/ChapterEditorWorkspace.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MessageSquareQuote } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { countChapterWords } from "@/lib/features/novelcrafter/draftStorage";
import type {
  NovelcrafterChapter,
  NovelcrafterFeedbackItem,
  StoryBible,
} from "@/lib/features/novelcrafter/types";
import { cn } from "@/lib/utils/cn";
import type {
  ChapterEditorController,
  FeedbackPaneControl,
} from "../hooks/useChapterEditorController";
import { useManuscriptTypography } from "../hooks/useManuscriptTypography";
import type { TriggerNovelcrafterStreamParams } from "../hooks/useNovelcrafterStream";
import {
  MANUSCRIPT_SHEET_CLASS,
  MANUSCRIPT_SHEET_PADDING_CLASS,
} from "../utils/manuscriptSheetClasses";
import ChapterDraftBeatsCard from "./ChapterDraftBeatsCard";
import ChapterEmptyStateActions from "./ChapterEmptyStateActions";
import ChapterFeedbackGutter from "./ChapterFeedbackGutter";
import ChapterManuscriptEditor from "./ChapterManuscriptEditor";
import ChapterSnapshotsModal from "./ChapterSnapshotsModal";
import InlineStoryBibleSection from "./InlineStoryBibleSection";
import type { NovelcrafterBibleSectionId } from "./NovelcrafterLeftNavigator";
import SheetSubToolbar from "./SheetSubToolbar";

export interface EditorSelectionRange {
  start: number;
  end: number;
  text: string;
}

interface ChapterEditorWorkspaceProps {
  chapter: NovelcrafterChapter;
  controller: ChapterEditorController;
  feedbackPane: FeedbackPaneControl;
  onUpdateChapter: (chapterId: string, patch: Partial<NovelcrafterChapter>) => void;
  onCreateSnapshot?: (chapterId: string, label?: string) => void;
  onRestoreSnapshot?: (chapterId: string, snapshotId: string) => void;
  onDeleteSnapshot?: (chapterId: string, snapshotId: string) => void;
  selection: EditorSelectionRange | null;
  onSelectionChange: (sel: EditorSelectionRange | null) => void;
  isStreaming: boolean;
  isDirectStreamingToChapter: boolean;
  isLoadLocked?: boolean;
  onTriggerStream: (params: TriggerNovelcrafterStreamParams) => Promise<void>;
  onStopStream: () => void;
  storyBible: StoryBible;
  onUpdateStoryBible: (patch: Partial<StoryBible>) => void;
  isStoryBibleOpen: boolean;
  onToggleStoryBible: (open: boolean) => void;
  onJumpToBibleSection?: (section: NovelcrafterBibleSectionId) => void;
  activeBibleSection?: NovelcrafterBibleSectionId;
  bibleJumpRequest?: { section: NovelcrafterBibleSectionId; nonce: number } | null;
  feedbackMode?: "inline" | "bottom-sheet";
  focusMode?: boolean;
  onToggleFocusMode?: () => void;
}

export default function ChapterEditorWorkspace({
  chapter,
  controller,
  feedbackPane,
  onUpdateChapter,
  onCreateSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot,
  selection,
  onSelectionChange,
  isStreaming,
  isDirectStreamingToChapter,
  isLoadLocked = false,
  onTriggerStream,
  onStopStream,
  storyBible,
  onUpdateStoryBible,
  isStoryBibleOpen,
  onToggleStoryBible,
  onJumpToBibleSection,
  activeBibleSection,
  bibleJumpRequest,
  feedbackMode = "inline",
  focusMode = false,
  onToggleFocusMode,
}: ChapterEditorWorkspaceProps) {
  const { t } = useLanguage();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const { typography, updateTypography } = useManuscriptTypography();

  const [titleDraft, setTitleDraft] = useState(chapter.title);
  const [snapshotsModalOpen, setSnapshotsModalOpen] = useState(false);

  useEffect(() => setTitleDraft(chapter.title), [chapter.id, chapter.title]);

  const wordCount = useMemo(() => countChapterWords(chapter.content), [chapter.content]);

  const handleTitleBlur = () => {
    const trimmed = titleDraft.trim();
    if (!trimmed) return setTitleDraft(chapter.title);
    if (trimmed !== chapter.title) onUpdateChapter(chapter.id, { title: trimmed });
  };

  const renderGutter = (isInSheet: boolean) => (
    <ChapterFeedbackGutter
      feedbackItems={controller.feedbackItems as NovelcrafterFeedbackItem[]}
      chapterContent={chapter.content}
      activeFeedbackId={controller.activeFeedbackId}
      onSelectFeedback={controller.jumpToFeedbackQuote}
      onAcceptSuggestion={controller.handleAcceptSuggestion}
      onDismissFeedback={controller.handleDismissFeedback}
      onRateFeedback={(itemId, rating) => {
        if (rating) controller.handleRateFeedback(itemId, rating);
      }}
      onReplyFeedback={controller.handleReplyFeedback}
      onResolveAll={controller.handleResolveAllFeedback}
      onClearAll={controller.handleClearAllFeedback}
      isInSheet={isInSheet}
    />
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-(--surface)">
      <div className="flex-1 min-h-0 mx-2 md:mx-4 my-2 md:my-3 rounded-2xl border border-(--border) bg-(--surface-elevated)/35 flex flex-col lg:flex-row overflow-hidden shadow-xs">
        <div
          ref={scrollContainerRef}
          className="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col pb-[var(--nc-kb-offset,0px)]"
        >
          <SheetSubToolbar
            wordCount={wordCount}
            typography={typography}
            onChangeTypography={updateTypography}
            focusMode={focusMode}
            onToggleFocusMode={() => onToggleFocusMode?.()}
            onApplyMarkdownFormat={(fmt) => controller.editorHandleRef.current?.applyFormat(fmt)}
            snapshotsCount={(chapter.snapshots ?? []).length}
            onOpenSnapshotsModal={() => setSnapshotsModalOpen(true)}
          />

          {isDirectStreamingToChapter && (
            <div className={cn(MANUSCRIPT_SHEET_PADDING_CLASS, "mt-4 shrink-0")}>
              <div
                className={cn(
                  MANUSCRIPT_SHEET_CLASS,
                  "px-3.5 py-2 rounded-xl border border-(--accent)/40 bg-(--accent)/10 flex items-center justify-between gap-2 text-xs font-medium text-(--accent)"
                )}
              >
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span>{t("novelcrafterDirectStreamingBanner")}</span>
                </span>
                <button
                  type="button"
                  onClick={onStopStream}
                  className="px-2.5 py-0.5 rounded-md bg-(--danger) text-(--danger-foreground) font-semibold"
                >
                  {t("stopBtn")}
                </button>
              </div>
            </div>
          )}

          <div className={cn(MANUSCRIPT_SHEET_PADDING_CLASS, "pt-5 pb-2.5 shrink-0")}>
            <div className={MANUSCRIPT_SHEET_CLASS}>
              <input
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                aria-label={t("novelcrafterRenameChapter")}
                className="w-full bg-transparent text-[22px] md:text-[24px] font-semibold leading-[1.3] tracking-[-0.015em] text-(--text-primary) placeholder:text-(--text-secondary) border-b border-transparent hover:border-(--border) focus:border-(--accent) focus:outline-none pb-1 transition-colors"
              />
            </div>
          </div>

          <ChapterDraftBeatsCard
            isOpen={controller.beatsOpen}
            onClose={() => controller.setBeatsOpen(false)}
            scenes={chapter.scenes}
            onChangeScenes={(val) => onUpdateChapter(chapter.id, { scenes: val })}
            extraInstructions={chapter.extraInstructions ?? ""}
            onChangeExtraInstructions={(val) =>
              onUpdateChapter(chapter.id, { extraInstructions: val })
            }
            summary={chapter.summary ?? ""}
            onChangeSummary={(val) => onUpdateChapter(chapter.id, { summary: val })}
            canSummarizeChapter={Boolean(chapter.content.trim() || chapter.scenes.trim())}
            onSummarizeChapter={() => {
              if (isStreaming || isLoadLocked) return;
              void onTriggerStream({
                feature: "bible",
                bibleTarget: "chapter_summary",
                actionMode: (chapter.summary ?? "").trim() ? "rewrite" : "generate",
                subLabel: t("novelcrafterSummarizeChapterBtn"),
              });
            }}
            isStreaming={isStreaming || Boolean(isLoadLocked)}
            onGenerateBeats={() => {
              if (isStreaming || isLoadLocked) return;
              void onTriggerStream({
                feature: "bible",
                bibleTarget: "scenes",
                actionMode: "generate",
                subLabel: t("novelcrafterGenerateBeatsBtn"),
              });
            }}
            onRewriteBeats={() => {
              if (isStreaming || isLoadLocked) return;
              void onTriggerStream({
                feature: "bible",
                bibleTarget: "scenes",
                actionMode: "rewrite",
                subLabel: t("novelcrafterRewriteBeatsBtn"),
              });
            }}
            onRunFirstDraft={controller.handleRunFirstDraft}
          />

          {chapter.content.trim().length === 0 && !isStreaming && !isLoadLocked && (
            <ChapterEmptyStateActions
              disabled={isStreaming || Boolean(isLoadLocked)}
              onAutoWriteOpening={() => {
                if (isStreaming || isLoadLocked) return;
                void onTriggerStream({
                  feature: "write",
                  writeMode: "auto",
                  subLabel: t("novelcrafterEmptyActionAutoWrite"),
                });
              }}
              onSuggestThreeOpenings={() => {
                if (isStreaming || isLoadLocked) return;
                void onTriggerStream({
                  feature: "write",
                  writeMode: "openings_3",
                  subLabel: t("novelcrafterEmptyActionOpenings3"),
                });
              }}
              onRoughDraftFromBeats={() => {
                if (isStreaming || isLoadLocked) return;
                void onTriggerStream({
                  feature: "write",
                  writeMode: "first_draft_rough",
                  subLabel: t("novelcrafterEmptyActionRoughDraft"),
                });
              }}
            />
          )}

          {controller.activeFeedbackItem && controller.activeFeedbackItem.quote && (
            <div className={cn(MANUSCRIPT_SHEET_PADDING_CLASS, "pb-2 shrink-0")}>
              <button
                type="button"
                onClick={() =>
                  controller.activeFeedbackItem &&
                  controller.jumpToFeedbackQuote(controller.activeFeedbackItem)
                }
                className={cn(
                  MANUSCRIPT_SHEET_CLASS,
                  "text-left rounded-xl bg-(--warning)/15 border-l-2 border-(--warning) px-3.5 py-2 flex items-center justify-between gap-2 text-xs text-(--text-primary) hover:bg-(--warning)/20 transition-colors"
                )}
              >
                <span className="inline-flex items-center gap-2 min-w-0 truncate">
                  <MessageSquareQuote className="w-3.5 h-3.5 text-(--warning) shrink-0" />
                  <span className="font-semibold uppercase text-(--warning)">
                    [{controller.activeFeedbackItem.category}]
                  </span>
                  <span className="truncate italic">
                    &ldquo;{controller.activeFeedbackItem.quote}&rdquo;
                  </span>
                </span>
                <span className="text-xs font-semibold text-(--accent) shrink-0">
                  {t("novelcrafterExcerptLocatorJump")}
                </span>
              </button>
            </div>
          )}

          <div className={cn(MANUSCRIPT_SHEET_PADDING_CLASS, "pb-6 flex flex-col")}>
            <ChapterManuscriptEditor
              ref={controller.editorHandleRef}
              chapterId={chapter.id}
              content={chapter.content}
              readOnly={isDirectStreamingToChapter || Boolean(isLoadLocked)}
              typography={typography}
              feedbackItems={controller.feedbackItems}
              activeFeedbackId={controller.activeFeedbackId}
              storyBible={storyBible}
              selection={selection}
              onChangeContent={(next) => onUpdateChapter(chapter.id, { content: next })}
              onSelectionChange={onSelectionChange}
              onFeedbackMarkClick={controller.selectFeedbackById}
              onOpenCodexEntity={(kind) =>
                onJumpToBibleSection?.(kind === "character" ? "characters" : "worldbuilding")
              }
              bubble={{
                disabled: isStreaming || Boolean(isLoadLocked),
                onRewrite: (mode, label) => controller.handleRunRewrite(mode, label),
                onDescribe: (label) => controller.handleRunExpand("describe", label),
                onExpand: (label) => controller.handleRunExpand("expand", label),
                onFeedback: controller.handleRunLineFeedback,
                quickEdit: controller.quickEdit,
              }}
              placeholder={t("novelcrafterChapterEditorPlaceholder")}
              ariaLabel={chapter.title}
              scrollContainerRef={scrollContainerRef}
              feedbackMode={feedbackMode}
            />

            <InlineStoryBibleSection
              isOpen={isStoryBibleOpen}
              onToggle={() => onToggleStoryBible(!isStoryBibleOpen)}
              storyBible={storyBible}
              onUpdateStoryBible={onUpdateStoryBible}
              activeSection={activeBibleSection}
              jumpRequest={bibleJumpRequest}
              isStreaming={isStreaming || Boolean(isLoadLocked)}
              onTriggerStream={onTriggerStream}
              onSendOutlineToChapterScenes={(beats) => {
                const sep = chapter.scenes.trim() ? "\n\n" : "";
                onUpdateChapter(chapter.id, { scenes: `${chapter.scenes}${sep}${beats.trim()}` });
                controller.setBeatsOpen(true);
              }}
            />
          </div>
        </div>

        {feedbackPane.isOpen && feedbackMode === "inline" && renderGutter(false)}
        {feedbackMode === "bottom-sheet" && (
          <Sheet
            open={feedbackPane.isOpen}
            onOpenChange={(open) => (open ? feedbackPane.open() : feedbackPane.close())}
          >
            <SheetContent side="bottom" className="p-0 flex flex-col">
              <SheetHeader className="sr-only">
                <SheetTitle>{t("novelcrafterFeedbackDrawerTitle")}</SheetTitle>
                <SheetDescription>{t("novelcrafterFeedbackSheetDesc")}</SheetDescription>
              </SheetHeader>
              {renderGutter(true)}
            </SheetContent>
          </Sheet>
        )}
      </div>

      <ChapterSnapshotsModal
        isOpen={snapshotsModalOpen}
        onClose={() => setSnapshotsModalOpen(false)}
        chapterTitle={chapter.title}
        currentContent={chapter.content}
        snapshots={chapter.snapshots ?? []}
        onCreateSnapshot={(label) => onCreateSnapshot?.(chapter.id, label)}
        onRestoreSnapshot={(snapId) => onRestoreSnapshot?.(chapter.id, snapId)}
        onDeleteSnapshot={(snapId) => onDeleteSnapshot?.(chapter.id, snapId)}
      />
    </div>
  );
}
