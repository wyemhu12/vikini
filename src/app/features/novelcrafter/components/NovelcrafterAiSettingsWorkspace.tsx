// /app/features/novelcrafter/components/NovelcrafterAiSettingsWorkspace.tsx
"use client";

import React, { useEffect, useId, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { PromptStudioPreviewSource } from "@/lib/features/novelcrafter/promptStudioPreview";
import { cn } from "@/lib/utils/cn";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { usePromptStudioController } from "../hooks/usePromptStudioController";
import { hasActiveOverlayInDom } from "../utils/novelcrafterKeyboard";
import NovelcrafterInheritanceTable, {
  type NovelcrafterInheritanceTableProps,
} from "./NovelcrafterInheritanceTable";
import PromptStudioActionEditor from "./prompt-studio/PromptStudioActionEditor";
import PromptStudioActionList from "./prompt-studio/PromptStudioActionList";
import PromptStudioPresetBar from "./prompt-studio/PromptStudioPresetBar";

export type NovelcrafterAiSettingsWorkspaceProps = NovelcrafterInheritanceTableProps & {
  onClose?: () => void;
  backHref?: string;
  initialTab?: "defaults" | "studio";
  /** Current story data for the Prompt Studio preview (sample data when omitted). */
  previewSource?: PromptStudioPreviewSource;
};

type SettingsTab = "defaults" | "studio";

/** AI Settings: shared back navigation, preset bar, and 2 full-width tabs (Defaults + Prompt Studio IDE). */
export default function NovelcrafterAiSettingsWorkspace({
  previewSource,
  onClose,
  backHref,
  initialTab = "defaults",
  ...inheritanceProps
}: NovelcrafterAiSettingsWorkspaceProps) {
  const { t } = useLanguage();
  const c = usePromptStudioController(previewSource);
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const baseId = useId();

  useEffect(() => {
    if (!onClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || hasActiveOverlayInDom()) {
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const tabs: ReadonlyArray<{ id: SettingsTab; label: string }> = [
    { id: "defaults", label: t("novelcrafterAiSettingsTabDefaults") },
    { id: "studio", label: t("novelcrafterAiSettingsTabPromptStudio") },
  ];

  const showUtilityRow = Boolean(onClose || backHref || tab === "studio");

  return (
    <div className="flex-1 min-h-0 w-full flex flex-col bg-(--bg) text-(--text)">
      {showUtilityRow && (
        <div className="shrink-0 px-4 md:px-6 pt-2.5 pb-1 flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-(--line) bg-(--surface) hover:bg-(--raised) text-xs font-medium text-(--text) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-(--accent)" />
                <span>{t("novelcrafterPromptStudioBack")}</span>
              </button>
            ) : backHref ? (
              <Link
                href={backHref}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-(--line) bg-(--surface) hover:bg-(--raised) text-xs font-medium text-(--text) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-(--accent)" />
                <span>{t("novelcrafterPromptStudioBack")}</span>
              </Link>
            ) : null}

            {tab === "studio" && (
              <span className="hidden sm:inline text-xs sm:text-sm text-(--faint) truncate">
                {inheritanceProps.storyTitle}
              </span>
            )}
          </div>

          {tab === "studio" && c.isHydrated && (
            <PromptStudioPresetBar
              activePresetId={c.settings.activePresetId}
              customPresets={c.settings.customPresets}
              onApplyPreset={c.handleApplyPreset}
              onSaveAsPreset={c.handleSaveAsPreset}
              onDeletePreset={(id) => void c.handleDeletePreset(id)}
              onResetAll={() => void c.handleResetAll()}
            />
          )}
        </div>
      )}

      <div
        role="tablist"
        aria-label={t("novelcrafterRoutingButton")}
        className="shrink-0 flex items-center gap-1 px-4 md:px-6 pt-1 border-b border-(--line)"
      >
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`${baseId}-tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`${baseId}-panel-${item.id}`}
            onClick={() => setTab(item.id)}
            className={cn(
              "px-3.5 py-2 -mb-px border-b-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
              tab === item.id
                ? "border-(--accent) text-(--text)"
                : "border-transparent text-(--muted) hover:text-(--text)"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "defaults" ? (
        <div
          role="tabpanel"
          id={`${baseId}-panel-defaults`}
          aria-labelledby={`${baseId}-tab-defaults`}
          className="flex-1 min-h-0 flex overflow-y-auto custom-scrollbar"
        >
          <NovelcrafterInheritanceTable {...inheritanceProps} />
        </div>
      ) : (
        <section
          role="tabpanel"
          id={`${baseId}-panel-studio`}
          aria-labelledby={`${baseId}-tab-studio`}
          className="flex-1 min-h-0 flex flex-col bg-(--surface) overflow-y-auto md:overflow-hidden"
        >
          <h1 className="sr-only">{t("novelcrafterPromptStudioPaneTitle")}</h1>

          <div className="flex flex-col shrink-0 md:shrink md:flex-1 md:min-h-0 md:flex-row md:overflow-hidden">
            {!c.isHydrated ? (
              <div className="p-4 w-full space-y-3">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-64 w-full rounded-xl" />
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
