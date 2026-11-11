"use client";

import { useState, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { SELECTABLE_MODELS, isStrataLocalModel } from "@/lib/core/modelRegistry";
import { useRecentModelsStore } from "@/lib/store/recentModelsStore";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useIsDesktop } from "../../layout/hooks/useIsDesktop";
import { useLanguage } from "../hooks/useLanguage";
import { useLocalLlmHealth } from "../hooks/useLocalLlmHealth";
import LocalLlmStatusDot from "./LocalLlmStatusDot";
import ModelPickerList from "./ModelPickerList";

interface ModelSelectorProps {
  currentModelId: string;
  onSelectModel: (id: string) => void;
  isModelAllowed: (id: string) => boolean;
  disabled: boolean;
  /** If true, dropdown expands downward (landing page). Default: upward (chat view). */
  expandDown?: boolean;
  /** Visual variant: "toolbar" (default, top bar / Novelcrafter) or "inline" (inside chat input bar). */
  variant?: "toolbar" | "inline";
}

export default function ModelSelector({
  currentModelId,
  onSelectModel,
  isModelAllowed,
  disabled,
  expandDown = false,
  variant = "toolbar",
}: ModelSelectorProps) {
  const { t } = useLanguage();
  const isDesktop = useIsDesktop();
  const [isOpen, setIsOpen] = useState(false);
  const pushRecentModel = useRecentModelsStore((s) => s.pushRecentModel);

  const currentModel = useMemo(
    () => SELECTABLE_MODELS.find((m) => m.id === currentModelId),
    [currentModelId]
  );

  const isCurrentLocal = isStrataLocalModel(currentModelId);
  const { status: localStatus } = useLocalLlmHealth({
    active: isCurrentLocal || isOpen,
  });
  const isLocalVisible =
    localStatus === "online" || localStatus === "busy" || localStatus === "offline";

  const modelDisplayName = currentModel?.name || currentModelId;
  const isInline = variant === "inline";

  if (disabled) {
    if (isInline) {
      return (
        <div className="h-10 inline-flex items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-(--muted) opacity-50 cursor-not-allowed">
          {isCurrentLocal && <LocalLlmStatusDot status={localStatus} />}
          <span className="truncate max-w-[7rem] @sm/chat:max-w-[12rem]">{modelDisplayName}</span>
        </div>
      );
    }
    return (
      <div className="flex items-center rounded-full bg-(--raised) border border-(--line) md:bg-transparent md:border-0 p-1 px-4 py-1.5 opacity-50 cursor-not-allowed">
        <span className="text-xs font-bold uppercase tracking-wider text-(--muted)">
          {modelDisplayName}
        </span>
      </div>
    );
  }

  const triggerButton = isInline ? (
    <button
      type="button"
      aria-label={`${t("selectModel")}: ${modelDisplayName}`}
      className="h-10 inline-flex items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-(--muted) hover:bg-(--raised) hover:text-(--text) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none active:scale-[0.97]"
    >
      {isCurrentLocal && <LocalLlmStatusDot status={localStatus} />}
      <span className="truncate max-w-[7rem] @sm/chat:max-w-[12rem]">{modelDisplayName}</span>
      <ChevronDown
        className={`w-3.5 h-3.5 shrink-0 text-(--muted) transition-transform ${isOpen ? "rotate-180" : ""}`}
      />
    </button>
  ) : (
    <button
      type="button"
      aria-label={`${t("selectModel")}: ${modelDisplayName}`}
      className="flex items-center gap-2 rounded-full bg-(--raised) border border-(--line) md:bg-transparent md:border-0 md:hover:bg-(--raised) p-1 px-4 py-1.5 transition-colors md:shadow-none shadow-lg group text-(--text)"
    >
      {isCurrentLocal && <LocalLlmStatusDot status={localStatus} />}
      <span className="text-xs font-bold uppercase tracking-wider text-(--muted) group-hover:text-(--text) transition-colors">
        {modelDisplayName}
      </span>
      <ChevronDown
        className={`w-3 h-3 text-(--muted) transition-transform ${isOpen ? "rotate-180" : ""}`}
      />
    </button>
  );

  const list = (
    <ModelPickerList
      currentModelId={currentModelId}
      isModelAllowed={isModelAllowed}
      isLocalVisible={isLocalVisible}
      localStatus={localStatus}
      onClose={() => setIsOpen(false)}
      onSelect={(id) => {
        onSelectModel(id);
        pushRecentModel(id);
        setIsOpen(false);
      }}
    />
  );

  if (!isDesktop) {
    return (
      <>
        <span onClick={() => setIsOpen(true)} className="contents">
          {triggerButton}
        </span>
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetContent side="bottom" className="h-[82dvh] p-0">
            <SheetTitle className="sr-only">{t("modelPickerTitle")}</SheetTitle>
            {list}
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
      <PopoverContent
        side={expandDown ? "bottom" : "top"}
        align={isInline ? "end" : "start"}
        collisionPadding={12}
        sideOffset={8}
        aria-label={t("modelPickerTitle")}
        className="flex max-h-[min(480px,var(--radix-popover-content-available-height,480px))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-(--line) bg-(--surface) p-0 shadow-2xl"
      >
        {list}
      </PopoverContent>
    </Popover>
  );
}
