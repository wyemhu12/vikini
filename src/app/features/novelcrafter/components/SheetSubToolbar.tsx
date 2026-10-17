// /app/features/novelcrafter/components/SheetSubToolbar.tsx
"use client";

import React from "react";
import {
  Bold,
  Heading1,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Maximize2,
  Minimize2,
  Minus,
  Strikethrough,
  Type,
} from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { cn } from "@/lib/utils/cn";

export type EditorFontSizePreset = "sm" | "md" | "lg";

interface SheetSubToolbarProps {
  wordCount: number;
  fontSizePreset: EditorFontSizePreset;
  onChangeFontSizePreset: (preset: EditorFontSizePreset) => void;
  focusMode: boolean;
  onToggleFocusMode: () => void;
  onApplyMarkdownFormat: (
    format: "bold" | "italic" | "strike" | "h1" | "h2" | "ul" | "ol" | "hr"
  ) => void;
}

export default function SheetSubToolbar({
  wordCount,
  fontSizePreset,
  onChangeFontSizePreset,
  focusMode,
  onToggleFocusMode,
  onApplyMarkdownFormat,
}: SheetSubToolbarProps) {
  const { t } = useLanguage();

  const cycleFontSize = () => {
    const order: EditorFontSizePreset[] = ["sm", "md", "lg"];
    const next = order[(order.indexOf(fontSizePreset) + 1) % order.length];
    onChangeFontSizePreset(next);
  };

  const formatButtons = [
    { key: "bold", label: t("novelcrafterFormatBold"), Icon: Bold },
    { key: "italic", label: t("novelcrafterFormatItalic"), Icon: Italic },
    { key: "strike", label: t("novelcrafterFormatStrike"), Icon: Strikethrough },
    { key: "h1", label: t("novelcrafterFormatH1"), Icon: Heading1 },
    { key: "h2", label: t("novelcrafterFormatH2"), Icon: Heading2 },
    { key: "ul", label: t("novelcrafterFormatBulletList"), Icon: List },
    { key: "ol", label: t("novelcrafterFormatNumberedList"), Icon: ListOrdered },
    { key: "hr", label: t("novelcrafterFormatSceneBreak"), Icon: Minus },
  ] as const;

  return (
    <div
      data-testid="sheet-sub-toolbar"
      className="px-4 md:px-12 lg:px-16 py-2 border-b border-(--border)/60 bg-(--surface)/40 flex items-center justify-between gap-2 flex-wrap shrink-0"
    >
      <div className="flex items-center gap-1 flex-wrap">
        {formatButtons.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => onApplyMarkdownFormat(key)}
            title={label}
            aria-label={label}
            className="p-1.5 rounded-lg text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg-hover) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 text-xs text-(--text-secondary)">
        <span className="hidden sm:inline font-medium">
          {t("novelcrafterChapterWordsCount").replace("{count}", wordCount.toLocaleString())}
        </span>

        <button
          type="button"
          onClick={cycleFontSize}
          title={t("novelcrafterFontSizeLabel")}
          aria-label={t("novelcrafterFontSizeLabel")}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-(--border) bg-(--control-bg) hover:bg-(--control-bg-hover) text-(--text-primary) font-medium transition-colors focus-visible:ring-2 focus-visible:ring-(--ring)"
        >
          <Type className="w-3.5 h-3.5 text-(--accent)" />
          <span className="uppercase text-xs">{fontSizePreset}</span>
        </button>

        <button
          type="button"
          aria-pressed={focusMode}
          onClick={onToggleFocusMode}
          title={t("novelcrafterFocusModeToggle")}
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-(--ring)",
            focusMode
              ? "bg-(--accent)/15 border-(--accent) text-(--accent)"
              : "bg-(--control-bg) border-(--border) text-(--text-secondary) hover:text-(--text-primary)"
          )}
        >
          {focusMode ? (
            <Minimize2 className="w-3.5 h-3.5" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5" />
          )}
          <span className="hidden md:inline">{t("novelcrafterFocusModeToggle")}</span>
        </button>
      </div>
    </div>
  );
}
