// /app/features/novelcrafter/components/SheetSubToolbar.tsx
"use client";

import React from "react";
import {
  Bold,
  Heading1,
  Heading2,
  History,
  Italic,
  List,
  ListOrdered,
  Maximize2,
  Minimize2,
  Minus,
  Strikethrough,
} from "lucide-react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import type { ManuscriptFormat } from "@/lib/features/novelcrafter/manuscriptMarkup";
import type { ManuscriptTypography } from "@/lib/features/novelcrafter/manuscriptTypography";
import { MAX_CHAPTER_SNAPSHOTS } from "@/lib/features/novelcrafter/types";
import { cn } from "@/lib/utils/cn";
import {
  MANUSCRIPT_SHEET_CLASS,
  MANUSCRIPT_SHEET_PADDING_CLASS,
} from "../utils/manuscriptSheetClasses";
import ManuscriptTypographyMenu from "./ManuscriptTypographyMenu";

interface SheetSubToolbarProps {
  wordCount: number;
  typography: ManuscriptTypography;
  onChangeTypography: (patch: Partial<ManuscriptTypography>) => void;
  focusMode: boolean;
  onToggleFocusMode: () => void;
  onApplyMarkdownFormat: (format: ManuscriptFormat) => void;
  snapshotsCount?: number;
  onOpenSnapshotsModal?: () => void;
}

export default function SheetSubToolbar({
  wordCount,
  typography,
  onChangeTypography,
  focusMode,
  onToggleFocusMode,
  onApplyMarkdownFormat,
  snapshotsCount = 0,
  onOpenSnapshotsModal,
}: SheetSubToolbarProps) {
  const { t } = useLanguage();

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
      className={cn(
        MANUSCRIPT_SHEET_PADDING_CLASS,
        "py-2 border-b border-(--border)/60 bg-(--surface)/40 shrink-0"
      )}
    >
      <div
        className={cn(MANUSCRIPT_SHEET_CLASS, "flex items-center justify-between gap-2 flex-wrap")}
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

          <span className="h-4 w-px bg-(--border) mx-1 shrink-0" />

          <ManuscriptTypographyMenu
            typography={typography}
            onChangeTypography={onChangeTypography}
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-(--text-secondary)">
          <span className="hidden sm:inline font-medium">
            {t("novelcrafterChapterWordsCount").replace("{count}", wordCount.toLocaleString())}
          </span>

          {onOpenSnapshotsModal && (
            <button
              type="button"
              onClick={onOpenSnapshotsModal}
              title={t("novelcrafterSnapshotsBtn")}
              aria-label={t("novelcrafterSnapshotsBtn")}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-(--border) bg-(--control-bg) hover:bg-(--control-bg-hover) text-(--text-primary) font-medium transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
            >
              <History className="w-3.5 h-3.5 text-(--accent)" />
              <span className="hidden md:inline">{t("novelcrafterSnapshotsBtn")}</span>
              <span>
                ({snapshotsCount}/{MAX_CHAPTER_SNAPSHOTS})
              </span>
            </button>
          )}

          <button
            type="button"
            aria-pressed={focusMode}
            onClick={onToggleFocusMode}
            title={t("novelcrafterFocusModeToggle")}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
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
    </div>
  );
}
