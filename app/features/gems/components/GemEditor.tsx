"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { translations } from "@/lib/utils/config";
import { Gem } from "./GemPreview";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import IconPicker from "@/components/ui/IconPicker";

interface GemEditorProps {
  gem: Gem | null;
  onSave: (gem: Partial<Gem>) => void;
  language?: string;
}

export default function GemEditor({ gem, onSave, language: languageProp }: GemEditorProps) {
  const { language: hookLanguage, t: _hookT } = useLanguage();

  // Use prop if provided (Admin), otherwise use hook (normal Gems page)
  const language = languageProp || hookLanguage;
  const t = (key: string) => {
    // @ts-ignore - dictionary access
    const trans = language === "vi" ? translations.vi : translations.en;
    return trans[key] || key;
  };

  const isReadOnly = !!gem?.isPremade;

  const [dirty, setDirty] = useState(false);

  const [id, setId] = useState<string | null>(null);
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

  const handleChange =
    (setter: React.Dispatch<React.SetStateAction<string>>) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setter(e.target.value);
      setDirty(true);
    };

  const save = () => {
    if (!canSave) return;
    onSave?.({
      id: id || undefined, // or handled in parent logic for new gems
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
            <label className="mb-1 block text-xs text-(--text-secondary)">{t("gemName")}</label>
            <Input
              value={name}
              onChange={handleChange(setName)}
              disabled={isReadOnly}
              placeholder={t("gemPlaceholderName")}
              className="w-full bg-(--control-bg) border-(--border) focus-visible:ring-1 focus-visible:ring-(--primary) text-(--text-primary) px-3 py-2 text-sm disabled:opacity-60"
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs text-neutral-400">
              Icon
              <IconPicker
                onSelect={(emoji) => {
                  setIcon(emoji);
                  setDirty(true);
                }}
                disabled={isReadOnly}
              />
            </label>
            <Input
              value={icon}
              onChange={handleChange(setIcon)}
              disabled={isReadOnly}
              placeholder="💡"
              className="w-full bg-(--control-bg) border-(--border) focus-visible:ring-1 focus-visible:ring-(--primary) text-(--text-primary) px-3 py-2 text-sm disabled:opacity-60"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-(--text-secondary)">
            {t("gemDescription")}
          </label>
          <Input
            value={description}
            onChange={handleChange(setDescription)}
            disabled={isReadOnly}
            placeholder={t("gemPlaceholderDesc")}
            className="w-full bg-(--control-bg) border-(--border) focus-visible:ring-1 focus-visible:ring-(--primary) text-(--text-primary) px-3 py-2 text-sm disabled:opacity-60"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-(--text-secondary)">{t("themes")}</label>
          <Input
            value={color}
            onChange={handleChange(setColor)}
            disabled={isReadOnly}
            placeholder="amber | indigo | charcoal | ..."
            className="w-full bg-(--control-bg) border-(--border) focus-visible:ring-1 focus-visible:ring-(--primary) text-(--text-primary) px-3 py-2 text-sm disabled:opacity-60"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-(--text-secondary)">
            {t("gemInstructions")}
          </label>
          <Textarea
            value={instructions}
            onChange={handleChange(setInstructions)}
            disabled={isReadOnly}
            rows={14}
            placeholder={t("gemPlaceholderInst")}
            className="w-full resize-y bg-(--control-bg) border-(--border) focus-visible:ring-1 focus-visible:ring-(--primary) text-(--text-primary) px-3 py-2 text-sm leading-6 disabled:opacity-60"
          />
        </div>
      </div>
    </div>
  );
}
