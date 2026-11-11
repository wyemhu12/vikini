// /app/features/novelcrafter/components/NovelcrafterAiSettingsWorkspace.tsx
"use client";

import React, { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { usePromptStudioController } from "../hooks/usePromptStudioController";
import { hasActiveOverlayInDom } from "../utils/novelcrafterKeyboard";
import NovelcrafterInheritanceTable, {
  type NovelcrafterInheritanceTableProps,
} from "./NovelcrafterInheritanceTable";
import PromptStudioActionEditor from "./prompt-studio/PromptStudioActionEditor";
import PromptStudioActionList from "./prompt-studio/PromptStudioActionList";
import PromptStudioPresetBar from "./prompt-studio/PromptStudioPresetBar";

export type NovelcrafterAiSettingsWorkspaceProps = NovelcrafterInheritanceTableProps;

export default function NovelcrafterAiSettingsWorkspace(
  props: NovelcrafterAiSettingsWorkspaceProps
) {
  const { onClose } = props;
  const { t } = useLanguage();
  const c = usePromptStudioController();

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

  return (
    <div className="flex-1 min-h-0 w-full flex flex-col xl:flex-row overflow-y-auto xl:overflow-hidden bg-(--bg) text-(--text) custom-scrollbar">
      <NovelcrafterInheritanceTable {...props} />

      <aside
        aria-label={t("novelcrafterPromptStudioPaneTitle")}
        className="w-full xl:w-120 shrink-0 flex flex-col bg-(--surface) border-t xl:border-t-0 xl:border-l border-(--line) xl:h-full xl:overflow-hidden"
      >
        <div className="px-5 pt-5 pb-3.5 flex flex-col gap-1 border-b border-(--line) shrink-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base sm:text-lg font-semibold text-(--text) truncate">
              {t("novelcrafterPromptStudioPaneTitle")}
            </h2>
            {c.isHydrated && (
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
          <p className="text-xs sm:text-sm text-(--faint)">
            {t("novelcrafterPromptStudioOptionalHint")}
          </p>
        </div>

        <div className="flex-1 min-h-0 flex flex-col sm:flex-row xl:overflow-hidden">
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
      </aside>
    </div>
  );
}
