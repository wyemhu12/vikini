// /app/features/novelcrafter/components/ChapterEditorWorkspace.tsx
"use client";

import React, { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Expand,
  Lightbulb,
  ListOrdered,
  PenTool,
  RefreshCw,
  Sparkles,
  Square,
  Wand2,
} from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { toast } from "@/lib/store/toastStore";
import { cn } from "@/lib/utils/cn";
import { TRANSITION } from "@/lib/utils/motion";
import type {
  NovelcrafterBrainstormCategory,
  NovelcrafterChapter,
  NovelcrafterExpandMode,
  NovelcrafterRewriteMode,
  NovelcrafterWriteMode,
} from "@/lib/features/novelcrafter/types";
import type { TriggerNovelcrafterStreamParams } from "../hooks/useNovelcrafterStream";

export interface EditorSelectionRange {
  start: number;
  end: number;
  text: string;
}

interface ChapterEditorWorkspaceProps {
  chapter: NovelcrafterChapter;
  onUpdateChapter: (
    chapterId: string,
    patch: Partial<Pick<NovelcrafterChapter, "title" | "scenes" | "content">>
  ) => void;
  selection: EditorSelectionRange | null;
  onSelectionChange: (sel: EditorSelectionRange | null) => void;
  isStreaming: boolean;
  onTriggerStream: (params: TriggerNovelcrafterStreamParams) => Promise<void>;
  onStopStream: () => void;
}

type ActiveToolMenu = "write" | "rewrite" | "expand" | "brainstorm" | null;

export default function ChapterEditorWorkspace({
  chapter,
  onUpdateChapter,
  selection,
  onSelectionChange,
  isStreaming,
  onTriggerStream,
  onStopStream,
}: ChapterEditorWorkspaceProps) {
  const { t } = useLanguage();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [beatsOpen, setBeatsOpen] = useState(true);
  const [activeMenu, setActiveMenu] = useState<ActiveToolMenu>(null);
  const [guidedDirection, setGuidedDirection] = useState("");
  const [customRewritePrompt, setCustomRewritePrompt] = useState("");
  const [brainstormTopic, setBrainstormTopic] = useState("");

  const handleSelectText = () => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    if (end > start) {
      onSelectionChange({
        start,
        end,
        text: el.value.slice(start, end),
      });
    } else {
      onSelectionChange(null);
    }
  };

  const requireSelectionText = (): string | null => {
    const selected = selection?.text?.trim() || "";
    if (!selected) {
      toast.info(t("novelcrafterSelectTextHint"));
      return null;
    }
    return selected;
  };

  const runWrite = (mode: NovelcrafterWriteMode) => {
    void onTriggerStream({
      feature: "write",
      writeMode: mode,
      customInstruction: mode === "guided" ? guidedDirection.trim() : "",
      subLabel: mode === "guided" ? t("novelcrafterWriteGuided") : t("novelcrafterWriteAuto"),
    });
    setActiveMenu(null);
  };

  const runRewrite = (mode: NovelcrafterRewriteMode, label: string) => {
    const selected = requireSelectionText();
    if (!selected) return;
    void onTriggerStream({
      feature: "rewrite",
      rewriteMode: mode,
      selectedText: selected,
      customInstruction: mode === "custom" ? customRewritePrompt.trim() : "",
      subLabel: label,
    });
    setActiveMenu(null);
  };

  const runExpand = (mode: NovelcrafterExpandMode, label: string) => {
    const selected = requireSelectionText();
    if (!selected) return;
    void onTriggerStream({
      feature: "expand",
      expandMode: mode,
      selectedText: selected,
      subLabel: label,
    });
    setActiveMenu(null);
  };

  const runBrainstorm = (category: NovelcrafterBrainstormCategory, label: string) => {
    void onTriggerStream({
      feature: "brainstorm",
      brainstormCategory: category,
      customInstruction: brainstormTopic.trim(),
      subLabel: label,
    });
    setActiveMenu(null);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-(--surface)">
      {/* Sudowrite AI Toolbar */}
      <div className="shrink-0 border-b border-(--border) bg-(--surface-muted)/50 px-4 py-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Slot 2: Write */}
            <button
              type="button"
              disabled={isStreaming}
              aria-pressed={activeMenu === "write"}
              onClick={() => setActiveMenu(activeMenu === "write" ? null : "write")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
                activeMenu === "write"
                  ? "bg-(--accent) text-(--accent-foreground) border-(--accent)"
                  : "bg-(--control-bg) hover:bg-(--control-bg-hover) border-(--control-border) text-(--text-primary)"
              )}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>{t("novelcrafterSlotWrite")}</span>
            </button>

            {/* Slot 3: Rewrite */}
            <button
              type="button"
              disabled={isStreaming}
              aria-pressed={activeMenu === "rewrite"}
              onClick={() => setActiveMenu(activeMenu === "rewrite" ? null : "rewrite")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
                activeMenu === "rewrite"
                  ? "bg-(--accent) text-(--accent-foreground) border-(--accent)"
                  : "bg-(--control-bg) hover:bg-(--control-bg-hover) border-(--control-border) text-(--text-primary)"
              )}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{t("novelcrafterSlotRewrite")}</span>
            </button>

            {/* Slot 4: Expand & Describe */}
            <button
              type="button"
              disabled={isStreaming}
              aria-pressed={activeMenu === "expand"}
              onClick={() => setActiveMenu(activeMenu === "expand" ? null : "expand")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
                activeMenu === "expand"
                  ? "bg-(--accent) text-(--accent-foreground) border-(--accent)"
                  : "bg-(--control-bg) hover:bg-(--control-bg-hover) border-(--control-border) text-(--text-primary)"
              )}
            >
              <Expand className="w-3.5 h-3.5" />
              <span>{t("novelcrafterSlotExpand")}</span>
            </button>

            {/* Slot 5: Brainstorm */}
            <button
              type="button"
              disabled={isStreaming}
              aria-pressed={activeMenu === "brainstorm"}
              onClick={() => setActiveMenu(activeMenu === "brainstorm" ? null : "brainstorm")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
                activeMenu === "brainstorm"
                  ? "bg-(--accent) text-(--accent-foreground) border-(--accent)"
                  : "bg-(--control-bg) hover:bg-(--control-bg-hover) border-(--control-border) text-(--text-primary)"
              )}
            >
              <Lightbulb className="w-3.5 h-3.5" />
              <span>{t("novelcrafterSlotBrainstorm")}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {selection && selection.text.length > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-(--accent)/15 text-(--accent) border border-(--accent)/30 font-medium">
                {t("novelcrafterSelectedChars").replace("{count}", String(selection.text.length))}
              </span>
            )}

            {isStreaming && (
              <button
                type="button"
                onClick={onStopStream}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-(--danger) text-(--danger-foreground) hover:bg-(--danger-hover) text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
              >
                <Square className="w-3.5 h-3.5" />
                <span>{t("stopBtn")}</span>
              </button>
            )}
          </div>
        </div>

        {/* Sub-menus for active AI tool */}
        {activeMenu === "write" && (
          <div className="pt-2 border-t border-(--border) flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button
              type="button"
              onClick={() => runWrite("auto")}
              className="px-3 py-1.5 rounded-lg bg-(--accent) text-(--accent-foreground) hover:brightness-110 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-(--ring) shrink-0"
            >
              {t("novelcrafterWriteAuto")}
            </button>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <input
                type="text"
                value={guidedDirection}
                onChange={(e) => setGuidedDirection(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") runWrite("guided");
                }}
                placeholder={t("novelcrafterGuidedPromptPlaceholder")}
                aria-label={t("novelcrafterGuidedPromptPlaceholder")}
                className="flex-1 min-w-0 h-8 rounded-lg border border-(--control-border) bg-(--control-bg) px-3 text-xs text-(--text-primary) placeholder:text-(--text-secondary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
              />
              <button
                type="button"
                onClick={() => runWrite("guided")}
                className="px-3 py-1.5 rounded-lg border border-(--control-border) bg-(--control-bg) hover:bg-(--control-bg-hover) text-xs font-semibold text-(--text-primary) focus-visible:ring-2 focus-visible:ring-(--ring) shrink-0"
              >
                {t("novelcrafterWriteGuided")}
              </button>
            </div>
          </div>
        )}

        {activeMenu === "rewrite" && (
          <div className="pt-2 border-t border-(--border) space-y-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  ["rephrase", t("novelcrafterRewriteRephrase")],
                  ["shorter", t("novelcrafterRewriteShorter")],
                  ["more_descriptive", t("novelcrafterRewriteMoreDescriptive")],
                  ["show_dont_tell", t("novelcrafterRewriteShowDontTell")],
                  ["more_inner_conflict", t("novelcrafterRewriteInnerConflict")],
                ] as const
              ).map(([modeKey, modeLabel]) => (
                <button
                  key={modeKey}
                  type="button"
                  onClick={() => runRewrite(modeKey, modeLabel)}
                  className="px-2.5 py-1.5 rounded-lg border border-(--control-border) bg-(--control-bg) hover:bg-(--control-bg-hover) text-xs font-medium text-(--text-primary) focus-visible:ring-2 focus-visible:ring-(--ring)"
                >
                  {modeLabel}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customRewritePrompt}
                onChange={(e) => setCustomRewritePrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    runRewrite("custom", t("novelcrafterRewriteCustom"));
                  }
                }}
                placeholder={t("novelcrafterRewriteInstructionPlaceholder")}
                aria-label={t("novelcrafterRewriteInstructionPlaceholder")}
                className="flex-1 min-w-0 h-8 rounded-lg border border-(--control-border) bg-(--control-bg) px-3 text-xs text-(--text-primary) placeholder:text-(--text-secondary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
              />
              <button
                type="button"
                onClick={() => runRewrite("custom", t("novelcrafterRewriteCustom"))}
                className="px-3 py-1.5 rounded-lg bg-(--accent) text-(--accent-foreground) hover:brightness-110 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-(--ring) shrink-0"
              >
                {t("novelcrafterRewriteCustom")}
              </button>
            </div>
          </div>
        )}

        {activeMenu === "expand" && (
          <div className="pt-2 border-t border-(--border) flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => runExpand("expand", t("novelcrafterExpandPassage"))}
              className="px-3 py-1.5 rounded-lg bg-(--accent) text-(--accent-foreground) hover:brightness-110 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-(--ring)"
            >
              {t("novelcrafterExpandPassage")}
            </button>
            <button
              type="button"
              onClick={() => runExpand("describe", t("novelcrafterDescribeAll"))}
              className="px-3 py-1.5 rounded-lg border border-(--control-border) bg-(--control-bg) hover:bg-(--control-bg-hover) text-xs font-semibold text-(--text-primary) focus-visible:ring-2 focus-visible:ring-(--ring)"
            >
              {t("novelcrafterDescribeAll")}
            </button>
          </div>
        )}

        {activeMenu === "brainstorm" && (
          <div className="pt-2 border-t border-(--border) space-y-2">
            <input
              type="text"
              value={brainstormTopic}
              onChange={(e) => setBrainstormTopic(e.target.value)}
              placeholder={t("novelcrafterBrainstormTopicPlaceholder")}
              aria-label={t("novelcrafterBrainstormTopicPlaceholder")}
              className="w-full h-8 rounded-lg border border-(--control-border) bg-(--control-bg) px-3 text-xs text-(--text-primary) placeholder:text-(--text-secondary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
            />
            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  ["plot_twists", t("novelcrafterBrainstormTwists")],
                  ["character_names", t("novelcrafterBrainstormNames")],
                  ["world_objects", t("novelcrafterBrainstormWorld")],
                  ["dialogue", t("novelcrafterBrainstormDialogue")],
                  ["scene_ideas", t("novelcrafterBrainstormScenes")],
                ] as const
              ).map(([catKey, catLabel]) => (
                <button
                  key={catKey}
                  type="button"
                  onClick={() => runBrainstorm(catKey, catLabel)}
                  className="px-2.5 py-1.5 rounded-lg border border-(--control-border) bg-(--control-bg) hover:bg-(--control-bg-hover) text-xs font-medium text-(--text-primary) focus-visible:ring-2 focus-visible:ring-(--ring)"
                >
                  {catLabel}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Scrollable Chapter Area */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-4 space-y-4 flex flex-col custom-scrollbar">
        {/* Collapsible Scenes (Chapter Beats) Card */}
        <section className="rounded-2xl border border-(--border) bg-(--surface-elevated)/70 p-3.5 shrink-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <button
              type="button"
              aria-expanded={beatsOpen}
              onClick={() => setBeatsOpen(!beatsOpen)}
              className="flex items-center gap-2 text-xs md:text-sm font-bold text-(--text-primary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none rounded-lg"
            >
              <ListOrdered className="w-4 h-4 text-(--accent)" />
              <span>{t("novelcrafterChapterBeatsLabel")}</span>
              {beatsOpen ? (
                <ChevronUp className="w-4 h-4 text-(--text-secondary)" />
              ) : (
                <ChevronDown className="w-4 h-4 text-(--text-secondary)" />
              )}
            </button>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                disabled={isStreaming}
                onClick={() =>
                  void onTriggerStream({
                    feature: "bible",
                    bibleTarget: "scenes",
                    actionMode: "generate",
                    subLabel: t("novelcrafterGenerateBeatsBtn"),
                  })
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-(--control-bg) hover:bg-(--control-bg-hover) border border-(--control-border) text-xs font-medium text-(--text-primary) disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-(--ring)"
              >
                <Wand2 className="w-3.5 h-3.5 text-(--accent)" />
                <span>{t("novelcrafterGenerateBeatsBtn")}</span>
              </button>

              <button
                type="button"
                disabled={isStreaming}
                onClick={() =>
                  void onTriggerStream({
                    feature: "bible",
                    bibleTarget: "scenes",
                    actionMode: "rewrite",
                    subLabel: t("novelcrafterRewriteBeatsBtn"),
                  })
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-(--control-bg) hover:bg-(--control-bg-hover) border border-(--control-border) text-xs font-medium text-(--text-primary) disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-(--ring)"
              >
                <RefreshCw className="w-3.5 h-3.5 text-(--text-secondary)" />
                <span>{t("novelcrafterRewriteBeatsBtn")}</span>
              </button>

              <button
                type="button"
                disabled={isStreaming}
                onClick={() =>
                  void onTriggerStream({
                    feature: "bible",
                    bibleTarget: "draft",
                    actionMode: "generate",
                    subLabel: t("novelcrafterGenerateDraftBtn"),
                  })
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-(--accent) text-(--accent-foreground) hover:brightness-110 text-xs font-semibold disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-(--ring)"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t("novelcrafterGenerateDraftBtn")}</span>
              </button>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {beatsOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={TRANSITION.FAST}
                className="overflow-hidden"
              >
                <textarea
                  rows={4}
                  value={chapter.scenes}
                  onChange={(e) => onUpdateChapter(chapter.id, { scenes: e.target.value })}
                  placeholder={t("novelcrafterChapterBeatsPlaceholder")}
                  aria-label={t("novelcrafterChapterBeatsLabel")}
                  className="mt-3 w-full rounded-xl border border-(--control-border) bg-(--surface) p-3 text-xs md:text-sm text-(--text-primary) placeholder:text-(--text-secondary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none resize-y"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Chapter Prose Editor */}
        <div className="flex-1 min-h-[360px] flex flex-col">
          <textarea
            ref={textareaRef}
            value={chapter.content}
            onChange={(e) => onUpdateChapter(chapter.id, { content: e.target.value })}
            onSelect={handleSelectText}
            onKeyUp={handleSelectText}
            onMouseUp={handleSelectText}
            placeholder={t("novelcrafterChapterEditorPlaceholder")}
            aria-label={chapter.title}
            className="flex-1 w-full rounded-2xl border border-(--control-border) bg-(--surface-elevated)/40 p-4 md:p-6 text-sm md:text-base leading-relaxed text-(--text-primary) placeholder:text-(--text-secondary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none resize-none custom-scrollbar"
          />
        </div>
      </div>
    </div>
  );
}
