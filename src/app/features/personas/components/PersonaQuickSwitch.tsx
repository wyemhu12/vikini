"use client";

import React, { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePersonaStore } from "../stores/usePersonaStore";
import { useLanguage } from "../../chat/hooks/useLanguage";
import type { PersonaForUI } from "./PersonaPreview";
import { Settings, Sparkles, UserX } from "lucide-react";
import { toast } from "@/lib/store/toastStore";
import { logger } from "@/lib/utils/logger";
import { DynamicIcon } from "@/components/ui/DynamicIcon";

interface PersonaQuickSwitchProps {
  currentPersona: { name: string; icon?: string | null; color?: string | null } | null;
  conversationId: string | null;
}

export default function PersonaQuickSwitch({
  currentPersona,
  conversationId,
}: PersonaQuickSwitchProps) {
  const { openPersonaModal, triggerPersonaApplied } = usePersonaStore();
  const { t } = useLanguage();
  const [personas, setPersonas] = useState<PersonaForUI[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open && personas.length === 0) {
      setLoading(true);
      fetch("/api/personas")
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((json) => {
          const data = json.data || json;
          setPersonas(Array.isArray(data?.personas) ? data.personas : []);
        })
        .catch((error: unknown) => {
          logger.error("[PersonaQuickSwitch] Failed to load personas:", error);
          toast.error(t("personaLoadFailed"));
          setPersonas([]);
        })
        .finally(() => setLoading(false));
    }
  }, [open, personas.length, t]);

  const applyPersona = async (
    personaId: string | null,
    personaInfo: { name: string; icon: string | null; color: string | null } | null
  ) => {
    if (!conversationId) return;
    try {
      const res = await fetch("/api/conversations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: conversationId, personaId }),
      });
      if (!res.ok) throw new Error("Failed to apply persona");
      triggerPersonaApplied(conversationId, personaInfo);
      setOpen(false);
    } catch (error: unknown) {
      logger.error("[PersonaQuickSwitch] Failed to apply persona:", error);
      toast.error(t("personaApplyFailed"));
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-haspopup="dialog"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide bg-(--accent)/15 text-(--accent) border border-(--accent)/25 hover:bg-(--accent)/25 transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
          title={currentPersona ? currentPersona.name : t("selectPersona") || "Select Persona"}
        >
          {currentPersona ? (
            <>
              <DynamicIcon name={currentPersona.icon} className="w-3.5 h-3.5" />
              <span className="max-w-[120px] truncate">{currentPersona.name}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t("selectPersona") || "Persona"}</span>
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
          ) : personas.length === 0 ? (
            <div className="p-2 text-xs text-(--text-secondary) text-center">
              {t("personaNoneFound")}
            </div>
          ) : (
            <div className="space-y-1">
              {currentPersona && (
                <button
                  type="button"
                  onClick={() => applyPersona(null, null)}
                  className="w-full text-left px-2 py-1.5 rounded-md text-xs text-(--danger) hover:bg-(--danger)/10 transition-colors flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
                >
                  <UserX className="w-3.5 h-3.5 shrink-0" />
                  <span>{t("personaRemove")}</span>
                </button>
              )}
              {personas.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    applyPersona(p.id, {
                      name: p.name,
                      icon: p.icon || null,
                      color: p.color || null,
                    })
                  }
                  className="w-full text-left px-2 py-1.5 rounded-md text-xs text-(--text-primary) hover:bg-(--control-bg-hover) transition-colors flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
                >
                  <span className="text-sm w-4 shrink-0 flex items-center justify-center">
                    <DynamicIcon name={p.icon} className="w-3.5 h-3.5" />
                  </span>
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="pt-2 border-t border-(--border)">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              openPersonaModal();
            }}
            className="w-full text-center px-2 py-1.5 rounded-md text-xs font-medium bg-(--control-bg) hover:bg-(--control-bg-hover) text-(--text-primary) transition-colors flex justify-center items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
          >
            <Settings className="w-3.5 h-3.5" /> {t("managePersonas") || "Manage Personas"}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
