"use client";

import React, { useEffect, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePersonaStore } from "../stores/usePersonaStore";
import { useLanguage } from "../../chat/hooks/useLanguage";
import type { PersonaForUI } from "./PersonaPreview";
import { Settings, Sparkles, UserX } from "lucide-react";
import { toast } from "@/lib/store/toastStore";
import { logger } from "@/lib/utils/logger";
import { DynamicIcon } from "@/components/ui/DynamicIcon";
import { ComposerChip } from "../../chat/components/ComposerChip";

interface PersonaQuickSwitchProps {
  currentPersona: { name: string; icon?: string | null; color?: string | null } | null;
  conversationId: string | null;
  /** Prefix the name with "Persona:" (composer chip). The options sheet row already has a title. */
  showPrefix?: boolean;
}

export default function PersonaQuickSwitch({
  currentPersona,
  conversationId,
  showPrefix = true,
}: PersonaQuickSwitchProps) {
  const { openPersonaModal, triggerPersonaApplied } = usePersonaStore();
  const { t } = useLanguage();
  const [personas, setPersonas] = useState<PersonaForUI[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
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
    if (requestedRef.current || personas.length > 0) return;

    let cancelled = false;
    requestedRef.current = true;
    setLoading(true);

    fetch("/api/personas")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: unknown) => {
        if (cancelled) return;
        const payload =
          typeof json === "object" && json !== null && "data" in json
            ? (json as { data?: { personas?: unknown } }).data
            : (json as { personas?: unknown } | null);
        setPersonas(Array.isArray(payload?.personas) ? (payload.personas as PersonaForUI[]) : []);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        logger.error("[PersonaQuickSwitch] Failed to load personas:", error);
        toast.error(tRef.current("personaLoadFailed"));
        setPersonas([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, personas.length]);

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
        <ComposerChip
          active={Boolean(currentPersona)}
          aria-haspopup="dialog"
          title={currentPersona ? currentPersona.name : t("selectPersona")}
        >
          {currentPersona ? (
            <DynamicIcon name={currentPersona.icon} className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <Sparkles aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />
          )}
          <span className="max-w-[140px] truncate">
            {currentPersona
              ? showPrefix
                ? `${t("personaChip")}: ${currentPersona.name}`
                : currentPersona.name
              : t("personaChip")}
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
          ) : personas.length === 0 ? (
            <div className="p-2 text-xs text-(--muted) text-center">{t("personaNoneFound")}</div>
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
                  className="w-full text-left px-2 py-1.5 rounded-md text-xs text-(--text) hover:bg-(--raised) transition-colors flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
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
        <div className="pt-2 border-t border-(--line)">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              openPersonaModal();
            }}
            className="w-full text-center px-2 py-1.5 rounded-md text-xs font-medium bg-(--raised) hover:bg-(--raised) text-(--text) transition-colors flex justify-center items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
          >
            <Settings className="w-3.5 h-3.5" /> {t("managePersonas") || "Manage Personas"}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
