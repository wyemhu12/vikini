"use client";

import { useLanguage } from "../../chat/hooks/useLanguage";
import type { PersonaForUI } from "./PersonaPreview";
import { Check, Eye, Edit2, Trash2 } from "lucide-react";

interface PersonaListProps {
  loading: boolean;
  personas: PersonaForUI[];
  selectedPersonaId: string | null;
  onSelect: (persona: PersonaForUI) => void;
  onPreview: (persona: PersonaForUI) => void;
  onEdit: (persona: PersonaForUI) => void;
  onDelete: (persona: PersonaForUI) => void;
}

const TONE_BADGES: Record<string, string> = {
  default: "Default",
  professional: "Professional",
  friendly: "Friendly",
  candid: "Candid",
  quirky: "Quirky",
  efficient: "Efficient",
  cynical: "Cynical",
  lawyer: "Lawyer",
};

function PersonaCard({
  persona,
  selected,
  isPremade,
  onSelect,
  onPreview,
  onEdit,
  onDelete,
  t,
}: {
  persona: PersonaForUI;
  selected: boolean;
  isPremade: boolean;
  onSelect?: (persona: PersonaForUI) => void;
  onPreview?: (persona: PersonaForUI) => void;
  onEdit?: (persona: PersonaForUI) => void;
  onDelete?: (persona: PersonaForUI) => void;
  t: (key: string) => string;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 transition-[background-color,color,border-color,transform,filter] duration-200 ${
        selected
          ? "border-(--primary) bg-(--primary)/10"
          : "border-(--border) bg-(--surface) hover:bg-(--surface-muted)"
      }`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm">{persona.icon || "🎭"}</span>
            <div className="truncate text-sm font-medium">{persona.name}</div>
            <span className="rounded bg-(--control-bg) px-1.5 py-0.5 text-[10px] text-(--text-secondary)">
              {TONE_BADGES[persona.tone] || persona.tone}
            </span>
            {isPremade && (
              <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] text-purple-400 font-medium">
                Premade
              </span>
            )}
          </div>
          {persona.description ? (
            <div className="mt-1 line-clamp-2 text-xs text-(--text-secondary)">
              {persona.description}
            </div>
          ) : null}
        </div>

        <div className="flex flex-row sm:flex-col gap-1.5 w-full sm:w-28 shrink-0 mt-2 sm:mt-0">
          <button
            onClick={() => onSelect?.(persona)}
            aria-label={t("select")}
            className="flex-1 rounded-md bg-(--primary) px-2 py-1 text-xs text-black transition-[background-color,color,border-color,transform,filter] hover:brightness-110 active:scale-95 flex items-center justify-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t("select")}</span>
          </button>

          <button
            onClick={() => onPreview?.(persona)}
            aria-label={t("preview")}
            className="flex-1 rounded-md border border-(--border) px-2 py-1 text-xs text-(--text-secondary) hover:bg-(--control-bg-hover) hover:text-(--text-primary) transition-[background-color,color,border-color,transform,filter] active:scale-95 flex items-center justify-center gap-1.5"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t("preview")}</span>
          </button>

          {!isPremade && (
            <>
              <button
                onClick={() => onEdit?.(persona)}
                aria-label={t("personaEdit") || "Edit"}
                className="flex-1 rounded-md border border-(--border) px-2 py-1 text-xs text-(--text-secondary) hover:bg-(--control-bg-hover) hover:text-(--text-primary) transition-[background-color,color,border-color,transform,filter] active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t("personaEdit") || "Edit"}</span>
              </button>

              <button
                onClick={() => onDelete?.(persona)}
                aria-label={t("personaDelete") || "Delete"}
                className="flex-1 rounded-md border border-(--danger)/30 px-2 py-1 text-xs text-(--danger) hover:bg-(--danger)/10 transition-[background-color,color,border-color,transform,filter] active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t("personaDelete") || "Delete"}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PersonaList({
  loading,
  personas,
  selectedPersonaId,
  onSelect,
  onPreview,
  onEdit,
  onDelete,
}: PersonaListProps) {
  const { t } = useLanguage();

  if (loading) {
    return <div className="text-xs text-(--text-secondary)">{t("loading")}</div>;
  }

  if (personas.length === 0) {
    return (
      <div className="text-xs text-(--text-secondary) text-center py-4">
        {t("personaNoPersonas") || "No personas yet. Create one to get started!"}
      </div>
    );
  }

  const premadePersonas = personas.filter((p) => p.isPremade);
  const userPersonas = personas.filter((p) => !p.isPremade);

  return (
    <div className="space-y-4">
      {/* Premade Personas Section */}
      {premadePersonas.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-(--text-secondary) uppercase tracking-wider mb-2">
            {t("premadePersonas") || "Premade Personas"}
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
            {premadePersonas.map((p) => (
              <PersonaCard
                key={p.id}
                persona={p}
                selected={selectedPersonaId === p.id}
                isPremade
                onSelect={onSelect}
                onPreview={onPreview}
                t={t}
              />
            ))}
          </div>
        </div>
      )}

      {/* User Personas Section */}
      <div>
        {premadePersonas.length > 0 && (
          <div className="text-xs font-semibold text-(--text-secondary) uppercase tracking-wider mb-2">
            {t("personaMyPersonas") || "My Personas"}
          </div>
        )}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
          {userPersonas.map((p) => (
            <PersonaCard
              key={p.id}
              persona={p}
              selected={selectedPersonaId === p.id}
              isPremade={false}
              onSelect={onSelect}
              onPreview={onPreview}
              onEdit={onEdit}
              onDelete={onDelete}
              t={t}
            />
          ))}
        </div>
        {userPersonas.length === 0 && premadePersonas.length > 0 && (
          <div className="text-xs text-(--text-secondary) text-center py-4">
            {t("personaNoPersonas") || "No custom personas yet. Create one to get started!"}
          </div>
        )}
      </div>
    </div>
  );
}
