"use client";

import React, { useEffect, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useGemStore } from "../stores/useGemStore";
import { useLanguage } from "../../chat/hooks/useLanguage";
import type { Gem } from "./GemPreview";
import { Settings, Sparkles } from "lucide-react";
import { toast } from "@/lib/store/toastStore";
import { logger } from "@/lib/utils/logger";
import { DynamicIcon } from "@/components/ui/DynamicIcon";
import { ComposerChip } from "../../chat/components/ComposerChip";

interface GemQuickSwitchProps {
  currentGem: { name: string; icon?: string | null; color?: string | null } | null;
  conversationId: string | null;
  /** Prefix the name with "Gem:" (composer chip). The options sheet row already has a title. */
  showPrefix?: boolean;
}

export default function GemQuickSwitch({
  currentGem,
  conversationId,
  showPrefix = true,
}: GemQuickSwitchProps) {
  const { openGemModal, triggerGemApplied } = useGemStore();
  const { t } = useLanguage();
  const [gems, setGems] = useState<Gem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  // One request per popover opening: an empty or failed result must not refetch on every render.
  const requestedRef = useRef(false);
  const tRef = useRef(t);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    if (!open) {
      requestedRef.current = false;
      return;
    }
    if (requestedRef.current || gems.length > 0) return;

    let cancelled = false;
    requestedRef.current = true;
    setLoading(true);

    fetch("/api/gems")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: unknown) => {
        if (cancelled) return;
        const payload =
          typeof json === "object" && json !== null && "data" in json
            ? (json as { data?: { gems?: unknown } }).data
            : (json as { gems?: unknown } | null);
        setGems(Array.isArray(payload?.gems) ? (payload.gems as Gem[]) : []);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        logger.error("[GemQuickSwitch] Failed to load gems:", error);
        toast.error(tRef.current("gemLoadFailed"));
        setGems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, gems.length]);

  const applyGem = async (
    gemId: string | null,
    gemInfo: { name: string; icon: string | null; color: string | null } | null
  ) => {
    if (!conversationId) return;
    try {
      const res = await fetch("/api/conversations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: conversationId, gemId }),
      });
      if (!res.ok) throw new Error("Failed to apply gem");
      triggerGemApplied(conversationId, gemInfo);
      setOpen(false);
    } catch (error: unknown) {
      logger.error("[GemQuickSwitch] Failed to apply gem:", error);
      toast.error(t("gemApplyFailed"));
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ComposerChip
          active={Boolean(currentGem)}
          aria-haspopup="dialog"
          title={currentGem ? currentGem.name : t("selectGem")}
        >
          {currentGem ? (
            <DynamicIcon name={currentGem.icon} className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <Sparkles aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />
          )}
          <span className="max-w-[140px] truncate">
            {currentGem
              ? showPrefix
                ? `${t("gemChip")}: ${currentGem.name}`
                : currentGem.name
              : t("gemChip")}
          </span>
        </ComposerChip>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        sideOffset={8}
        className="w-56 p-2 rounded-xl bg-(--surface)/95 backdrop-blur-md border border-(--line) shadow-xl"
      >
        <div className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--line)] mb-2">
          {loading ? (
            <div className="p-2 text-xs text-(--muted) text-center">{t("loading")}</div>
          ) : gems.length === 0 ? (
            <div className="p-2 text-xs text-(--muted) text-center">{t("gemNoneFound")}</div>
          ) : (
            <div className="space-y-1">
              {currentGem && (
                <button
                  type="button"
                  onClick={() => applyGem(null, null)}
                  className="w-full text-left px-2 py-1.5 rounded-md text-xs text-(--danger) hover:bg-(--danger)/10 transition-colors flex items-center gap-2"
                >
                  <span className="w-4 text-center"></span> {t("gemRemove")}
                </button>
              )}
              {gems.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() =>
                    applyGem(g.id, { name: g.name, icon: g.icon || null, color: g.color || null })
                  }
                  className="w-full text-left px-2 py-1.5 rounded-md text-xs text-(--text) hover:bg-(--raised) transition-colors flex items-center gap-2"
                >
                  <span className="text-sm w-4 shrink-0 flex items-center justify-center">
                    <DynamicIcon name={g.icon} className="w-3.5 h-3.5" />
                  </span>
                  <span className="truncate">{g.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="pt-2 border-t border-(--line)">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              openGemModal();
            }}
            className="w-full text-center px-2 py-1.5 rounded-md text-xs font-medium bg-(--raised) hover:bg-(--raised) text-(--text) transition-colors flex justify-center items-center gap-1.5"
          >
            <Settings className="w-3.5 h-3.5" /> {t("manageGems") || "Manage GEMs"}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
