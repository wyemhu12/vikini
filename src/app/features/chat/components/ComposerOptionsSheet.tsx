// /app/features/chat/components/ComposerOptionsSheet.tsx
"use client";

import React, { useId, useRef } from "react";
import { Globe, Paperclip, Search, type LucideIcon } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { modelSupportsWebSearch, isStrataLocalModel } from "@/lib/core/modelRegistry";
import { cn } from "@/lib/utils/cn";
import { useLanguage } from "../hooks/useLanguage";
import GemQuickSwitch from "../../gems/components/GemQuickSwitch";
import PersonaQuickSwitch from "../../personas/components/PersonaQuickSwitch";
import ModelSelector from "./ModelSelector";
import LocalSamplingSettings from "./LocalSamplingSettings";
import {
  type ThinkingLevel,
  getEffectiveThinkingLevel,
  modelSupportsThinkingUI,
} from "./hooks/useThinkingLevel";
import { getThinkingOptions } from "./thinkingOptions";

export interface ComposerChipInfo {
  name: string;
  icon?: string | null;
  color?: string | null;
}

/** Composer option state shared by the desktop chips and the mobile sheet. */
export interface ComposerOptionsState {
  currentModel: string;
  webSearchEnabled: boolean;
  toggleWebSearch: () => void;
  alwaysSearch: boolean;
  toggleAlwaysSearch: () => void;
  thinkingLevel: ThinkingLevel;
  setThinkingLevel: (level: ThinkingLevel) => void;
  currentGem: ComposerChipInfo | null;
  currentPersona: ComposerChipInfo | null;
  /** Conversation the Gem / Persona is applied to. */
  conversationId: string | null;
  onSelectModel: (id: string) => void;
  isModelAllowed: (id: string) => boolean;
  onAttach: () => void;
  attachDisabled: boolean;
  /** Locked while streaming/regenerating: model picker and local sampling, as before 3C. */
  localSamplingDisabled: boolean;
  expandDown?: boolean;
}

export interface ComposerOptionsSheetProps extends ComposerOptionsState {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** "Luôn tìm kiếm" stays Gemini-only, as before Vikini 3.0. */
export function canAlwaysSearch(model: string): boolean {
  return modelSupportsWebSearch(model) && model.startsWith("gemini");
}

const ROW = "flex min-h-14 items-center gap-3 border-b border-(--line) px-1";

interface SwitchRowProps {
  icon: LucideIcon;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

function SwitchRow({
  icon: Icon,
  title,
  description,
  checked,
  disabled,
  onToggle,
}: SwitchRowProps) {
  const descId = useId();
  return (
    <div className={ROW}>
      <span
        aria-hidden="true"
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]",
          checked ? "bg-(--soft) text-(--accent)" : "bg-(--raised) text-(--muted)"
        )}
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col py-2">
        <span className="text-[15px] font-medium text-(--text)">{title}</span>
        <span id={descId} className="text-[13px] text-(--faint)">
          {description}
        </span>
      </div>
      <Switch
        aria-label={title}
        aria-describedby={descId}
        checked={checked}
        disabled={disabled}
        onCheckedChange={() => onToggle()}
      />
    </div>
  );
}

function ValueRow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={ROW}>
      <span className="flex-1 text-[15px] font-medium text-(--text)">{title}</span>
      <div className="flex min-w-0 justify-end">{children}</div>
    </div>
  );
}

function ThinkingRadioGroup({
  currentModel,
  thinkingLevel,
  setThinkingLevel,
}: Pick<ComposerOptionsState, "currentModel" | "thinkingLevel" | "setThinkingLevel">) {
  const { t } = useLanguage();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const options = getThinkingOptions(currentModel, t);
  const effective = getEffectiveThinkingLevel(currentModel, thinkingLevel);
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === effective)
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const step = e.key === "ArrowRight" ? 1 : -1;
    const next = (selectedIndex + step + options.length) % options.length;
    setThinkingLevel(options[next].value);
    refs.current[next]?.focus();
  };

  if (options.length === 0) return null;

  return (
    <div className="flex flex-col gap-2.5 border-b border-(--line) px-1 py-3.5">
      <span className="text-[15px] font-medium text-(--text)">{t("thinkingLevel")}</span>
      <div
        role="radiogroup"
        aria-label={t("thinkingLevel")}
        onKeyDown={handleKeyDown}
        className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-(--raised) p-1"
      >
        {options.map((option, i) => {
          const checked = i === selectedIndex;
          return (
            <button
              key={option.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              onClick={() => setThinkingLevel(option.value)}
              className={cn(
                "h-9 rounded-[9px] text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)",
                checked
                  ? "bg-(--surface) font-semibold text-(--text) shadow-sm"
                  : "font-medium text-(--muted) hover:text-(--text)"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Mobile composer options (canvas ChatMobile): toggles with descriptions, thinking, Gem, Model, attach. */
export default function ComposerOptionsSheet(props: ComposerOptionsSheetProps) {
  const { open, onOpenChange, currentModel } = props;
  const { t } = useLanguage();
  const canWebSearch = modelSupportsWebSearch(currentModel);

  const handleAttach = () => {
    // Close first, then open the picker in the same click so the browser keeps user activation.
    onOpenChange(false);
    props.onAttach();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        hideCloseButton
        aria-describedby={undefined}
        className="gap-0 overflow-y-auto px-4 pt-2 pb-6"
      >
        <div aria-hidden="true" className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-(--line)" />
        <div className="flex items-center justify-between px-1 pb-2">
          <SheetTitle className="text-[17px] text-(--text)">{t("composerOptions")}</SheetTitle>
          <SheetClose className="h-9 rounded-lg px-3 text-sm font-semibold text-(--accent) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)">
            {t("done")}
          </SheetClose>
        </div>

        <SwitchRow
          icon={Globe}
          title={t("webSearchToggle")}
          description={canWebSearch ? t("webSearchDesc") : t("webSearchNotSupported")}
          checked={canWebSearch && props.webSearchEnabled}
          disabled={!canWebSearch}
          onToggle={props.toggleWebSearch}
        />
        {canAlwaysSearch(currentModel) && (
          <SwitchRow
            icon={Search}
            title={t("alwaysSearch")}
            description={t("alwaysSearchDesc")}
            checked={props.alwaysSearch}
            onToggle={props.toggleAlwaysSearch}
          />
        )}
        {modelSupportsThinkingUI(currentModel) && (
          <ThinkingRadioGroup
            currentModel={currentModel}
            thinkingLevel={props.thinkingLevel}
            setThinkingLevel={props.setThinkingLevel}
          />
        )}
        <ValueRow title={t("gemChip")}>
          <GemQuickSwitch
            currentGem={props.currentGem}
            conversationId={props.conversationId}
            showPrefix={false}
          />
        </ValueRow>
        <ValueRow title={t("personaChip")}>
          <PersonaQuickSwitch
            currentPersona={props.currentPersona}
            conversationId={props.conversationId}
            showPrefix={false}
          />
        </ValueRow>
        {props.currentGem && props.currentPersona && (
          <p className="border-b border-(--line) px-1 py-2 text-xs text-(--warning)">
            {t("conflictWarning")}
          </p>
        )}
        <ValueRow title="Model">
          <ModelSelector
            variant="inline"
            currentModelId={currentModel}
            onSelectModel={props.onSelectModel}
            isModelAllowed={props.isModelAllowed}
            disabled={props.localSamplingDisabled}
            expandDown={props.expandDown}
          />
        </ValueRow>
        {isStrataLocalModel(currentModel) && (
          <ValueRow title={t("localSamplingTitle")}>
            <LocalSamplingSettings
              currentModel={currentModel}
              thinkingLevel={props.thinkingLevel}
              disabled={props.localSamplingDisabled}
            />
          </ValueRow>
        )}
        <button
          type="button"
          onClick={handleAttach}
          disabled={props.attachDisabled}
          className="flex min-h-14 w-full items-center gap-3 px-1 text-left text-[15px] font-medium text-(--text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) disabled:opacity-50"
        >
          <span className="flex-1">{t("attachFileOrImage")}</span>
          <Paperclip aria-hidden="true" className="h-[18px] w-[18px] text-(--faint)" />
        </button>
      </SheetContent>
    </Sheet>
  );
}
