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
                <span className="rounded bg-(--control-bg) px-1.5 py-0.5 text-xs text-(--text-secondary)">
                  {t("premadeGems")}
                </span>
              ) : null}
            </div>
            {g.description ? (
              <div className="mt-1 line-clamp-2 text-xs text-(--text-secondary)">
                {g.description}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-1">
            <button
              onClick={() => onSelect?.(g)}
              className="rounded-md bg-(--primary) px-2 py-1 text-xs text-black transition-all hover:brightness-110 active:scale-95"
            >
              {t("select")}
            </button>

            <button
              onClick={() => onPreview?.(g)}
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

            {!readOnly && (
              <>
                <button
                  onClick={() => onEdit?.(g)}
                  className="rounded-md border border-(--border) px-2 py-1 text-xs text-(--text-secondary) hover:bg-(--control-bg-hover) hover:text-(--text-primary) transition-all active:scale-95"
                >
                  {t("editGem")}
                </button>
                <button
                  onClick={() => onDelete?.(g)}
                  className="rounded-md border border-(--danger)/30 px-2 py-1 text-xs text-(--danger) hover:bg-(--danger)/10 transition-all active:scale-95"
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
    return <div className="text-xs text-(--text-secondary)">{t("loading")}</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 text-xs font-semibold text-(--text-secondary)">{t("premadeGems")}</div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
          {premade?.length ? (
            premade.map((g) => renderItem(g, true))
          ) : (
            <div className="text-xs text-(--text-secondary)">{t("noDescription")}</div>
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold text-(--text-secondary)">{t("myGems")}</div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
          {mine?.length ? (
            mine.map((g) => renderItem(g, false))
          ) : (
            <div className="text-xs text-(--text-secondary)">{t("noDescription")}</div>
          )}
        </div>
      </div>
    </div>
  );
}
