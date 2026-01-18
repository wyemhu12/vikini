"use client";

import { useLanguage } from "../../chat/hooks/useLanguage";

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
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-(--primary) text-2xl text-black shadow-lg">
          {gem.icon || "◆"}
        </div>
        <div>
          <h2 className="text-lg font-bold text-(--text-primary)">{gem.name}</h2>
          {gem.isPremade && (
            <span className="rounded bg-(--control-bg) px-1.5 py-0.5 text-[10px] text-(--text-secondary)">
              {t("premadeGems") || "System Gem"}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4 flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-neutral-800">
        <div>
          <label className="text-xs font-semibold text-(--text-secondary) uppercase tracking-wider block mb-1">
            {t("gemDescription") || "Description"}
          </label>
          <div className="text-sm text-(--text-primary) bg-(--surface-muted) p-3 rounded-lg border border-(--border)">
            {gem.description || <span className="italic text-(--text-muted)">No description</span>}
          </div>
        </div>

        {gem.color && (
          <div>
            <label className="text-xs font-semibold text-(--text-secondary) uppercase tracking-wider block mb-1">
              {t("themes") || "Color Theme"}
            </label>
            <div className="text-sm text-(--text-primary) flex items-center gap-2">
              <span
                className="w-4 h-4 rounded-full border border-white/10"
                style={{ backgroundColor: gem.color }}
              />
              {gem.color}
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-(--text-secondary) uppercase tracking-wider block mb-1">
            {t("gemInstructions") || "Instructions (System Prompt)"}
          </label>
          <div className="text-sm text-(--text-primary) bg-(--surface-muted) p-3 rounded-lg border border-(--border) whitespace-pre-wrap font-mono text-xs leading-relaxed max-h-[400px] overflow-y-auto">
            {gem.instructions || gem.instruction || (
              <span className="italic text-(--text-muted)">No instructions</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
