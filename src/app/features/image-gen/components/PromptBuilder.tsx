"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Camera,
  Sun,
  Palette,
  Smile,
  Crosshair,
  ChevronDown,
  ChevronUp,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface PromptBuilderProps {
  onBuildPrompt: (prompt: string) => void;
}

interface FieldOption {
  id: string;
  labelKey: string;
  icon?: string;
}

const LIGHTING_OPTIONS: FieldOption[] = [
  { id: "natural", labelKey: "pbLightNatural", icon: "☀️" },
  { id: "studio", labelKey: "pbLightStudio", icon: "💡" },
  { id: "dramatic", labelKey: "pbLightDramatic", icon: "🎭" },
  { id: "neon", labelKey: "pbLightNeon", icon: "💜" },
  { id: "golden-hour", labelKey: "pbLightGolden", icon: "🌅" },
  { id: "backlit", labelKey: "pbLightBacklit", icon: "🌄" },
  { id: "moonlight", labelKey: "pbLightMoonlight", icon: "🌙" },
];

const CAMERA_OPTIONS: FieldOption[] = [
  { id: "close-up", labelKey: "pbCamCloseup", icon: "🔍" },
  { id: "wide-angle", labelKey: "pbCamWide", icon: "🏞️" },
  { id: "aerial", labelKey: "pbCamAerial", icon: "🦅" },
  { id: "macro", labelKey: "pbCamMacro", icon: "🔬" },
  { id: "portrait", labelKey: "pbCamPortrait", icon: "📷" },
  { id: "fish-eye", labelKey: "pbCamFisheye", icon: "🐟" },
  { id: "low-angle", labelKey: "pbCamLowAngle", icon: "⬆️" },
];

const MOOD_OPTIONS: FieldOption[] = [
  { id: "joyful", labelKey: "pbMoodJoyful", icon: "😊" },
  { id: "dark", labelKey: "pbMoodDark", icon: "🌑" },
  { id: "mysterious", labelKey: "pbMoodMysterious", icon: "🔮" },
  { id: "serene", labelKey: "pbMoodSerene", icon: "🕊️" },
  { id: "epic", labelKey: "pbMoodEpic", icon: "⚔️" },
  { id: "nostalgic", labelKey: "pbMoodNostalgic", icon: "📼" },
  { id: "dreamy", labelKey: "pbMoodDreamy", icon: "💭" },
];

const COLOR_OPTIONS: FieldOption[] = [
  { id: "vibrant", labelKey: "pbColorVibrant", icon: "🌈" },
  { id: "pastel", labelKey: "pbColorPastel", icon: "🎨" },
  { id: "monochrome", labelKey: "pbColorMono", icon: "⬛" },
  { id: "earth-tones", labelKey: "pbColorEarth", icon: "🏜️" },
  { id: "neon", labelKey: "pbColorNeon", icon: "💜" },
  { id: "warm", labelKey: "pbColorWarm", icon: "🔥" },
  { id: "cool", labelKey: "pbColorCool", icon: "❄️" },
];

function ChipSelector({
  options,
  selected,
  onSelect,
  t,
}: {
  options: FieldOption[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  t: (key: string) => string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onSelect(selected === opt.id ? null : opt.id)}
          className={cn(
            "px-2 py-1 rounded-full text-[10px] font-medium border transition-all",
            selected === opt.id
              ? "bg-purple-500/20 border-purple-500/40 text-purple-300 ring-1 ring-purple-500/30"
              : "bg-(--surface-elevated) border-(--border) text-(--text-secondary) hover:bg-purple-500/10 hover:border-purple-500/20"
          )}
        >
          {opt.icon && <span className="mr-0.5">{opt.icon}</span>}
          {t(opt.labelKey)}
        </button>
      ))}
    </div>
  );
}

export default function PromptBuilder({ onBuildPrompt }: PromptBuilderProps) {
  const { t } = useLanguage();
  const [subject, setSubject] = useState("");
  const [lighting, setLighting] = useState<string | null>(null);
  const [camera, setCamera] = useState<string | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [colorPalette, setColorPalette] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>("lighting");

  // Build the final prompt from structured fields
  const builtPrompt = useMemo(() => {
    const parts: string[] = [];

    if (subject.trim()) {
      parts.push(subject.trim());
    }

    if (lighting) {
      const opt = LIGHTING_OPTIONS.find((o) => o.id === lighting);
      if (opt) parts.push(`${t(opt.labelKey)} lighting`);
    }

    if (camera) {
      const opt = CAMERA_OPTIONS.find((o) => o.id === camera);
      if (opt) parts.push(`${t(opt.labelKey)} shot`);
    }

    if (mood) {
      const opt = MOOD_OPTIONS.find((o) => o.id === mood);
      if (opt) parts.push(`${t(opt.labelKey)} mood`);
    }

    if (colorPalette) {
      const opt = COLOR_OPTIONS.find((o) => o.id === colorPalette);
      if (opt) parts.push(`${t(opt.labelKey)} color palette`);
    }

    return parts.join(", ");
  }, [subject, lighting, camera, mood, colorPalette, t]);

  const handleBuild = useCallback(() => {
    if (builtPrompt.trim()) {
      onBuildPrompt(builtPrompt);
    }
  }, [builtPrompt, onBuildPrompt]);

  const toggleSection = (section: string) => {
    setExpandedSection((prev) => (prev === section ? null : section));
  };

  const sections = [
    {
      id: "lighting",
      labelKey: "pbLighting",
      icon: Sun,
      options: LIGHTING_OPTIONS,
      value: lighting,
      onChange: setLighting,
    },
    {
      id: "camera",
      labelKey: "pbCamera",
      icon: Camera,
      options: CAMERA_OPTIONS,
      value: camera,
      onChange: setCamera,
    },
    {
      id: "mood",
      labelKey: "pbMood",
      icon: Smile,
      options: MOOD_OPTIONS,
      value: mood,
      onChange: setMood,
    },
    {
      id: "color",
      labelKey: "pbColor",
      icon: Palette,
      options: COLOR_OPTIONS,
      value: colorPalette,
      onChange: setColorPalette,
    },
  ];

  return (
    <div className="space-y-3">
      {/* Subject textarea */}
      <div className="space-y-1.5">
        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Crosshair className="w-3 h-3" />
          {t("pbSubject")}
        </Label>
        <Textarea
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={t("pbSubjectPlaceholder")}
          className="h-20 resize-none bg-(--input-bg) border-(--input-border) text-xs focus-visible:ring-1"
        />
      </div>

      {/* Attribute sections — collapsible */}
      {sections.map((section) => {
        const Icon = section.icon;
        const isExpanded = expandedSection === section.id;
        return (
          <div key={section.id} className="border border-(--border) rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full flex items-center justify-between px-3 py-2 bg-(--surface-elevated) hover:bg-(--surface-hover) transition-colors"
            >
              <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Icon className="w-3 h-3" />
                {t(section.labelKey)}
                {section.value && (
                  <span className="px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 text-[9px] font-medium normal-case">
                    {t(section.options.find((o) => o.id === section.value)?.labelKey || "")}
                  </span>
                )}
              </span>
              {isExpanded ? (
                <ChevronUp className="w-3 h-3 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              )}
            </button>
            {isExpanded && (
              <div className="px-3 py-2">
                <ChipSelector
                  options={section.options}
                  selected={section.value}
                  onSelect={section.onChange}
                  t={t}
                />
              </div>
            )}
          </div>
        );
      })}

      {/* Preview */}
      {builtPrompt && (
        <div className="space-y-1.5">
          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("pbPreview")}
          </Label>
          <div className="p-2.5 rounded-lg bg-(--surface-elevated) border border-(--border) text-xs text-(--text-secondary) leading-relaxed font-mono">
            &quot;{builtPrompt}&quot;
          </div>
        </div>
      )}

      {/* Build button */}
      <button
        onClick={handleBuild}
        disabled={!builtPrompt.trim()}
        className={cn(
          "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all",
          builtPrompt.trim()
            ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-900/30 hover:shadow-xl hover:scale-[1.01]"
            : "bg-(--surface-muted) text-(--text-secondary) cursor-not-allowed"
        )}
      >
        <Wand2 className="w-4 h-4" />
        {t("pbBuildPrompt")}
      </button>
    </div>
  );
}
