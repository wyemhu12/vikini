"use client";

import { useLanguage } from "../../chat/hooks/useLanguage";
import { DynamicIcon } from "@/components/ui/DynamicIcon";

export interface Gem {
  id: string;
  name: string;
  description?: string;
  instructions?: string;
  instruction?: string;
  icon?: string;
  color?: string;
  isPremade?: boolean;
}

interface GemPreviewProps {
  gem: Gem | null;
}

export default function GemPreview({ gem }: GemPreviewProps) {
  const { t } = useLanguage();

  if (!gem) return null;

  return (
    <div className="h-full flex flex-col p-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-(--accent) text-2xl text-(--on-accent) shadow-lg">
          <DynamicIcon name={gem.icon} fallback="◆" className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-(--text)">{gem.name}</h2>
          {gem.isPremade && (
            <span className="rounded bg-(--raised) px-1.5 py-0.5 text-xs text-(--muted)">
              {t("premadeGems") || "System Gem"}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4 flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-[var(--line)]">
        <div>
          <label className="text-xs font-semibold text-(--muted) block mb-1">
            {t("gemDescription") || "Description"}
          </label>
          <div className="text-sm text-(--text) bg-(--raised) p-3 rounded-lg border border-(--line)">
            {gem.description || <span className="italic text-(--muted)">No description</span>}
          </div>
        </div>

        {gem.color && (
          <div>
            <label className="text-xs font-semibold text-(--muted) block mb-1">
              {t("themes") || "Color Theme"}
            </label>
            <div className="text-sm text-(--text) flex items-center gap-2">
              <span
                className="w-4 h-4 rounded-full border border-(--line)"
                style={{ backgroundColor: gem.color }}
              />
              {gem.color}
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-(--muted) block mb-1">
            {t("gemInstructions") || "Instructions (System Prompt)"}
          </label>
          <div className="text-sm text-(--text) bg-(--raised) p-3 rounded-lg border border-(--line) whitespace-pre-wrap font-mono text-xs leading-relaxed max-h-[400px] overflow-y-auto">
            {gem.instructions || gem.instruction || (
              <span className="italic text-(--muted)">No instructions</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
