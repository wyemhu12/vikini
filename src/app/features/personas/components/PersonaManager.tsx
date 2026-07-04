"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import PersonaList from "./PersonaList";
import PersonaEditor from "./PersonaEditor";
import PersonaPreview, { type PersonaForUI } from "./PersonaPreview";
import { usePersonaStore } from "../stores/usePersonaStore";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { cn } from "@/lib/utils/cn";
import { toast } from "@/lib/store/toastStore";
import { confirm } from "@/lib/store/confirmStore";
import type { PersonaTone } from "@/types/persona";

interface PersonaManagerProps {
  inModal?: boolean;
}

export default function PersonaManager({ inModal = false }: PersonaManagerProps) {
  const sp = useSearchParams();
  const { t } = useLanguage();

  const { contextConversationId, closePersonaModal, triggerPersonaApplied } = usePersonaStore();
  const urlConversationId = sp?.get("conversationId");
  const conversationId = contextConversationId || urlConversationId;

  const [personas, setPersonas] = useState<PersonaForUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [editingPersona, setEditingPersona] = useState<PersonaForUI | null>(null);
  const [previewPersona, setPreviewPersona] = useState<PersonaForUI | null>(null);
  const [status, setStatus] = useState("");
  const [isApplying, setIsApplying] = useState(false);

  const personaList = useMemo(() => personas, [personas]);

  async function refresh() {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/personas", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as {
        data?: { personas?: PersonaForUI[] };
        personas?: PersonaForUI[];
      };
      const data = json.data || json;
      const rawPersonas = (data as { personas?: PersonaForUI[] })?.personas;
      setPersonas(Array.isArray(rawPersonas) ? rawPersonas : []);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load personas";
      setFetchError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const applyPersonaToConversation = async (personaId: string | null) => {
    if (!conversationId) {
      setStatus(`${t("error") || "Error"}: No conversation ID`);
      return;
    }
    if (isApplying) return;
    setIsApplying(true);

    setStatus(t("loading") || "Loading...");
    try {
      const res = await fetch("/api/conversations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: conversationId, personaId }),
      });
      const json = (await res.json()) as { error?: { message?: string } | string };
      if (!res.ok) {
        const errMsg =
          typeof json?.error === "string"
            ? json.error
            : (json?.error as { message?: string })?.message || "Apply persona failed";
        throw new Error(errMsg);
      }

      setSelectedPersonaId(personaId);
      setStatus(t("success") || "Success");

      // Find the persona data to pass for optimistic update
      const selectedPersona = personaId ? personas.find((p) => p.id === personaId) : null;
      const personaInfo = selectedPersona
        ? {
            name: selectedPersona.name,
            icon: selectedPersona.icon || null,
            color: selectedPersona.color || null,
          }
        : null;

      // Trigger optimistic update
      triggerPersonaApplied(conversationId, personaInfo);

      setTimeout(() => {
        closePersonaModal();
      }, 300);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Apply persona failed";
      setStatus(message);
      toast.error(message);
    } finally {
      setIsApplying(false);
    }
  };

  const clearPersona = async () => applyPersonaToConversation(null);

  const onCreate = () => {
    setPreviewPersona(null);
    setEditingPersona({
      id: "",
      name: "",
      description: "",
      tone: "default" as PersonaTone,
      useEmojis: true,
      useHeadersLists: true,
      userContext: "",
      customInstructions: "",
      icon: "",
      color: "",
    });
  };

  const onEdit = (persona: PersonaForUI) => setEditingPersona(persona);

  const onDelete = async (persona: PersonaForUI) => {
    const ok = await confirm({
      title: t("personaDeleteConfirm") || "Delete Persona?",
      description:
        t("personaDeleteWarning") ||
        `Are you sure you want to delete "${persona.name}"? This action cannot be undone.`,
      variant: "danger",
      confirmLabel: t("personaDelete") || "Delete",
      cancelLabel: t("cancel") || "Cancel",
    });
    if (!ok) return;

    setStatus(t("loading") || "Loading...");
    try {
      const res = await fetch("/api/personas", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: persona.id }),
      });
      const json = (await res.json()) as { error?: { message?: string } | string };
      if (!res.ok) {
        const errMsg =
          typeof json?.error === "string"
            ? json.error
            : (json?.error as { message?: string })?.message || "Delete failed";
        throw new Error(errMsg);
      }
      toast.success(t("personaDeleted") || "Persona deleted successfully");
      setStatus("");
      if (editingPersona?.id === persona.id) setEditingPersona(null);
      await refresh();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Delete failed";
      toast.error(message);
      setStatus(message);
    }
  };

  const onSave = async (payload: Partial<PersonaForUI>) => {
    setStatus(t("loading") || "Loading...");
    try {
      const isNew = !payload.id;
      const res = await fetch("/api/personas", {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await res.json()) as {
        data?: { persona?: PersonaForUI };
        persona?: PersonaForUI;
        error?: { message?: string } | string;
      };
      if (!res.ok) {
        const errMsg =
          typeof json?.error === "string"
            ? json.error
            : (json?.error as { message?: string })?.message || "Save failed";
        throw new Error(errMsg);
      }

      setStatus(t("success") || "Success");
      toast.success(
        isNew ? t("personaCreated") || "Persona created!" : t("personaSaved") || "Persona saved!"
      );
      const data = json.data || json;
      setEditingPersona((data as { persona?: PersonaForUI })?.persona || null);
      await refresh();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Save failed";
      toast.error(message);
      setStatus(message);
    }
  };

  return (
    <div className="flex flex-col h-full bg-transparent text-(--text-primary) overflow-hidden">
      <div
        className={cn(
          "flex-none py-4 border-b border-(--border) flex items-center justify-between bg-(--surface)/80 backdrop-blur-md sticky top-0 z-10",
          inModal ? "pl-6 pr-14" : "px-6"
        )}
      >
        <div>
          <h1 className="text-xl font-semibold">{t("personasTitle") || "Manage Personas"}</h1>
          <p className="text-xs text-(--text-secondary) truncate max-w-md">
            {conversationId
              ? `${t("personaApplied") || "Active Persona"}: ${conversationId.slice(0, 8)}...`
              : "Global Mode"}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCreate}
            className="rounded-lg bg-(--primary) px-3 py-1.5 text-sm text-black font-medium hover:brightness-110 transition-colors active:scale-95"
          >
            + {t("personaCreate") || "New Persona"}
          </button>
        </div>
      </div>

      <div
        className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 scrollbar-thin scrollbar-thumb-[var(--border)]"
        style={{
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-y",
          overscrollBehavior: "contain",
        }}
      >
        {status && (
          <div className="mb-4 rounded-lg border border-(--border) bg-(--surface-muted) px-3 py-2 text-xs text-(--text-secondary)">
            {status}
          </div>
        )}

        <div
          className={cn(
            "grid gap-6 transition-colors duration-300",
            editingPersona || previewPersona
              ? "grid-cols-1 lg:grid-cols-[360px_1fr]"
              : "grid-cols-1"
          )}
        >
          <div
            className="rounded-xl border border-(--border) bg-(--surface-muted)/50 p-3 max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--control-border)] hover:scrollbar-thumb-[var(--border)]"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-medium">{t("personaMyPersonas") || "My Personas"}</div>
              <button
                onClick={clearPersona}
                className="rounded-md border border-(--control-border) px-2 py-1 text-xs text-(--text-secondary) hover:bg-(--control-bg-hover) transition-colors"
              >
                Reset Default
              </button>
            </div>

            {fetchError && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs mb-3">
                <span className="flex-1">Failed to load: {fetchError}</span>
                <button
                  onClick={refresh}
                  className="px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 transition-colors font-medium"
                >
                  Retry
                </button>
              </div>
            )}

            <div className="mb-4 rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-xs leading-relaxed text-blue-400/90">
              <span className="font-semibold text-blue-400">GEM vs Persona:</span>
              <br />• <strong>GEM</strong> defines <strong>WHAT</strong> the AI does (its
              Task/Role).
              <br />• <strong>Persona</strong> defines <strong>HOW</strong> the AI communicates (its
              Tone/Format).
            </div>

            <PersonaList
              loading={loading}
              personas={personaList}
              selectedPersonaId={selectedPersonaId}
              onSelect={(persona) => applyPersonaToConversation(persona.id)}
              onPreview={(persona) => {
                setEditingPersona(null);
                setPreviewPersona(persona);
              }}
              onEdit={(persona) => {
                setPreviewPersona(null);
                onEdit(persona);
              }}
              onDelete={onDelete}
            />
          </div>

          {(editingPersona || previewPersona) && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-1">
              {editingPersona ? (
                <div className="rounded-xl border border-(--border) bg-(--surface) p-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium">Editor</h3>
                    <button
                      onClick={() => setEditingPersona(null)}
                      className="text-xs text-(--text-secondary) hover:text-(--text-primary)"
                    >
                      {t("cancel") || "Cancel"}
                    </button>
                  </div>
                  <PersonaEditor persona={editingPersona} onSave={onSave} />
                </div>
              ) : previewPersona ? (
                <div className="rounded-xl border border-(--border) bg-(--surface-muted)/50 h-full">
                  <PersonaPreview persona={previewPersona} />
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
