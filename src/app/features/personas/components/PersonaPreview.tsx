"use client";

import { useLanguage } from "../../chat/hooks/useLanguage";
import type { PersonaTone } from "@/types/persona";

export interface PersonaForUI {
  id: string;
  name: string;
  description: string;
  tone: PersonaTone;
  useEmojis: boolean;
  useHeadersLists: boolean;
  userContext: string;
  customInstructions: string;
  icon: string;
  color: string;
  isPremade?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface PersonaPreviewProps {
  persona: PersonaForUI | null;
}

const TONE_LABELS: Record<PersonaTone, string> = {
  default: "Default",
  professional: "Professional",
  friendly: "Friendly",
  candid: "Candid",
  quirky: "Quirky",
  efficient: "Efficient",
  cynical: "Cynical",
  lawyer: "Lawyer",
};

export default function PersonaPreview({ persona }: PersonaPreviewProps) {
  const { t } = useLanguage();

  if (!persona) return null;

  return (
    <div className="h-full flex flex-col p-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-(--primary) text-2xl text-black shadow-lg">
          {persona.icon || ""}
        </div>
        <div>
          <h2 className="text-lg font-bold text-(--text-primary)">{persona.name}</h2>
          <span className="rounded bg-(--control-bg) px-1.5 py-0.5 text-[10px] text-(--text-secondary)">
            {TONE_LABELS[persona.tone] || persona.tone}
          </span>
        </div>
      </div>

      <div className="space-y-4 flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-[var(--control-border)]">
        <div>
          <label className="text-xs font-semibold text-(--text-secondary) uppercase tracking-wider block mb-1">
            {t("personaDescription") || "Description"}
          </label>
          <div className="text-sm text-(--text-primary) bg-(--surface-muted) p-3 rounded-lg border border-(--border)">
            {persona.description || (
              <span className="italic text-(--text-muted)">No description</span>
            )}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-(--text-secondary) uppercase tracking-wider block mb-1">
            {t("personaTone") || "Tone & Style"}
          </label>
          <div className="text-sm text-(--text-primary) bg-(--surface-muted) p-3 rounded-lg border border-(--border) flex items-center gap-2">
            <span className="font-medium">{TONE_LABELS[persona.tone] || persona.tone}</span>
            <span className="text-(--text-secondary) text-xs">
              {persona.useEmojis ? " Emojis" : " No Emojis"}
              {" · "}
              {persona.useHeadersLists ? " Headers & Lists" : " No Headers"}
            </span>
          </div>
        </div>

        {persona.userContext && (
          <div>
            <label className="text-xs font-semibold text-(--text-secondary) uppercase tracking-wider block mb-1">
              {t("personaUserContext") || "User Context"}
            </label>
            <div className="text-sm text-(--text-primary) bg-(--surface-muted) p-3 rounded-lg border border-(--border) whitespace-pre-wrap font-mono text-xs leading-relaxed max-h-[200px] overflow-y-auto">
              {persona.userContext}
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-(--text-secondary) uppercase tracking-wider block mb-1">
            {t("personaCustomInstructions") || "Custom Instructions"}
          </label>
          <div className="text-sm text-(--text-primary) bg-(--surface-muted) p-3 rounded-lg border border-(--border) whitespace-pre-wrap font-mono text-xs leading-relaxed max-h-[400px] overflow-y-auto">
            {persona.customInstructions || (
              <span className="italic text-(--text-muted)">No custom instructions</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
