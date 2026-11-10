// /app/features/chat/components/ComposerLeadingControls.tsx
"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, FolderOpen, Globe, Search, SlidersHorizontal } from "lucide-react";
import {
  modelSupportsWebSearch,
  isDeepSeekV32Model,
  isStrataLocalModel,
} from "@/lib/core/modelRegistry";
import { useLanguage } from "../hooks/useLanguage";
import GemQuickSwitch from "../../gems/components/GemQuickSwitch";
import PersonaQuickSwitch from "../../personas/components/PersonaQuickSwitch";
import LocalSamplingSettings from "./LocalSamplingSettings";
import FileManagerPanel from "./FileManagerPanel";
import { ComposerChip } from "./ComposerChip";
import ComposerOptionsSheet, {
  canAlwaysSearch,
  type ComposerOptionsState,
} from "./ComposerOptionsSheet";
import { getEffectiveThinkingLevel, modelSupportsThinkingUI } from "./hooks/useThinkingLevel";

export interface ComposerLeadingControlsProps extends ComposerOptionsState {
  /** Unsent files in the composer; shows the "Tệp (n)" chip when > 0. */
  fileCount: number;
  /** Conversation whose files the file manager lists. */
  fileConversationId: string | null;
}

type ActiveOptionsInput = Pick<
  ComposerOptionsState,
  | "currentModel"
  | "webSearchEnabled"
  | "alwaysSearch"
  | "thinkingLevel"
  | "currentGem"
  | "currentPersona"
>;

/** Number of options currently on, using the effective thinking level for the model. */
export function countActiveComposerOptions(o: ActiveOptionsInput): number {
  const web = modelSupportsWebSearch(o.currentModel) && o.webSearchEnabled;
  const always = canAlwaysSearch(o.currentModel) && o.alwaysSearch;
  const thinking =
    modelSupportsThinkingUI(o.currentModel) &&
    getEffectiveThinkingLevel(o.currentModel, o.thinkingLevel) !== "off";
  return [web, always, thinking, Boolean(o.currentGem), Boolean(o.currentPersona)].filter(Boolean)
    .length;
}

function FilesChip({
  fileCount,
  conversationId,
}: {
  fileCount: number;
  conversationId: string | null;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const tRecord = useMemo(
    () => new Proxy({} as Record<string, string>, { get: (_, prop: string) => t(prop) }),
    [t]
  );
  return (
    <div className="relative shrink-0">
      <ComposerChip icon={FolderOpen} active={open} onClick={() => setOpen((v) => !v)}>
        {`${t("files")} (${fileCount})`}
      </ComposerChip>
      {conversationId && (
        <FileManagerPanel
          conversationId={conversationId}
          isOpen={open}
          onClose={() => setOpen(false)}
          t={tRecord}
        />
      )}
    </div>
  );
}

/**
 * Left side of the composer's bottom row (Vikini 3.0, H2).
 * Desktop: labelled toggles + chips. Mobile: one "Tùy chọn" button opening a bottom sheet.
 */
export default function ComposerLeadingControls(props: ComposerLeadingControlsProps) {
  const { currentModel, currentGem, currentPersona, conversationId } = props;
  const { t } = useLanguage();
  const [sheetOpen, setSheetOpen] = useState(false);

  const canWebSearch = modelSupportsWebSearch(currentModel);
  const showAlwaysSearch = canAlwaysSearch(currentModel);
  const activeCount = countActiveComposerOptions(props);
  const optionsLabel =
    activeCount > 0
      ? `${t("composerOptions")} · ${t("composerOptionsActive").replace("{n}", String(activeCount))}`
      : t("composerOptions");

  return (
    <div className="flex flex-1 flex-wrap items-center gap-1.5 self-center">
      <div
        data-composer-group="desktop"
        className="hidden flex-wrap items-center gap-1.5 @3xl/chat:flex"
      >
        <ComposerChip
          icon={Globe}
          pressed={canWebSearch && props.webSearchEnabled}
          disabled={!canWebSearch}
          title={!canWebSearch ? t("webSearchNotSupported") : undefined}
          onClick={props.toggleWebSearch}
        >
          {t("webSearchToggle")}
        </ComposerChip>
        {isDeepSeekV32Model(currentModel) && props.webSearchEnabled && (
          <span className="text-xs text-(--warning)">{t("webSearchPricingNote")}</span>
        )}
        {showAlwaysSearch && (
          <ComposerChip
            icon={Search}
            pressed={props.alwaysSearch}
            title={t("alwaysSearchTooltip")}
            onClick={props.toggleAlwaysSearch}
          >
            {t("alwaysSearch")}
          </ComposerChip>
        )}
        {isStrataLocalModel(currentModel) && (
          <LocalSamplingSettings
            currentModel={currentModel}
            thinkingLevel={props.thinkingLevel}
            disabled={props.localSamplingDisabled}
          />
        )}
        <GemQuickSwitch currentGem={currentGem} conversationId={conversationId} />
        <PersonaQuickSwitch currentPersona={currentPersona} conversationId={conversationId} />
        {currentGem && currentPersona && (
          <span
            role="img"
            aria-label={t("conflictWarning")}
            title={t("conflictWarning")}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-(--warning)/10 text-(--warning)"
          >
            <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />
          </span>
        )}
      </div>

      <ComposerChip
        icon={SlidersHorizontal}
        active={activeCount > 0}
        aria-haspopup="dialog"
        aria-label={optionsLabel}
        onClick={() => setSheetOpen(true)}
        className="@3xl/chat:hidden"
      >
        {t("composerOptions")}
        {activeCount > 0 && (
          <span
            aria-hidden="true"
            className="flex h-4 min-w-4 items-center justify-center rounded-full bg-(--accent) px-1 text-xs font-semibold text-(--on-accent)"
          >
            {activeCount}
          </span>
        )}
      </ComposerChip>

      {props.fileCount > 0 && (
        <FilesChip fileCount={props.fileCount} conversationId={props.fileConversationId} />
      )}

      <ComposerOptionsSheet {...props} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
