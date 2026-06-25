"use client";

import { useLanguage } from "../../chat/hooks/useLanguage";
import type { PersonaForUI } from "./PersonaPreview";

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

  return (
    <div className="space-y-2">
      {personas.map((p) => {
        const selected = selectedPersonaId === p.id;
        return (
          <div
            key={p.id}
            className={`rounded-lg border px-3 py-2 transition-all duration-200 ${
              selected
                ? "border-(--primary) bg-(--primary)/10"
                : "border-(--border) bg-(--surface) hover:bg-(--surface-muted)"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{p.icon || "🎭"}</span>
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  <span className="rounded bg-(--control-bg) px-1.5 py-0.5 text-[10px] text-(--text-secondary)">
                    {TONE_BADGES[p.tone] || p.tone}
                  </span>
                </div>
                {p.description ? (
                  <div className="mt-1 line-clamp-2 text-xs text-(--text-secondary)">
                    {p.description}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-1">
                <button
                  onClick={() => onSelect?.(p)}
                  className="rounded-md bg-(--primary) px-2 py-1 text-xs text-black transition-all hover:brightness-110 active:scale-95"
                >
                  {t("select")}
                </button>

                <button
                  onClick={() => onPreview?.(p)}
                  className="rounded-md border border-(--border) px-2 py-1 text-xs text-(--text-secondary) hover:bg-(--control-bg-hover) hover:text-(--text-primary) transition-all active:scale-95 flex items-center justify-center gap-1"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  {t("preview")}
                </button>

                <button
                  onClick={() => onEdit?.(p)}
                  className="rounded-md border border-(--border) px-2 py-1 text-xs text-(--text-secondary) hover:bg-(--control-bg-hover) hover:text-(--text-primary) transition-all active:scale-95"
                >
                  {t("personaEdit") || "Edit"}
                </button>

                <button
                  onClick={() => onDelete?.(p)}
                  className="rounded-md border border-(--danger)/30 px-2 py-1 text-xs text-(--danger) hover:bg-(--danger)/10 transition-all active:scale-95"
                >
                  {t("personaDelete") || "Delete"}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
