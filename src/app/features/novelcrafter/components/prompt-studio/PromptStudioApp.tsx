// /app/features/novelcrafter/components/prompt-studio/PromptStudioApp.tsx
"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, ScrollText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import ToastContainer from "@/components/ui/ToastContainer";
import { useLanguage } from "../../../chat/hooks/useLanguage";
import { useTheme } from "../../../chat/hooks/useTheme";
import { usePromptStudioController } from "../../hooks/usePromptStudioController";
import PromptStudioActionEditor from "./PromptStudioActionEditor";
import PromptStudioActionList from "./PromptStudioActionList";
import PromptStudioPresetBar from "./PromptStudioPresetBar";

export default function PromptStudioApp() {
  useTheme();
  const { t } = useLanguage();
  const c = usePromptStudioController();

  return (
    <div className="min-h-dvh w-full bg-(--surface) text-(--text-primary) flex flex-col">
      <a
        href="#prompt-studio-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-3 focus:py-1.5 focus:rounded-lg focus:bg-(--accent) focus:text-(--accent-foreground) focus:text-xs focus:font-semibold"
      >
        {t("skipToMainContent")}
      </a>
      <ToastContainer />

      <header className="sticky top-0 z-20 border-b border-(--border) bg-(--surface-muted)/90 backdrop-blur-xl px-4 md:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/novelcrafter"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-(--control-border) bg-(--control-bg) hover:bg-(--control-bg-hover) text-xs font-semibold text-(--text-primary) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-(--accent)" />
            <span>{t("novelcrafterPromptStudioBack")}</span>
          </Link>

          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-base md:text-lg font-bold text-(--text-primary) truncate">
              <ScrollText className="w-5 h-5 text-(--accent) shrink-0" />
              <span className="truncate">{t("novelcrafterPromptStudioTitle")}</span>
            </h1>
            <p className="hidden md:block text-xs text-(--text-secondary) truncate">
              {t("novelcrafterPromptStudioSubtitle")}
            </p>
          </div>
        </div>
      </header>

      <main
        id="prompt-studio-main"
        className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-5 space-y-5"
      >
        {!c.isHydrated ? (
          <div className="space-y-4">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(16rem,22rem)_1fr] gap-5">
              <Skeleton className="h-96 w-full rounded-2xl" />
              <Skeleton className="h-96 w-full rounded-2xl" />
            </div>
          </div>
        ) : (
          <>
            <PromptStudioPresetBar
              activePresetId={c.settings.activePresetId}
              customPresets={c.settings.customPresets}
              onApplyPreset={c.handleApplyPreset}
              onSaveAsPreset={c.handleSaveAsPreset}
              onDeletePreset={(id) => void c.handleDeletePreset(id)}
              onResetAll={() => void c.handleResetAll()}
            />

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(16rem,22rem)_1fr] gap-5 items-start">
              <PromptStudioActionList
                selectedKey={c.selectedKey}
                onSelectKey={c.setSelectedKey}
                isActionCustomized={c.isActionCustomized}
              />

              <PromptStudioActionEditor
                selectedKey={c.selectedKey}
                draftDirective={c.draftDirective}
                onChangeDirective={c.setDraftDirective}
                draftNodes={c.draftNodes}
                requiredNodes={c.requiredNodes}
                onToggleNode={c.toggleNode}
                isDirty={c.isDirty}
                isCustomized={c.isActionCustomized(c.selectedKey)}
                previewResult={c.previewResult}
                onSave={c.saveDraft}
                onResetAction={c.resetCurrentAction}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
