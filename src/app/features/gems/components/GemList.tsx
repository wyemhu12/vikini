"use client";

import { useLanguage } from "../../chat/hooks/useLanguage";
import { Gem } from "./GemPreview";
import { DynamicIcon } from "@/components/ui/DynamicIcon";
import { LibraryCard, type LibraryCardMenuItem } from "@/components/ui/library-card";

interface GemListProps {
  loading: boolean;
  premade: Gem[];
  mine: Gem[];
  selectedGemId: string | null;
  /** False when the page is not tied to a conversation: cards preview instead of applying. */
  canApply?: boolean;
  onSelect: (gem: Gem) => void;
  onEdit: (gem: Gem) => void;
  onPreview: (gem: Gem) => void;
  onDelete: (gem: Gem) => void;
}

const GRID_CLASS = "grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3";
const SECTION_TITLE_CLASS = "mb-2 text-sm font-semibold text-(--muted)";

export default function GemList({
  loading,
  premade,
  mine,
  selectedGemId,
  canApply = true,
  onSelect,
  onEdit,
  onPreview,
  onDelete,
}: GemListProps) {
  const { t } = useLanguage();

  const renderItem = (g: Gem, readOnly: boolean) => {
    const selected = selectedGemId === g.id;
    const menuItems: LibraryCardMenuItem[] = [
      // Preview is the primary action when the gem cannot be applied.
      ...(canApply ? [{ label: t("preview"), onSelect: () => onPreview(g) }] : []),
      ...(readOnly
        ? []
        : [
            { label: t("editGem"), onSelect: () => onEdit(g) },
            { label: t("deleteGem"), onSelect: () => onDelete(g), danger: true },
          ]),
    ];

    return (
      <LibraryCard
        key={g.id}
        icon={<DynamicIcon name={g.icon} fallback="◆" className="h-5 w-5" />}
        title={g.name}
        badges={g.isPremade ? [t("libraryBuiltIn")] : []}
        description={g.description}
        selected={canApply ? selected : undefined}
        primaryLabel={canApply ? (selected ? t("libraryInUse") : t("gemUse")) : t("preview")}
        onPrimary={() => (canApply ? onSelect(g) : onPreview(g))}
        menuLabel={`${t("messageMoreActions")}: ${g.name}`}
        menuItems={menuItems}
      />
    );
  };

  if (loading) {
    return <div className="text-sm text-(--muted)">{t("loading")}</div>;
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className={SECTION_TITLE_CLASS}>{t("premadeGems")}</h2>
        <div className={GRID_CLASS}>
          {premade?.length ? (
            premade.map((g) => renderItem(g, true))
          ) : (
            <div className="text-sm text-(--muted)">{t("noDescription")}</div>
          )}
        </div>
      </section>

      <section>
        <h2 className={SECTION_TITLE_CLASS}>{t("myGems")}</h2>
        <div className={GRID_CLASS}>
          {mine?.length ? (
            mine.map((g) => renderItem(g, false))
          ) : (
            <div className="text-sm text-(--muted)">{t("noDescription")}</div>
          )}
        </div>
      </section>
    </div>
  );
}
