"use client";

import { useLanguage } from "../../chat/hooks/useLanguage";
import type { PersonaTone } from "@/types/persona";
import { DynamicIcon } from "@/components/ui/DynamicIcon";

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
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-(--accent) text-2xl text-(--on-accent) shadow-lg">
          <DynamicIcon name={persona.icon} className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-(--text)">{persona.name}</h2>
          <span className="rounded bg-(--raised) px-1.5 py-0.5 text-xs text-(--muted)">
            {TONE_LABELS[persona.tone] || persona.tone}
          </span>
        </div>
      </div>

      <div className="space-y-4 flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-[var(--line)]">
        <div>
          <label className="text-xs font-semibold text-(--muted) block mb-1">
            {t("personaDescription") || "Description"}
          </label>
          <div className="text-sm text-(--text) bg-(--raised) p-3 rounded-lg border border-(--line)">
            {persona.description || <span className="italic text-(--muted)">No description</span>}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-(--muted) block mb-1">
            {t("personaTone") || "Tone & Style"}
          </label>
          <div className="text-sm text-(--text) bg-(--raised) p-3 rounded-lg border border-(--line) flex items-center gap-2">
            <span className="font-medium">{TONE_LABELS[persona.tone] || persona.tone}</span>
            <span className="text-(--muted) text-xs">
              {persona.useEmojis ? " Emojis" : " No Emojis"}
              {" · "}
              {persona.useHeadersLists ? " Headers & Lists" : " No Headers"}
            </span>
          </div>
        </div>

        {persona.userContext && (
          <div>
            <label className="text-xs font-semibold text-(--muted) block mb-1">
              {t("personaUserContext") || "User Context"}
            </label>
            <div className="text-sm text-(--text) bg-(--raised) p-3 rounded-lg border border-(--line) whitespace-pre-wrap font-mono text-xs leading-relaxed max-h-[200px] overflow-y-auto">
              {persona.userContext}
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-(--muted) block mb-1">
            {t("personaCustomInstructions") || "Custom Instructions"}
          </label>
          <div className="text-sm text-(--text) bg-(--raised) p-3 rounded-lg border border-(--line) whitespace-pre-wrap font-mono text-xs leading-relaxed max-h-[400px] overflow-y-auto">
            {persona.customInstructions || (
              <span className="italic text-(--muted)">No custom instructions</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
