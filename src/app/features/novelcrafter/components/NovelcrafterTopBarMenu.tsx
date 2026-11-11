// /app/features/novelcrafter/components/NovelcrafterTopBarMenu.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { FileCode2, FileText, Globe, MoreHorizontal, Palette, ScrollText } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "../../chat/hooks/useLanguage";
import ThemeMenuItems from "../../layout/components/ThemeMenuItems";

export interface ManuscriptExportOptions {
  format: "md" | "txt";
  includeStoryBible: boolean;
  includeChapterSummaries: boolean;
}

interface NovelcrafterTopBarMenuProps {
  onExportManuscript?: (options: ManuscriptExportOptions) => void;
}

/** "⋯ Thêm" menu of the Novelcrafter top bar: Prompt Studio, export, language, themes (5A, H1). */
export default function NovelcrafterTopBarMenu({
  onExportManuscript,
}: NovelcrafterTopBarMenuProps) {
  const { t, language, setLanguage } = useLanguage();
  const [includeStoryBible, setIncludeStoryBible] = useState(true);
  const [includeChapterSummaries, setIncludeChapterSummaries] = useState(true);

  const runExport = (format: ManuscriptExportOptions["format"]) =>
    onExportManuscript?.({ format, includeStoryBible, includeChapterSummaries });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("novelcrafterMoreMenu")}
          title={t("novelcrafterMoreMenu")}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-(--line) text-(--muted) transition-colors hover:bg-(--raised) hover:text-(--text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
        >
          <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem asChild className="gap-2 text-sm">
          <Link href="/novelcrafter/prompts">
            <ScrollText aria-hidden="true" className="h-4 w-4 text-(--muted)" />
            <span>{t("novelcrafterPromptStudioOpen")}</span>
          </Link>
        </DropdownMenuItem>

        {onExportManuscript && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-(--muted)">
              {t("novelcrafterExportMenuBtn")}
            </DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={includeStoryBible}
              onCheckedChange={(val) => setIncludeStoryBible(Boolean(val))}
              onSelect={(e) => e.preventDefault()}
              className="text-sm"
            >
              {t("novelcrafterExportIncludeBible")}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={includeChapterSummaries}
              onCheckedChange={(val) => setIncludeChapterSummaries(Boolean(val))}
              onSelect={(e) => e.preventDefault()}
              className="text-sm"
            >
              {t("novelcrafterExportIncludeSummaries")}
            </DropdownMenuCheckboxItem>
            <DropdownMenuItem onClick={() => runExport("md")} className="gap-2 text-sm">
              <FileCode2 aria-hidden="true" className="h-4 w-4 text-(--muted)" />
              <span>{t("novelcrafterExportMarkdownBtn")}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => runExport("txt")} className="gap-2 text-sm">
              <FileText aria-hidden="true" className="h-4 w-4 text-(--muted)" />
              <span>{t("novelcrafterExportPlainTextBtn")}</span>
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setLanguage(language === "vi" ? "en" : "vi")}
          className="gap-2 text-sm"
        >
          <Globe aria-hidden="true" className="h-4 w-4 text-(--muted)" />
          <span>
            {t("novelcrafterLanguageSwitch").replace(
              "{lang}",
              language === "vi" ? "Tiếng Việt" : "English"
            )}
          </span>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2 text-sm">
            <Palette aria-hidden="true" className="h-4 w-4 text-(--muted)" />
            <span>{t("themes")}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-56 max-h-80 overflow-y-auto custom-scrollbar">
            <ThemeMenuItems />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
