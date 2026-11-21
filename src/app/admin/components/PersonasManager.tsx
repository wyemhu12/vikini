"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Users, Plus, Edit2, Trash2, AlertCircle, X, RotateCcw } from "lucide-react";
import PersonaEditor from "@/app/features/personas/components/PersonaEditor";
import { DynamicIcon } from "@/components/ui/DynamicIcon";
import { Skeleton } from "@/components/ui/skeleton";
import type { PersonaForUI } from "@/app/features/personas/components/PersonaPreview";
import type { PersonaTone } from "@/types/persona";
import { motion } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";
import { toast } from "@/lib/store/toastStore";
import { confirm } from "@/lib/store/confirmStore";
import { logger } from "@/lib/utils/logger";

interface PremadePersona {
  id: string;
  name: string;
  description: string | null;
  tone: PersonaTone;
  use_emojis: boolean;
  use_headers_lists: boolean;
  user_context: string | null;
  custom_instructions: string | null;
  icon: string | null;
  color: string | null;
  is_premade: boolean;
}

const TONE_KEYS: Record<string, string> = {
  default: "toneDefault",
  professional: "toneProfessional",
  friendly: "toneFriendly",
  candid: "toneCandid",
  quirky: "toneQuirky",
  efficient: "toneEfficient",
  cynical: "toneCynical",
  lawyer: "toneLawyer",
};

export default function PersonasManager() {
  const [personas, setPersonas] = useState<PremadePersona[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Editor State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<PremadePersona | null>(null);

  const { t } = useLanguage();
  const tRef = useRef(t);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const fetchPersonas = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/admin/personas");
      if (!res.ok) throw new Error(tRef.current("adminPersonasLoadFailed"));
      const json = await res.json();
      const data = json.data || json;
      setPersonas(data.personas || []);
    } catch (err: unknown) {
      logger.error("[PersonasManager] Failed to load personas:", err);
      setError(err instanceof Error ? err.message : tRef.current("adminPersonasLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPersonas();
  }, [fetchPersonas]);

  const deletePersona = async (personaId: string) => {
    const ok = await confirm({
      title: t("confirmDeletePersona") || "Delete Persona?",
      description: t("deletePersonaWarning") || "This action cannot be undone.",
      variant: "danger",
      confirmLabel: t("personaDelete") || "Delete",
      cancelLabel: t("cancel") || "Cancel",
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/admin/personas?id=${personaId}`, {
        method: "DELETE",
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error?.message || json?.error || "Failed to delete persona");
      }

      toast.success(t("personaDeleted") || "Persona deleted successfully");
      await fetchPersonas();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("failedDeletePersona") || "Failed to delete persona"
      );
    }
  };

  const handleSavePersona = async (personaData: Partial<PersonaForUI>) => {
    try {
      const method = personaData.id ? "PUT" : "POST";
      const res = await fetch("/api/admin/personas", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: personaData.id || undefined,
          name: personaData.name,
          description: personaData.description,
          tone: personaData.tone,
          useEmojis: personaData.useEmojis,
          useHeadersLists: personaData.useHeadersLists,
          userContext: personaData.userContext,
          customInstructions: personaData.customInstructions,
          icon: personaData.icon,
          color: personaData.color,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error?.message || json.error || "Failed to save persona");
      }

      toast.success(t("personaSaved") || "Persona saved successfully");
      await fetchPersonas();
      setIsEditorOpen(false);
      setEditingPersona(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("failedSavePersona") || "Failed to save persona"
      );
    }
  };

  const openAddModal = () => {
    setEditingPersona(null);
    setIsEditorOpen(true);
  };

  const openEditModal = (persona: PremadePersona) => {
    setEditingPersona(persona);
    setIsEditorOpen(true);
  };

  if (loading) {
    return (
      <div role="status" className="space-y-4 py-2">
        <span className="sr-only">{t("loadingPersonas")}</span>
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, idx) => (
            <Skeleton key={idx} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-(--danger)/10 border border-(--danger)/30 text-(--danger)"
      >
        <div className="flex items-center gap-2">
          <AlertCircle aria-hidden="true" className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
        <button
          type="button"
          onClick={() => void fetchPersonas()}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-(--raised) hover:bg-(--raised-hover) text-(--text) border border-(--line) transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
        >
          <RotateCcw aria-hidden="true" className="w-4 h-4" />
          {t("tryAgain")}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Users aria-hidden="true" className="w-5 h-5 text-(--accent)" />
          <h2 className="text-xl font-semibold text-(--text)">
            {t("globalPersonasManagement") || "Global Personas Management"}
          </h2>
          <span className="text-sm text-(--faint)">
            ({personas.length} {t("personaCount") || "personas"})
          </span>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2 min-h-10 bg-(--soft) text-(--accent) rounded-lg hover:bg-(--accent)/20 border border-(--accent)/30 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
        >
          <Plus aria-hidden="true" className="w-4 h-4" />
          {t("addPersona") || "Add Persona"}
        </button>
      </div>

      {personas.length === 0 ? (
        <div className="text-center py-12 text-(--muted)">
          <Users aria-hidden="true" className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{t("noGlobalPersonas") || "No global personas found"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {personas.map((persona) => (
            <div
              key={persona.id}
              className="p-4 rounded-lg bg-(--raised) border border-(--line) hover:border-(--line-strong) transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  {persona.icon && (
                    <span className="text-2xl shrink-0 flex items-center justify-center w-7 h-7 text-(--text)">
                      <DynamicIcon name={persona.icon} className="w-5 h-5" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <h3 className="font-semibold text-(--text) truncate">{persona.name}</h3>
                    <span className="inline-block rounded bg-(--surface) border border-(--line) px-1.5 py-0.5 text-xs text-(--muted)">
                      {TONE_KEYS[persona.tone] ? t(TONE_KEYS[persona.tone]) : persona.tone}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditModal(persona)}
                    aria-label={`${t("edit")} ${persona.name}`}
                    className="inline-flex h-9 w-9 md:h-8 md:w-8 items-center justify-center rounded hover:bg-(--raised-hover) text-(--muted) hover:text-(--text) transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                    title={t("edit") || "Edit"}
                  >
                    <Edit2 aria-hidden="true" className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deletePersona(persona.id)}
                    aria-label={`${t("personaDelete")} ${persona.name}`}
                    className="inline-flex h-9 w-9 md:h-8 md:w-8 items-center justify-center rounded hover:bg-(--danger)/20 text-(--muted) hover:text-(--danger) transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                    title={t("personaDelete") || "Delete"}
                  >
                    <Trash2 aria-hidden="true" className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {persona.description && (
                <p className="text-sm text-(--muted) line-clamp-2">{persona.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      <Dialog.Root open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-(--z-modal) bg-(--overlay) backdrop-blur-sm" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed inset-0 z-(--z-modal) flex items-center justify-center p-4 pointer-events-none"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 0 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-(--surface) text-(--text) border border-(--line) rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl relative my-auto pointer-events-auto"
            >
              <div className="flex-none flex items-center justify-between p-4 border-b border-(--line) bg-(--surface) rounded-t-xl z-20">
                <Dialog.Title className="text-lg font-semibold">
                  {editingPersona
                    ? t("editGlobalPersona") || "Edit Global Persona"
                    : t("createGlobalPersona") || "Create Global Persona"}
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    aria-label={t("close")}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-(--raised-hover) transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                  >
                    <X aria-hidden="true" className="w-5 h-5 text-(--muted)" />
                  </button>
                </Dialog.Close>
              </div>

              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar min-h-0">
                <PersonaEditor
                  persona={
                    editingPersona
                      ? {
                          id: editingPersona.id,
                          name: editingPersona.name,
                          description: editingPersona.description || "",
                          tone: editingPersona.tone || "default",
                          useEmojis: editingPersona.use_emojis ?? true,
                          useHeadersLists: editingPersona.use_headers_lists ?? true,
                          userContext: editingPersona.user_context || "",
                          customInstructions: editingPersona.custom_instructions || "",
                          icon: editingPersona.icon || "",
                          color: editingPersona.color || "",
                        }
                      : null
                  }
                  onSave={handleSavePersona}
                />
              </div>
            </motion.div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
