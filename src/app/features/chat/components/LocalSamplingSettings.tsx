"use client";

import React from "react";
import { SlidersHorizontal, RotateCcw, Sparkles } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useLanguage } from "../hooks/useLanguage";
import { getEffectiveThinkingLevel, type ThinkingLevel } from "./hooks/useThinkingLevel";
import { useStrataSampling } from "./hooks/useStrataSampling";
import type {
  StrataSamplingMode,
  StrataSamplingValues,
} from "@/lib/features/local-llm/strataThinking";

interface LocalSamplingSettingsProps {
  currentModel: string;
  thinkingLevel: ThinkingLevel;
  disabled?: boolean;
}

interface SliderConfig {
  key: keyof StrataSamplingValues;
  label: string;
  descKey: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}

const SLIDER_CONFIGS: readonly SliderConfig[] = [
  {
    key: "temperature",
    label: "Temperature",
    descKey: "localSamplingTempDesc",
    min: 0,
    max: 2,
    step: 0.05,
    format: (v) => v.toFixed(2),
  },
  {
    key: "top_p",
    label: "Top P",
    descKey: "localSamplingTopPDesc",
    min: 0.05,
    max: 1,
    step: 0.01,
    format: (v) => v.toFixed(2),
  },
  {
    key: "top_k",
    label: "Top K",
    descKey: "localSamplingTopKDesc",
    min: 0,
    max: 64,
    step: 1,
    format: (v) => String(Math.round(v)),
  },
  {
    key: "min_p",
    label: "Min P",
    descKey: "localSamplingMinPDesc",
    min: 0,
    max: 0.5,
    step: 0.01,
    format: (v) => v.toFixed(2),
  },
  {
    key: "presence_penalty",
    label: "Presence Penalty",
    descKey: "localSamplingPresenceDesc",
    min: 0,
    max: 2,
    step: 0.05,
    format: (v) => v.toFixed(2),
  },
];

export default function LocalSamplingSettings({
  currentModel,
  thinkingLevel,
  disabled = false,
}: LocalSamplingSettingsProps) {
  const { t } = useLanguage();
  const effectiveLevel = getEffectiveThinkingLevel(currentModel, thinkingLevel);
  const thinkingOn = effectiveLevel !== "off";
  const { sampling, selectMode, updateCustomParam, resetToDefault } = useStrataSampling(thinkingOn);

  const modes: Array<{ value: StrataSamplingMode; label: string }> = [
    { value: "default", label: t("localSamplingModeDefault") },
    { value: "creative", label: t("localSamplingModeCreative") },
    { value: "custom", label: t("localSamplingModeCustom") },
  ];

  const isNonDefault = sampling.mode !== "default";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={t("localSamplingTitle")}
          title={t("localSamplingTitle")}
          className={`flex items-center gap-1.5 rounded-full bg-(--control-bg) border border-(--control-border) md:bg-transparent md:border-0 px-3 py-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none active:scale-[0.95] ${
            disabled
              ? "opacity-50 cursor-not-allowed text-(--text-secondary)"
              : isNonDefault
                ? "text-(--accent) hover:bg-(--control-bg)"
                : "text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg)"
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">
            {sampling.mode === "creative"
              ? t("localSamplingModeCreative")
              : sampling.mode === "custom"
                ? t("localSamplingModeCustom")
                : "SAMPLING"}
          </span>
          {sampling.mode === "creative" && <Sparkles className="w-3 h-3 text-(--accent)" />}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={8}
        className="w-[min(360px,calc(100vw-2rem))] p-4 bg-(--surface-muted) border border-(--border) rounded-xl shadow-2xl space-y-4"
      >
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-(--text-primary)">
            {t("localSamplingTitle")}
          </h4>
          <button
            type="button"
            onClick={() => resetToDefault(thinkingOn)}
            aria-label={t("localSamplingReset")}
            className="flex items-center gap-1 text-xs font-medium text-(--text-secondary) hover:text-(--text-primary) px-2 py-1 rounded-md hover:bg-(--control-bg) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
          >
            <RotateCcw className="w-3 h-3" />
            <span>{t("localSamplingReset")}</span>
          </button>
        </div>

        {/* Preset mode selector */}
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-(--control-bg) border border-(--border)">
          {modes.map((m) => {
            const active = sampling.mode === m.value;
            return (
              <button
                key={m.value}
                type="button"
                aria-pressed={active}
                onClick={() => selectMode(m.value, thinkingOn)}
                className={`text-xs font-semibold py-1.5 px-2 rounded-md transition-colors truncate focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none ${
                  active
                    ? "bg-(--accent) text-(--accent-foreground) shadow-sm"
                    : "text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--control-bg-hover)"
                }`}
                title={m.label}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Sliders */}
        <div className="space-y-3">
          {SLIDER_CONFIGS.map((cfg) => {
            const val = sampling[cfg.key];
            return (
              <div key={cfg.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-(--text-primary)">{cfg.label}</span>
                  <span className="font-mono text-(--accent) font-semibold">{cfg.format(val)}</span>
                </div>
                <input
                  type="range"
                  aria-label={cfg.label}
                  min={cfg.min}
                  max={cfg.max}
                  step={cfg.step}
                  value={val}
                  onChange={(e) =>
                    updateCustomParam(cfg.key, parseFloat(e.target.value), thinkingOn)
                  }
                  className="w-full accent-(--accent) cursor-pointer h-1.5 rounded-lg bg-(--control-bg)"
                />
                <p className="text-xs text-(--text-secondary) leading-snug">{t(cfg.descKey)}</p>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
