"use client";

import { useState, useEffect } from "react";
import { Users, Loader2, Plus, Edit2, Trash2, AlertCircle, X } from "lucide-react";
import PersonaEditor from "@/app/features/personas/components/PersonaEditor";
import type { PersonaForUI } from "@/app/features/personas/components/PersonaPreview";
import type { PersonaTone } from "@/types/persona";
import { motion } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";
import { toast } from "@/lib/store/toastStore";
import { confirm } from "@/lib/store/confirmStore";

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

const TONE_LABELS: Record<string, string> = {
  default: "Default",
  professional: "Professional",
  friendly: "Friendly",
  candid: "Candid",
  quirky: "Quirky",
  efficient: "Efficient",
  cynical: "Cynical",
  lawyer: "Lawyer",
};

export default function PersonasManager() {
  const [personas, setPersonas] = useState<PremadePersona[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Editor State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<PremadePersona | null>(null);

  const { t } = useLanguage();

  useEffect(() => {
    void fetchPersonas();
  }, []);

  const fetchPersonas = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/personas");
      if (!res.ok) throw new Error("Failed to fetch personas");
      const json = await res.json();
      const data = json.data || json;
      setPersonas(data.personas || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load personas");
    } finally {
      setLoading(false);
    }
  };

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
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
        <span className="ml-2 text-gray-400">{t("loadingPersonas") || "Loading personas..."}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-400 py-4">
        <AlertCircle className="w-5 h-5" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-400" />
          <h2 className="text-xl font-semibold text-white">
            {t("globalPersonasManagement") || "Global Personas Management"}
          </h2>
          <span className="text-sm text-gray-500">
            ({personas.length} {t("personaCount") || "personas"})
          </span>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 border border-purple-500/30 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t("addPersona") || "Add Persona"}
        </button>
      </div>

      {personas.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{t("noGlobalPersonas") || "No global personas found"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {personas.map((persona) => (
            <div
              key={persona.id}
              className="p-4 rounded-lg bg-white/2 border border-white/10 hover:border-white/20 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {persona.icon && <span className="text-2xl">{persona.icon}</span>}
                  <div>
                    <h3 className="font-semibold text-white">{persona.name}</h3>
                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-gray-400">
                      {TONE_LABELS[persona.tone] || persona.tone}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEditModal(persona)}
                    className="p-1.5 rounded hover:bg-white/10 transition-colors"
                    title={t("edit") || "Edit"}
                  >
                    <Edit2 className="w-4 h-4 text-gray-400 hover:text-white" />
                  </button>
                  <button
                    onClick={() => deletePersona(persona.id)}
                    className="p-1.5 rounded hover:bg-red-500/20 transition-colors"
                    title={t("personaDelete") || "Delete"}
                  >
                    <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-400" />
                  </button>
                </div>
              </div>
              {persona.description && (
                <p className="text-sm text-gray-400 line-clamp-2">{persona.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      <Dialog.Root open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-(--overlay) backdrop-blur-sm" />
          <Dialog.Content
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            aria-label="Persona editor"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 0 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-(--surface-elevated) text-(--text-primary) border border-(--border) rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl relative my-auto pointer-events-auto"
            >
              <div className="flex-none flex items-center justify-between p-4 border-b border-(--border) bg-(--surface-elevated) rounded-t-xl z-20">
                <Dialog.Title className="text-lg font-semibold">
                  {editingPersona
                    ? t("editGlobalPersona") || "Edit Global Persona"
                    : t("createGlobalPersona") || "Create Global Persona"}
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button className="p-1 rounded-full hover:bg-white/10 transition-colors">
                    <X className="w-5 h-5 text-neutral-400" />
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
