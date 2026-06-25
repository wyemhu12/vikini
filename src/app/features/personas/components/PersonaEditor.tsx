"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../chat/hooks/useLanguage";
import type { PersonaForUI } from "./PersonaPreview";
import type { PersonaTone } from "@/types/persona";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import IconPicker from "@/components/ui/IconPicker";

interface PersonaEditorProps {
  persona: PersonaForUI | null;
  onSave: (persona: Partial<PersonaForUI>) => void;
}

const TONE_OPTIONS: { value: PersonaTone; label: string; description: string }[] = [
  { value: "default", label: "Default", description: "Preset style and tone" },
  { value: "professional", label: "Professional", description: "Polished and precise" },
  { value: "friendly", label: "Friendly", description: "Warm and chatty" },
  { value: "candid", label: "Candid", description: "Direct and encouraging" },
  { value: "quirky", label: "Quirky", description: "Playful and imaginative" },
  { value: "efficient", label: "Efficient", description: "Concise and plain" },
  { value: "cynical", label: "Cynical", description: "Critical and sarcastic" },
  { value: "lawyer", label: "Lawyer", description: "Legal advisor, precise terminology" },
];

export default function PersonaEditor({ persona, onSave }: PersonaEditorProps) {
  const { t } = useLanguage();

  const [dirty, setDirty] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tone, setTone] = useState<PersonaTone>("default");
  const [useEmojis, setUseEmojis] = useState(true);
  const [useHeadersLists, setUseHeadersLists] = useState(true);
  const [userContext, setUserContext] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [icon, setIcon] = useState("");

  useEffect(() => {
    setId(persona?.id || null);
    setName(persona?.name || "");
    setDescription(persona?.description || "");
    setTone(persona?.tone || "default");
    setUseEmojis(persona?.useEmojis ?? true);
    setUseHeadersLists(persona?.useHeadersLists ?? true);
    setUserContext(persona?.userContext || "");
    setCustomInstructions(persona?.customInstructions || "");
    setIcon(persona?.icon || "");
    setDirty(false);
  }, [persona?.id]);

  const canSave = useMemo(() => {
    if (!name.trim()) return false;
    return dirty;
  }, [dirty, name]);

  const title = persona?.id
    ? `${t("personaEdit") || "Edit Persona"}${dirty ? " *" : ""}`
    : t("personaCreate") || "Create Persona";

  const handleChange =
    (setter: React.Dispatch<React.SetStateAction<string>>) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setter(e.target.value);
      setDirty(true);
    };

  const save = () => {
    if (!canSave) return;
    onSave?.({
      id: id || undefined,
      name,
      description,
      tone,
      useEmojis,
      useHeadersLists,
      userContext,
      customInstructions,
      icon,
    });
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-sm font-medium">{title}</div>
        <button
          onClick={save}
          disabled={!canSave}
          className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t("personaSave") || "Save Persona"}
        </button>
      </div>

      <div className="space-y-4">
        {/* Name & Icon */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-(--text-secondary)">
              {t("personaName") || "Persona Name"}
            </label>
            <Input
              value={name}
              onChange={handleChange(setName)}
              placeholder={t("personaPlaceholderName") || "e.g. Code Assistant, Legal Advisor"}
              className="w-full bg-(--control-bg) border-(--border) focus-visible:ring-1 focus-visible:ring-(--primary) text-(--text-primary) px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs text-(--text-secondary)">
              Icon
              <IconPicker
                onSelect={(emoji) => {
                  setIcon(emoji);
                  setDirty(true);
                }}
              />
            </label>
            <Input
              value={icon}
              onChange={handleChange(setIcon)}
              placeholder="🎭"
              className="w-full bg-(--control-bg) border-(--border) focus-visible:ring-1 focus-visible:ring-(--primary) text-(--text-primary) px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="mb-1 block text-xs text-(--text-secondary)">
            {t("personaDescription") || "Description"}
          </label>
          <Input
            value={description}
            onChange={handleChange(setDescription)}
            placeholder={t("personaPlaceholderDesc") || "Brief description of the persona"}
            className="w-full bg-(--control-bg) border-(--border) focus-visible:ring-1 focus-visible:ring-(--primary) text-(--text-primary) px-3 py-2 text-sm"
          />
        </div>

        {/* Base Style & Tone */}
        <div>
          <label className="mb-2 block text-xs text-(--text-secondary) font-semibold uppercase tracking-wider">
            {t("personaTone") || "Base Style & Tone"}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {TONE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setTone(opt.value);
                  setDirty(true);
                }}
                className={`rounded-lg border px-3 py-2 text-left transition-all duration-200 ${
                  tone === opt.value
                    ? "border-(--primary) bg-(--primary)/10 text-(--text-primary)"
                    : "border-(--border) bg-(--surface) hover:bg-(--surface-muted) text-(--text-secondary)"
                }`}
              >
                <div className="text-xs font-medium">{opt.label}</div>
                <div className="text-[10px] text-(--text-muted) mt-0.5">{opt.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Characteristics toggles */}
        <div>
          <label className="mb-2 block text-xs text-(--text-secondary) font-semibold uppercase tracking-wider">
            {t("personaCharacteristics") || "Characteristics"}
          </label>
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useEmojis}
                onChange={(e) => {
                  setUseEmojis(e.target.checked);
                  setDirty(true);
                }}
                className="rounded border-(--border) bg-(--control-bg) text-(--primary) focus:ring-(--primary)"
              />
              <span className="text-sm text-(--text-primary)">
                {t("personaUseEmojis") || "Use Emojis"}
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useHeadersLists}
                onChange={(e) => {
                  setUseHeadersLists(e.target.checked);
                  setDirty(true);
                }}
                className="rounded border-(--border) bg-(--control-bg) text-(--primary) focus:ring-(--primary)"
              />
              <span className="text-sm text-(--text-primary)">
                {t("personaUseHeadersLists") || "Headers & Lists"}
              </span>
            </label>
          </div>
        </div>

        {/* User Context */}
        <div>
          <label className="mb-1 block text-xs text-(--text-secondary)">
            {t("personaUserContext") || "What should AI know about you?"}
          </label>
          <Textarea
            value={userContext}
            onChange={handleChange(setUserContext)}
            rows={3}
            placeholder={
              t("personaPlaceholderContext") ||
              "e.g. I'm a software engineer working on web apps..."
            }
            className="w-full resize-y bg-(--control-bg) border-(--border) focus-visible:ring-1 focus-visible:ring-(--primary) text-(--text-primary) px-3 py-2 text-sm leading-6"
          />
        </div>

        {/* Custom Instructions */}
        <div>
          <label className="mb-1 block text-xs text-(--text-secondary)">
            {t("personaCustomInstructions") || "Custom Instructions (Rules)"}
          </label>
          <Textarea
            value={customInstructions}
            onChange={handleChange(setCustomInstructions)}
            rows={8}
            placeholder={
              t("personaPlaceholderInstructions") ||
              "e.g. Always start with a TL;DR summary, use bullet points for long paragraphs..."
            }
            className="w-full resize-y bg-(--control-bg) border-(--border) focus-visible:ring-1 focus-visible:ring-(--primary) text-(--text-primary) px-3 py-2 text-sm leading-6"
          />
        </div>
      </div>
    </div>
  );
}
