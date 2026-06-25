"use client";

import React, { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useGemStore } from "../stores/useGemStore";
import { useLanguage } from "../../chat/hooks/useLanguage";
import type { Gem } from "./GemPreview";
import { Settings, Sparkles } from "lucide-react";
import { toast } from "@/lib/store/toastStore";

interface GemQuickSwitchProps {
  currentGem: { name: string; icon?: string | null; color?: string | null } | null;
  conversationId: string | null;
}

export default function GemQuickSwitch({ currentGem, conversationId }: GemQuickSwitchProps) {
  const { openGemModal, triggerGemApplied } = useGemStore();
  const { t } = useLanguage();
  const [gems, setGems] = useState<Gem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open && gems.length === 0) {
      setLoading(true);
      fetch("/api/gems")
        .then((r) => r.json())
        .then((json) => {
          const data = json.data || json;
          setGems(Array.isArray(data?.gems) ? data.gems : []);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
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
    } catch (_e) {
      toast.error("Failed to apply gem");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide bg-(--accent)/15 text-(--accent) border border-(--accent)/20 hover:bg-(--accent)/25 transition-colors"
          title={currentGem ? currentGem.name : t("selectGem") || "Select GEM"}
        >
          {currentGem ? (
            <>
              <span className="text-sm">{currentGem.icon || "💎"}</span>
              <span className="max-w-[120px] truncate">{currentGem.name}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t("selectGem") || "GEM"}</span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        sideOffset={8}
        className="w-56 p-2 rounded-xl bg-(--surface-elevated)/95 backdrop-blur-md border border-(--border) shadow-xl"
      >
        <div className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--border)] mb-2">
          {loading ? (
            <div className="p-2 text-xs text-(--text-secondary) text-center">{t("loading")}</div>
          ) : gems.length === 0 ? (
            <div className="p-2 text-xs text-(--text-secondary) text-center">No GEMs found</div>
          ) : (
            <div className="space-y-1">
              {currentGem && (
                <button
                  onClick={() => applyGem(null, null)}
                  className="w-full text-left px-2 py-1.5 rounded-md text-xs text-(--danger) hover:bg-(--danger)/10 transition-colors flex items-center gap-2"
                >
                  <span className="w-4 text-center">✕</span> Remove GEM
                </button>
              )}
              {gems.map((g) => (
                <button
                  key={g.id}
                  onClick={() =>
                    applyGem(g.id, { name: g.name, icon: g.icon || null, color: g.color || null })
                  }
                  className="w-full text-left px-2 py-1.5 rounded-md text-xs text-(--text-primary) hover:bg-(--control-bg-hover) transition-colors flex items-center gap-2"
                >
                  <span className="text-sm w-4 text-center">{g.icon || "💎"}</span>
                  <span className="truncate">{g.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="pt-2 border-t border-(--border)">
          <button
            onClick={() => {
              setOpen(false);
              openGemModal();
            }}
            className="w-full text-center px-2 py-1.5 rounded-md text-xs font-medium bg-(--control-bg) hover:bg-(--control-bg-hover) text-(--text-primary) transition-colors flex justify-center items-center gap-1.5"
          >
            <Settings className="w-3.5 h-3.5" /> {t("manageGems") || "Manage GEMs"}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
