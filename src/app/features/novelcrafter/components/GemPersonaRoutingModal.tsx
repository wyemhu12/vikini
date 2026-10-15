// /app/features/novelcrafter/components/GemPersonaRoutingModal.tsx
"use client";

import React from "react";
import { Crown, ExternalLink, Layers, Sparkles, UserCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { useGemStore } from "../../gems/stores/useGemStore";
import { usePersonaStore } from "../../personas/stores/usePersonaStore";
import {
  NOVELCRAFTER_FEATURE_SLOTS,
  type NovelcrafterFeatureSlot,
  type NovelcrafterRoutingConfig,
} from "@/lib/features/novelcrafter/types";
import type { TranslationKey } from "@/lib/utils/translations";
import type { ClientGemItem, ClientPersonaItem } from "../hooks/useNovelcrafterStory";

interface GemPersonaRoutingModalProps {
  isOpen: boolean;
  onClose: () => void;
  routing: NovelcrafterRoutingConfig;
  gems: ClientGemItem[];
  personas: ClientPersonaItem[];
  onUpdateRouting: (patch: Partial<NovelcrafterRoutingConfig>) => void;
  onUpdateFeatureSlot: (slot: NovelcrafterFeatureSlot, value: string) => void;
}

const SLOT_LABEL_KEYS: Record<NovelcrafterFeatureSlot, TranslationKey> = {
  bible: "novelcrafterSlotBible",
  write: "novelcrafterSlotWrite",
  rewrite: "novelcrafterSlotRewrite",
  feedback: "novelcrafterSlotFeedback",
  expand: "novelcrafterSlotExpand",
  brainstorm: "novelcrafterSlotBrainstorm",
};

export default function GemPersonaRoutingModal({
  isOpen,
  onClose,
  routing,
  gems,
  personas,
  onUpdateRouting,
  onUpdateFeatureSlot,
}: GemPersonaRoutingModalProps) {
  const { t } = useLanguage();
  const { openGemModal } = useGemStore();
  const { openPersonaModal } = usePersonaStore();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[min(680px,calc(100vw-2rem))] max-w-2xl max-h-[88vh] overflow-y-auto bg-(--surface-elevated) border-(--border) text-(--text-primary)">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base md:text-lg font-bold">
            <Layers className="w-5 h-5 text-(--accent)" />
            <span>{t("novelcrafterRoutingTitle")}</span>
          </DialogTitle>
          <DialogDescription className="text-xs md:text-sm text-(--text-secondary)">
            {t("novelcrafterRoutingSubtitle")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Layer 1: Master GEM */}
          <div className="rounded-xl border border-(--control-border) bg-(--surface-muted)/70 p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label
                htmlFor="master-gem-select"
                className="flex items-center gap-2 text-sm font-bold text-(--text-primary)"
              >
                <Crown className="w-4 h-4 text-(--accent)" />
                <span>{t("novelcrafterMasterGemLabel")}</span>
              </label>
              <button
                type="button"
                onClick={() => openGemModal(null)}
                className="inline-flex items-center gap-1 text-xs font-medium text-(--accent) hover:underline focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none rounded"
              >
                <span>{t("novelcrafterManageGemsBtn")}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-(--text-secondary)">{t("novelcrafterMasterGemHint")}</p>
            <select
              id="master-gem-select"
              value={routing.masterGemId || ""}
              onChange={(e) =>
                onUpdateRouting({ masterGemId: e.target.value ? e.target.value : null })
              }
              className="w-full h-10 rounded-lg border border-(--control-border) bg-(--control-bg) px-3 text-sm text-(--text-primary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
            >
              <option value="" className="bg-(--surface-elevated) text-(--text-primary)">
                — {t("novelcrafterNoMasterGem")} —
              </option>
              {gems.map((gem) => (
                <option
                  key={gem.id}
                  value={gem.id}
                  className="bg-(--surface-elevated) text-(--text-primary)"
                >
                  {gem.name}
                </option>
              ))}
            </select>
          </div>

          {/* Layer 2 Default: Master Persona */}
          <div className="rounded-xl border border-(--border) bg-(--surface-muted)/50 p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label
                htmlFor="master-persona-select"
                className="flex items-center gap-2 text-sm font-bold text-(--text-primary)"
              >
                <UserCheck className="w-4 h-4 text-(--accent)" />
                <span>{t("novelcrafterMasterPersonaLabel")}</span>
              </label>
              <button
                type="button"
                onClick={() => openPersonaModal(null)}
                className="inline-flex items-center gap-1 text-xs font-medium text-(--accent) hover:underline focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none rounded"
              >
                <span>{t("novelcrafterManagePersonasBtn")}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-(--text-secondary)">{t("novelcrafterMasterPersonaHint")}</p>
            <select
              id="master-persona-select"
              value={routing.masterPersonaId || ""}
              onChange={(e) =>
                onUpdateRouting({ masterPersonaId: e.target.value ? e.target.value : null })
              }
              className="w-full h-10 rounded-lg border border-(--control-border) bg-(--control-bg) px-3 text-sm text-(--text-primary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
            >
              <option value="" className="bg-(--surface-elevated) text-(--text-primary)">
                — {t("novelcrafterNoMasterPersona")} —
              </option>
              {personas.map((persona) => (
                <option
                  key={persona.id}
                  value={persona.id}
                  className="bg-(--surface-elevated) text-(--text-primary)"
                >
                  {persona.name}
                </option>
              ))}
            </select>
          </div>

          {/* 6 Feature Persona Slots */}
          <div className="rounded-xl border border-(--border) bg-(--surface-muted)/30 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-(--text-primary)">
              <Sparkles className="w-4 h-4 text-(--accent)" />
              <span>{t("novelcrafterFeatureSlotsLabel")}</span>
            </div>

            <div className="space-y-2.5">
              {NOVELCRAFTER_FEATURE_SLOTS.map((slot) => {
                const slotVal = routing.featurePersonas[slot] || "inherit";
                return (
                  <div
                    key={slot}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-(--border) bg-(--surface)/80 px-3 py-2.5"
                  >
                    <label
                      htmlFor={`slot-persona-${slot}`}
                      className="text-xs md:text-sm font-semibold text-(--text-primary)"
                    >
                      {t(SLOT_LABEL_KEYS[slot])}
                    </label>
                    <select
                      id={`slot-persona-${slot}`}
                      value={slotVal}
                      onChange={(e) => onUpdateFeatureSlot(slot, e.target.value)}
                      className="sm:w-64 h-9 rounded-lg border border-(--control-border) bg-(--control-bg) px-2.5 text-xs font-medium text-(--text-primary) focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
                    >
                      <option
                        value="inherit"
                        className="bg-(--surface-elevated) text-(--text-primary)"
                      >
                        {t("novelcrafterInheritMasterPersona")}
                      </option>
                      <option
                        value="none"
                        className="bg-(--surface-elevated) text-(--text-primary)"
                      >
                        {t("novelcrafterNoPersonaOption")}
                      </option>
                      {personas.map((persona) => (
                        <option
                          key={persona.id}
                          value={persona.id}
                          className="bg-(--surface-elevated) text-(--text-primary)"
                        >
                          {persona.name}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>{t("done")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
