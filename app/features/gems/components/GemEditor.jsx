// /app/features/gems/components/GemEditor.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../chat/hooks/useLanguage";

export default function GemEditor({ gem, onSave }) {
  const { t } = useLanguage();
  const isReadOnly = !!gem?.isPremade;

  const [dirty, setDirty] = useState(false);

  const [id, setId] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState("");

  useEffect(() => {
    setId(gem?.id || null);
    setName(gem?.name || "");
    setDescription(gem?.description || "");
    setInstructions(gem?.instructions || "");
    setIcon(gem?.icon || "");
    setColor(gem?.color || "");
    setDirty(false);
  }, [gem?.id]); // switch gem

  const canSave = useMemo(() => {
    if (isReadOnly) return false;
    if (!name.trim()) return false;
    return dirty;
  }, [dirty, isReadOnly, name]);

  const title = gem
    ? isReadOnly
      ? `${t("premadeGems")} (Read Only)`
      : `${t("editGem")}${dirty ? " *" : ""}`
    : t("selectModel");

  const handleChange = (setter) => (e) => {
    setter(e.target.value);
    setDirty(true);
  };

  const save = () => {
    if (!canSave) return;
    onSave?.({
      id,
      name,
      description,
      instructions,
      icon,
      color,
    });
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-sm font-medium">{title}</div>
        {!isReadOnly && (
          <button
            onClick={save}
            disabled={!canSave}
            className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("saveGem")}
          </button>
        )}
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-neutral-400">{t("gemName")}</label>
            <input
              value={name}
              onChange={handleChange(setName)}
              disabled={isReadOnly}
              placeholder={t("gemPlaceholderName")}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none disabled:opacity-60"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-400">Icon</label>
            <input
              value={icon}
              onChange={handleChange(setIcon)}
              disabled={isReadOnly}
              placeholder="💡"
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none disabled:opacity-60"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-neutral-400">{t("gemDescription")}</label>
          <input
            value={description}
            onChange={handleChange(setDescription)}
            disabled={isReadOnly}
            placeholder={t("gemPlaceholderDesc")}
            className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none disabled:opacity-60"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-neutral-400">{t("themes")}</label>
          <input
            value={color}
            onChange={handleChange(setColor)}
            disabled={isReadOnly}
            placeholder="amber | indigo | charcoal | ..."
            className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none disabled:opacity-60"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-neutral-400">{t("gemInstructions")}</label>
          <textarea
            value={instructions}
            onChange={handleChange(setInstructions)}
            disabled={isReadOnly}
            rows={14}
            placeholder={t("gemPlaceholderInst")}
            className="w-full resize-y rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm leading-6 outline-none disabled:opacity-60"
          />
        </div>
      </div>
    </div>
  );
}
