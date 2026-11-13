// /app/features/novelcrafter/components/NovelcrafterInheritanceTable.tsx
"use client";

import React, { useId, useMemo } from "react";
import { Gem, Plus, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isModelAllowedById } from "@/lib/core/modelAccess";
import { SELECTABLE_MODELS } from "@/lib/core/modelRegistry";
import {
  getSelectableModelDisplayName,
  resolveFeatureInheritanceRows,
  type CatalogItemSummary,
  type FeatureInheritanceRow,
} from "@/lib/features/novelcrafter/aiInheritanceTable";
import type {
  NovelcrafterFeatureSlot,
  NovelcrafterRoutingConfig,
} from "@/lib/features/novelcrafter/types";
import { cn } from "@/lib/utils/cn";
import type { TranslationKey } from "@/lib/utils/translations";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { useGemStore } from "../../gems/stores/useGemStore";
import { usePersonaStore } from "../../personas/stores/usePersonaStore";

const NONE_RADIO_VALUE = "__none__";

const SLOT_LABEL_KEYS: Record<NovelcrafterFeatureSlot, TranslationKey> = {
  bible: "novelcrafterSlotBible",
  write: "novelcrafterSlotWrite",
  rewrite: "novelcrafterSlotRewrite",
  feedback: "novelcrafterSlotFeedback",
  expand: "novelcrafterSlotExpand",
  brainstorm: "novelcrafterSlotBrainstorm",
};

export interface NovelcrafterInheritanceTableProps {
  storyTitle: string;
  selectedModel: string;
  allowedModelIds?: ReadonlySet<string>;
  routing: NovelcrafterRoutingConfig;
  gems: readonly CatalogItemSummary[];
  personas: readonly CatalogItemSummary[];
  onUpdateRouting: (patch: Partial<NovelcrafterRoutingConfig>) => void;
  onUpdateFeaturePersonaSlot: (slot: NovelcrafterFeatureSlot, value: string) => void;
  onUpdateFeatureModelSlot: (slot: NovelcrafterFeatureSlot, value: string) => void;
}

export default function NovelcrafterInheritanceTable({
  storyTitle,
  selectedModel,
  allowedModelIds,
  routing,
  gems,
  personas,
  onUpdateRouting,
  onUpdateFeaturePersonaSlot,
  onUpdateFeatureModelSlot,
}: NovelcrafterInheritanceTableProps) {
  const { t } = useLanguage();
  const headingId = useId();
  const { openGemModal } = useGemStore();
  const { openPersonaModal } = usePersonaStore();

  const defaultModelName = useMemo(
    () => getSelectableModelDisplayName(selectedModel),
    [selectedModel]
  );

  const selectableModels = useMemo(
    () =>
      SELECTABLE_MODELS.filter(
        (m) => !allowedModelIds || isModelAllowedById(m.id, allowedModelIds)
      ),
    [allowedModelIds]
  );

  const rows = useMemo(
    () =>
      resolveFeatureInheritanceRows({
        routing,
        defaultModelId: selectedModel,
        gems,
        personas,
        allowedModelIds,
      }),
    [routing, selectedModel, gems, personas, allowedModelIds]
  );

  const masterGem = routing.masterGemId
    ? (gems.find((g) => g.id === routing.masterGemId) ?? null)
    : null;
  const masterPersona = routing.masterPersonaId
    ? (personas.find((p) => p.id === routing.masterPersonaId) ?? null)
    : null;

  const formatAiReceives = (row: FeatureInheritanceRow): string => {
    if (row.masterGemName) {
      if (row.personaSource === "disabled") {
        return t("novelcrafterAiReceivesGemOnlyPersonaOff");
      }
      if (row.personaSource === "override") {
        return row.effectivePersonaName
          ? t("novelcrafterAiReceivesGemAndOverride").replace("{persona}", row.effectivePersonaName)
          : t("novelcrafterAiReceivesGemOnlyMissingPersona");
      }
      return row.effectivePersonaName
        ? t("novelcrafterAiReceivesGemAndPersona").replace("{persona}", row.effectivePersonaName)
        : t("novelcrafterAiReceivesGemOnly");
    }

    if (row.personaSource === "disabled") {
      return t("novelcrafterAiReceivesPersonaOff");
    }
    if (row.personaSource === "override" && row.effectivePersonaName) {
      return t("novelcrafterAiReceivesPersonaOverride").replace(
        "{persona}",
        row.effectivePersonaName
      );
    }
    if (row.personaSource === "inherit" && row.effectivePersonaName) {
      return row.effectivePersonaName;
    }
    return t("novelcrafterAiReceivesSystemDefault");
  };

  return (
    <div
      role="region"
      aria-labelledby={headingId}
      className="flex-1 min-w-0 px-4 py-5 sm:px-8 sm:py-7 flex flex-col gap-5 sm:gap-6 xl:overflow-y-auto custom-scrollbar"
    >
      <div className="flex flex-col gap-1.5">
        <span className="text-xs sm:text-sm text-(--faint) truncate">{storyTitle}</span>
        <h1 id={headingId} className="text-xl sm:text-2xl font-semibold text-(--text)">
          {t("novelcrafterRoutingTitle")}
        </h1>
        <p className="text-sm text-(--muted) max-w-xl leading-relaxed">
          {t("novelcrafterAiSettingsLead")}
        </p>
      </div>

      {/* Master GEM & Master Persona Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "w-full text-left px-4 py-3.5 rounded-xl border bg-(--surface) hover:bg-(--raised) text-(--text) flex items-center gap-3 transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
                masterGem ? "border-(--accent)" : "border-(--line)"
              )}
            >
              <span
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                  masterGem ? "bg-(--soft) text-(--accent)" : "bg-(--raised) text-(--muted)"
                )}
              >
                <Gem className="w-5 h-5" />
              </span>
              <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="text-xs text-(--faint) truncate">
                  {t("novelcrafterMasterGemCardMeta")}
                </span>
                <span className="text-sm sm:text-base font-semibold truncate">
                  {masterGem?.name || t("novelcrafterNoMasterGem")}
                </span>
              </span>
              <span className="text-xs sm:text-sm font-medium text-(--accent) shrink-0">
                {t("novelcrafterChangeBtn")}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-[min(18rem,calc(100vw-2rem))] max-h-80 overflow-y-auto custom-scrollbar"
          >
            <DropdownMenuRadioGroup
              value={routing.masterGemId || NONE_RADIO_VALUE}
              onValueChange={(val) =>
                onUpdateRouting({ masterGemId: val === NONE_RADIO_VALUE ? null : val })
              }
            >
              <DropdownMenuRadioItem value={NONE_RADIO_VALUE}>
                {t("novelcrafterNoMasterGem")}
              </DropdownMenuRadioItem>
              {gems.map((gem) => (
                <DropdownMenuRadioItem key={gem.id} value={gem.id}>
                  {gem.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => openGemModal(null)}>
              <Plus className="w-3.5 h-3.5 mr-2 text-(--accent)" />
              <span>{t("novelcrafterManageGemsBtn")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "w-full text-left px-4 py-3.5 rounded-xl border bg-(--surface) hover:bg-(--raised) text-(--text) flex items-center gap-3 transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
                masterPersona ? "border-(--accent)" : "border-(--line)"
              )}
            >
              <span
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                  masterPersona ? "bg-(--soft) text-(--accent)" : "bg-(--raised) text-(--muted)"
                )}
              >
                <UserRound className="w-5 h-5" />
              </span>
              <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="text-xs text-(--faint) truncate">
                  {t("novelcrafterMasterPersonaCardMeta")}
                </span>
                <span className="text-sm sm:text-base font-semibold truncate">
                  {masterPersona?.name || t("novelcrafterNoMasterPersona")}
                </span>
              </span>
              <span className="text-xs sm:text-sm font-medium text-(--accent) shrink-0">
                {t("novelcrafterChangeBtn")}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-[min(18rem,calc(100vw-2rem))] max-h-80 overflow-y-auto custom-scrollbar"
          >
            <DropdownMenuRadioGroup
              value={routing.masterPersonaId || NONE_RADIO_VALUE}
              onValueChange={(val) =>
                onUpdateRouting({ masterPersonaId: val === NONE_RADIO_VALUE ? null : val })
              }
            >
              <DropdownMenuRadioItem value={NONE_RADIO_VALUE}>
                {t("novelcrafterNoMasterPersona")}
              </DropdownMenuRadioItem>
              {personas.map((persona) => (
                <DropdownMenuRadioItem key={persona.id} value={persona.id}>
                  {persona.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => openPersonaModal(null)}>
              <Plus className="w-3.5 h-3.5 mr-2 text-(--accent)" />
              <span>{t("novelcrafterManagePersonasBtn")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 6-Slot Per-Feature Inheritance Table */}
      <section
        aria-label={t("novelcrafterInheritanceTableAria")}
        className="rounded-xl border border-(--line) bg-(--surface) overflow-hidden"
      >
        <div className="hidden md:grid md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.4fr)] gap-3 px-4 py-2.5 text-xs text-(--faint) border-b border-(--line)">
          <span>{t("novelcrafterColFeature")}</span>
          <span>{t("novelcrafterColPersona")}</span>
          <span>{t("novelcrafterColModel")}</span>
          <span>{t("novelcrafterColAiReceives")}</span>
        </div>

        <div className="divide-y divide-(--line)">
          {rows.map((row) => {
            const slotLabel = t(SLOT_LABEL_KEYS[row.slot]);
            return (
              <div
                key={row.slot}
                data-testid={`inheritance-row-${row.slot}`}
                className={cn(
                  "px-4 py-3 md:py-2.5 md:min-h-13 flex flex-col md:grid md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.4fr)] gap-2.5 md:gap-3 md:items-center transition-colors",
                  row.isRowOverridden && "bg-(--soft)"
                )}
              >
                <span className="text-sm font-medium text-(--text) truncate">{slotLabel}</span>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:contents gap-2">
                  <select
                    aria-label={`${slotLabel}: ${t("novelcrafterColPersona")}`}
                    value={row.personaSelectValue}
                    onChange={(e) => onUpdateFeaturePersonaSlot(row.slot, e.target.value)}
                    className={cn(
                      "h-8.5 w-full min-w-0 rounded-lg border bg-(--bg) px-2.5 text-xs sm:text-sm font-medium truncate focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
                      row.isPersonaOverridden
                        ? "border-(--accent) text-(--accent)"
                        : "border-(--line) text-(--muted)"
                    )}
                  >
                    <option value="inherit" className="bg-(--surface) text-(--text)">
                      {t("novelcrafterInheritShort")}
                    </option>
                    <option value="none" className="bg-(--surface) text-(--text)">
                      {t("novelcrafterDisablePersonaShort")}
                    </option>
                    {row.personaSource === "override" && !row.effectivePersonaName && (
                      <option
                        value={row.personaSelectValue}
                        className="bg-(--surface) text-(--text)"
                      >
                        {row.personaSelectValue}
                      </option>
                    )}
                    {personas.map((persona) => (
                      <option
                        key={persona.id}
                        value={persona.id}
                        className="bg-(--surface) text-(--text)"
                      >
                        {persona.name}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label={`${slotLabel}: ${t("novelcrafterColModel")}`}
                    value={row.modelSelectValue}
                    onChange={(e) => onUpdateFeatureModelSlot(row.slot, e.target.value)}
                    className={cn(
                      "h-8.5 w-full min-w-0 rounded-lg border bg-(--bg) px-2.5 text-xs sm:text-sm font-medium truncate focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
                      row.isModelOverridden
                        ? "border-(--accent) text-(--accent)"
                        : "border-(--line) text-(--muted)"
                    )}
                  >
                    <option value="inherit" className="bg-(--surface) text-(--text)">
                      {t("novelcrafterInheritModelOption").replace("{model}", defaultModelName)}
                    </option>
                    {selectableModels.map((model) => (
                      <option
                        key={model.id}
                        value={model.id}
                        className="bg-(--surface) text-(--text)"
                      >
                        {model.name}
                      </option>
                    ))}
                  </select>
                </div>

                <span className="text-xs leading-relaxed text-(--faint)">
                  {formatAiReceives(row)}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
