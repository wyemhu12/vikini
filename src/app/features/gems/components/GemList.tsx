"use client";

import { useLanguage } from "../../chat/hooks/useLanguage";
import { Gem } from "./GemPreview"; // Import shared type if possible, or redefine

interface GemListProps {
  loading: boolean;
  premade: Gem[];
  mine: Gem[];
  selectedGemId: string | null;
  onSelect: (gem: Gem) => void;
  onEdit: (gem: Gem) => void;
  onPreview: (gem: Gem) => void;
  onDelete: (gem: Gem) => void;
}

export default function GemList({
  loading,
  premade,
  mine,
  selectedGemId,
  onSelect,
  onEdit,
  onPreview,
  onDelete,
}: GemListProps) {
  const { t } = useLanguage();

  const renderItem = (g: Gem, readOnly: boolean) => {
    const selected = selectedGemId === g.id;

    return (
      <div
        key={g.id}
        className={`rounded-lg border px-3 py-2 transition-all duration-200 ${
          selected
            ? "border-(--primary) bg-(--primary)/10"
            : "border-(--border) bg-(--surface) hover:bg-(--surface-muted)"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm">{g.icon || "◆"}</span>
              <div className="truncate text-sm font-medium">{g.name}</div>
              {g.isPremade ? (
                <span className="rounded bg-(--control-bg) px-1.5 py-0.5 text-[10px] text-(--text-secondary)">
                  {t("premadeGems")}
                </span>
              ) : null}
            </div>
            {g.description ? (
              <div className="mt-1 line-clamp-2 text-[11px] text-(--text-secondary)">
                {g.description}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-1">
            <button
              onClick={() => onSelect?.(g)}
              className="rounded-md bg-(--primary) px-2 py-1 text-[11px] text-black transition-all hover:brightness-110 active:scale-95"
            >
              {t("select")}
            </button>

            <button
              onClick={() => onPreview?.(g)}
              className="rounded-md border border-(--border) px-2 py-1 text-[11px] text-(--text-secondary) hover:bg-(--control-bg-hover) hover:text-(--text-primary) transition-all active:scale-95 flex items-center justify-center gap-1"
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
              Preview
            </button>

            {!readOnly && (
              <>
                <button
                  onClick={() => onEdit?.(g)}
                  className="rounded-md border border-(--border) px-2 py-1 text-[11px] text-(--text-secondary) hover:bg-(--control-bg-hover) hover:text-(--text-primary) transition-all active:scale-95"
                >
                  {t("editGem")}
                </button>
                <button
                  onClick={() => onDelete?.(g)}
                  className="rounded-md border border-red-900/50 px-2 py-1 text-[11px] text-red-300 hover:bg-red-950/40 transition-all active:scale-95"
                >
                  {t("deleteGem")}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="text-xs text-neutral-400">{t("loading")}</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 text-xs font-semibold text-neutral-300">{t("premadeGems")}</div>
        <div className="space-y-2">
          {premade?.length ? (
            premade.map((g) => renderItem(g, true))
          ) : (
            <div className="text-xs text-neutral-500">---</div>
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold text-neutral-300">{t("myGems")}</div>
        <div className="space-y-2">
          {mine?.length ? (
            mine.map((g) => renderItem(g, false))
          ) : (
            <div className="text-xs text-neutral-500">---</div>
          )}
        </div>
      </div>
    </div>
  );
}
