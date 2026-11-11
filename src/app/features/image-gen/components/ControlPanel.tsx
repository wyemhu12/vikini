"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import StyleSelector from "./StyleSelector";
import { Settings, Image as ImageIcon, Info } from "lucide-react";
import React, { useState, useId } from "react";
import SettingsModal from "./SettingsModal";
import { cn } from "@/lib/utils/cn";
import { useLanguage } from "../../chat/hooks/useLanguage";
import ControlPanelPromptSection, { STUDIO_LABEL_CLASS } from "./ControlPanelPromptSection";
import ControlPanelReferenceImages from "./ControlPanelReferenceImages";
import { AspectRatioPicker } from "./AspectRatioPicker";

export interface BatchQuotaInfo {
  rank: string;
  maxBatchSize: number;
  quotas: Record<number, { limit: number; used: number; remaining: number }>;
}

interface ControlPanelProps {
  prompt: string;
  setPrompt: (v: string) => void;
  model: string;
  setModel: (v: string) => void;
  aspectRatio: string;
  setAspectRatio: (v: string) => void;
  resolution: string;
  setResolution: (v: string) => void;
  style: string;
  setStyle: (v: string) => void;
  isEnhancerOn: boolean;
  setIsEnhancerOn: (v: boolean) => void;
  onGenerate: () => void;
  generating: boolean;
  className?: string;
  // Phase 2: Reference Images (multi)
  referenceImages: File[];
  setReferenceImages: (f: File[]) => void;
  // Phase 4: Batch Generation
  numberOfImages: number;
  setNumberOfImages: (n: number) => void;
  batchQuota: BatchQuotaInfo | null;
  generatingLabel?: string;
  // Quick Wins
  negativePrompt: string;
  setNegativePrompt: (v: string) => void;
  promptHistory: string[];
  onClearHistory: () => void;
}

// Aspect ratio groups for organized display
const COMMON_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4"];
const EXTENDED_RATIOS = ["3:2", "2:3", "21:9", "5:4", "4:5", "1:4", "4:1", "1:8", "8:1"];

// Resolution options with approximate cost per image
const RESOLUTION_OPTIONS = [
  { value: "0.5K", cost: "0.04" },
  { value: "1K", cost: "0.07" },
  { value: "2K", cost: "0.10" },
  { value: "4K", cost: "0.15" },
] as const;

// Compute approximate pixel dimensions from resolution + aspect ratio
function getPixelDimensions(resolution: string, aspectRatio: string): string {
  // Base pixel counts per resolution tier (total megapixels × 1M)
  const megapixels: Record<string, number> = {
    "0.5K": 0.25, // ~500×500
    "1K": 1.0, // ~1024×1024
    "2K": 4.0, // ~2048×2048
    "4K": 16.0, // ~4096×4096
  };
  const mp = megapixels[resolution] ?? 1.0;
  const totalPixels = mp * 1_000_000;

  const parts = aspectRatio.split(":");
  const w = parseInt(parts[0], 10) || 1;
  const h = parseInt(parts[1], 10) || 1;
  const ratio = w / h;

  const height = Math.round(Math.sqrt(totalPixels / ratio));
  const width = Math.round(height * ratio);
  return `${width}×${height}`;
}
export default function ControlPanel({
  prompt,
  setPrompt,
  model,
  setModel,
  aspectRatio,
  setAspectRatio,
  resolution,
  setResolution,
  style,
  setStyle,
  isEnhancerOn,
  setIsEnhancerOn,
  onGenerate,
  generating,
  className,
  referenceImages,
  setReferenceImages,
  numberOfImages,
  setNumberOfImages,
  batchQuota,
  generatingLabel,
  negativePrompt,
  setNegativePrompt,
  promptHistory,
  onClearHistory,
}: ControlPanelProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tooltipBatch, setTooltipBatch] = useState<number | null>(null);
  const enhanceId = useId();
  const enhanceDescId = useId();
  const promptHintId = useId();
  const { t } = useLanguage();

  const isGeminiNative = model.includes("gemini-3") || model.includes("gemini-3.1");
  const promptMissing = !generating && !prompt.trim();
  const selectedChoice = "bg-(--accent) text-(--on-accent) border-(--accent)";
  const idleChoice = "bg-(--raised) border-(--line) text-(--text) hover:border-(--accent)";

  return (
    <aside
      className={`w-full md:w-80 border-r border-(--line) h-full flex-col bg-(--surface) relative z-20 overflow-hidden ${className || "flex"}`}
    >
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto pt-4">
        <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />

        <ControlPanelPromptSection
          prompt={prompt}
          setPrompt={setPrompt}
          model={model}
          setModel={setModel}
          generating={generating}
          onGenerate={onGenerate}
          negativePrompt={negativePrompt}
          setNegativePrompt={setNegativePrompt}
          promptHistory={promptHistory}
          onClearHistory={onClearHistory}
          headerAction={
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("settings")}
              title={t("settings")}
              onClick={() => setSettingsOpen(true)}
            >
              <Settings aria-hidden="true" className="w-4 h-4 text-(--muted)" />
            </Button>
          }
        >
          <div className="flex items-center gap-2.5 pt-1">
            <Switch
              id={enhanceId}
              aria-describedby={enhanceDescId}
              checked={isEnhancerOn}
              onCheckedChange={setIsEnhancerOn}
            />
            <label htmlFor={enhanceId} className="cursor-pointer text-sm text-(--text)">
              {t("studioAiEnhance")}
            </label>
            <span id={enhanceDescId} className="sr-only">
              {t("studioAiEnhanceDesc")}
            </span>
          </div>
        </ControlPanelPromptSection>

        {/* Model */}
        <div className="space-y-2 px-6 mt-4">
          <Label className={STUDIO_LABEL_CLASS}>{t("studioModel")}</Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger
              aria-label={t("studioModel")}
              className="w-full bg-(--raised) border-(--line) text-left"
            >
              <SelectValue placeholder={t("studioSelectModel")} />
            </SelectTrigger>
            <SelectContent className="bg-(--surface) border border-(--line) shadow-xl z-100">
              <SelectItem value="gemini-3.1-flash-image">
                <div className="flex flex-col items-start gap-0.5 text-left">
                  <span className="font-medium">Gemini Image Flash</span>
                  <span className="text-xs text-(--muted)">{t("studioModelFlashDesc")}</span>
                </div>
              </SelectItem>
              <SelectItem value="gemini-3-pro-image">
                <div className="flex flex-col items-start gap-0.5 text-left">
                  <span className="font-medium">Gemini Image Pro</span>
                  <span className="text-xs text-(--muted)">{t("studioModelProDesc")}</span>
                </div>
              </SelectItem>
              <SelectItem value="black-forest-labs/flux-schnell">
                <div className="flex flex-col items-start gap-0.5 text-left">
                  <span className="font-medium">Flux Schnell (Replicate)</span>
                  <span className="text-xs text-(--muted)">{t("studioModelFluxDesc")}</span>
                </div>
              </SelectItem>
              <SelectItem value="gpt-image-2">
                <div className="flex flex-col items-start gap-0.5 text-left">
                  <span className="font-medium">GPT Image 2 (OpenAI)</span>
                  <span className="text-xs text-(--muted)">{t("studioModelGptImageDesc")}</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Aspect Ratio - Common + Extended */}
        <div className="space-y-2 px-6 mt-4">
          <Label className={STUDIO_LABEL_CLASS}>{t("studioDimensions")}</Label>
          <AspectRatioPicker
            value={aspectRatio}
            onChange={setAspectRatio}
            ratios={COMMON_RATIOS}
            extendedRatios={EXTENDED_RATIOS}
            label={t("studioAspectRatioGroup")}
            extendedLabel={t("studioExtraRatios")}
          />
        </div>

        {/* QW-A: Resolution Selector */}
        {isGeminiNative && (
          <div className="space-y-2 px-6 mt-4">
            <Label className={STUDIO_LABEL_CLASS}>{t("studioResolution")}</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {RESOLUTION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setResolution(opt.value)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 px-1.5 py-2 rounded-lg text-xs font-medium border transition-colors",
                    resolution === opt.value ? selectedChoice : idleChoice
                  )}
                >
                  <span className="font-bold">{t(`studioRes${opt.value.replace(".", "")}`)}</span>
                  <span
                    className={cn(
                      "text-xs",
                      resolution === opt.value ? "text-(--on-accent)/80" : "text-(--muted)"
                    )}
                  >
                    ~${opt.cost}
                  </span>
                </button>
              ))}
            </div>
            {/* Actual pixel dimensions */}
            <div className="flex items-center gap-1.5 mt-1.5 px-1">
              <span className="text-xs text-(--muted)">{t("studioActualResolution")}:</span>
              <span className="text-xs font-semibold text-(--text) bg-(--raised) px-2 py-0.5 rounded border border-(--line)">
                {getPixelDimensions(resolution, aspectRatio)} px
              </span>
            </div>
          </div>
        )}

        {/* Style */}
        <div className="space-y-2 px-6 mt-4">
          <Label className={STUDIO_LABEL_CLASS}>{t("studioStyle")}</Label>
          <StyleSelector selectedStyle={style} onSelect={setStyle} />
        </div>

        <ControlPanelReferenceImages
          model={model}
          referenceImages={referenceImages}
          setReferenceImages={setReferenceImages}
        />

        {/* Number of Images (Phase 4 - Batch Gen) */}
        {batchQuota && batchQuota.maxBatchSize > 1 && (
          <div className="space-y-2 px-6 mt-4">
            <Label className={STUDIO_LABEL_CLASS}>{t("studioNumberOfImages")}</Label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((num) => {
                const isAvailable = num <= batchQuota.maxBatchSize;
                const quota = num > 1 ? batchQuota.quotas[num] : null;
                const isExhausted = quota ? quota.remaining <= 0 : false;
                const isDisabled = !isAvailable || (num > 1 && isExhausted);

                return (
                  <div key={num} className="relative">
                    <button
                      onClick={() => !isDisabled && setNumberOfImages(num)}
                      onMouseEnter={() => num > 1 && setTooltipBatch(num)}
                      onMouseLeave={() => setTooltipBatch(null)}
                      onTouchStart={() => num > 1 && setTooltipBatch(num)}
                      onTouchEnd={() => setTimeout(() => setTooltipBatch(null), 2000)}
                      disabled={isDisabled}
                      className={cn(
                        "w-full px-2 py-2 rounded-md text-xs font-medium border transition-colors flex items-center justify-center gap-1",
                        numberOfImages === num
                          ? selectedChoice
                          : isDisabled
                            ? "bg-(--raised) border-(--line) text-(--muted) cursor-not-allowed opacity-50"
                            : idleChoice
                      )}
                    >
                      <ImageIcon className="w-3 h-3" />
                      {num}
                    </button>
                    {/* Quota tooltip */}
                    {tooltipBatch === num && quota && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-(--surface) border border-(--line) shadow-xl text-xs font-medium whitespace-nowrap z-50 animate-in fade-in slide-in-from-bottom-1">
                        <div className="flex items-center gap-1.5">
                          <Info className="w-3 h-3 text-(--text-secondary)" />
                          {isExhausted
                            ? t("studioBatchQuotaExhausted")
                            : t("studioBatchQuotaRemaining").replace(
                                "{remaining}",
                                String(quota.remaining)
                              )}
                        </div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-(--surface) border-r border-b border-(--line) rotate-45 -mt-1" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Sticky generate button at bottom */}
      <div className="shrink-0 px-4 md:px-6 py-4 border-t border-(--line)">
        <Button
          onClick={onGenerate}
          disabled={generating || !prompt.trim()}
          aria-describedby={promptMissing ? promptHintId : undefined}
          className="w-full bg-(--accent) text-(--on-accent) hover:bg-(--accent) hover:brightness-110 disabled:opacity-50"
          size="lg"
        >
          {generating ? (
            <span className="animate-pulse">{generatingLabel || t("studioGenerating")}</span>
          ) : numberOfImages > 1 ? (
            t("studioGenerateCount").replace("{n}", String(numberOfImages))
          ) : (
            t("studioGenerate")
          )}
        </Button>
        {promptMissing && (
          <p id={promptHintId} className="mt-2 text-center text-xs text-(--muted)">
            {t("studioPromptRequired")}
          </p>
        )}
        <p className="mt-2 text-center text-xs text-(--faint) pointer-coarse:hidden">
          {t("studioShortcutHint")}
        </p>
      </div>
    </aside>
  );
}
