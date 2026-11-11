"use client";

import { useLanguage } from "../../chat/hooks/useLanguage";
import type { PersonaForUI } from "./PersonaPreview";
import { DynamicIcon } from "@/components/ui/DynamicIcon";
import { LibraryCard, type LibraryCardMenuItem } from "@/components/ui/library-card";

interface PersonaListProps {
  loading: boolean;
  personas: PersonaForUI[];
  selectedPersonaId: string | null;
  /** False when the page is not tied to a conversation: cards preview instead of applying. */
  canApply?: boolean;
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

const GRID_CLASS = "grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3";
const SECTION_TITLE_CLASS = "mb-2 text-sm font-semibold text-(--muted)";

export default function PersonaList({
  loading,
  personas,
  selectedPersonaId,
  canApply = true,
  onSelect,
  onPreview,
  onEdit,
  onDelete,
}: PersonaListProps) {
  const { t } = useLanguage();

  if (loading) {
    return <div className="text-sm text-(--muted)">{t("loading")}</div>;
  }

  if (personas.length === 0) {
    return <div className="py-4 text-center text-sm text-(--muted)">{t("personaNoPersonas")}</div>;
  }

  const premadePersonas = personas.filter((p) => p.isPremade);
  const userPersonas = personas.filter((p) => !p.isPremade);

  const renderCard = (p: PersonaForUI) => {
    const selected = selectedPersonaId === p.id;
    const menuItems: LibraryCardMenuItem[] = [
      // Preview is the primary action when the persona cannot be applied.
      ...(canApply ? [{ label: t("preview"), onSelect: () => onPreview(p) }] : []),
      ...(p.isPremade
        ? []
        : [
            { label: t("personaEdit"), onSelect: () => onEdit(p) },
            { label: t("personaDelete"), onSelect: () => onDelete(p), danger: true },
          ]),
    ];
    return (
      <LibraryCard
        key={p.id}
        icon={<DynamicIcon name={p.icon} className="h-5 w-5" />}
        title={p.name}
        badges={[TONE_BADGES[p.tone] || p.tone, ...(p.isPremade ? [t("libraryBuiltIn")] : [])]}
        description={p.description}
        selected={canApply ? selected : undefined}
        primaryLabel={canApply ? (selected ? t("libraryInUse") : t("personaUse")) : t("preview")}
        onPrimary={() => (canApply ? onSelect(p) : onPreview(p))}
        menuLabel={`${t("messageMoreActions")}: ${p.name}`}
        menuItems={menuItems}
      />
    );
  };

  return (
    <div className="space-y-6">
      {premadePersonas.length > 0 && (
        <section>
          <h2 className={SECTION_TITLE_CLASS}>{t("premadePersonas")}</h2>
          <div className={GRID_CLASS}>{premadePersonas.map(renderCard)}</div>
        </section>
      )}

      <section>
        {premadePersonas.length > 0 && (
          <h2 className={SECTION_TITLE_CLASS}>{t("personaMyPersonas")}</h2>
        )}
        <div className={GRID_CLASS}>{userPersonas.map(renderCard)}</div>
        {userPersonas.length === 0 && premadePersonas.length > 0 && (
          <div className="py-4 text-center text-sm text-(--muted)">{t("personaNoPersonas")}</div>
        )}
      </section>
    </div>
  );
}
