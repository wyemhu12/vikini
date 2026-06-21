"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import PromptBuilder from "./PromptBuilder";
import {
  Sparkles,
  Wand2,
  Settings,
  Upload,
  X,
  Image as ImageIcon,
  Info,
  Ban,
  Clock,
  Trash2,
  Lightbulb,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import React, { useState, useRef, useCallback, useEffect } from "react";
import SettingsModal from "./SettingsModal";
import { cn } from "@/lib/utils/cn";
import { useLanguage } from "../../chat/hooks/useLanguage";

// Suggestion tags for quick keyword insertion — 3 categories
const SUGGESTION_TAGS = [
  // Style
  { key: "studioTagCinematicLighting", icon: "🎬" },
  { key: "studioTagBokeh", icon: "📷" },
  { key: "studioTagGoldenHour", icon: "🌅" },
  { key: "studioTagDramaticShadows", icon: "🌑" },
  // Color
  { key: "studioTagVibrantColors", icon: "🌈" },
  { key: "studioTagPastelTones", icon: "🎨" },
  { key: "studioTagMonochrome", icon: "⬛" },
  { key: "studioTagNeonGlow", icon: "💜" },
  // Composition
  { key: "studioTagCloseUp", icon: "🔍" },
  { key: "studioTagWideAngle", icon: "🏞️" },
  { key: "studioTagBirdsEye", icon: "🦅" },
  { key: "studioTagMinimalist", icon: "✨" },
] as const;

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
  onCancel?: () => void;
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
  onCancel,
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
  const [showNegativePrompt, setShowNegativePrompt] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [promptMode, setPromptMode] = useState<"free" | "guided">("free");
  const [showExtendedRatios, setShowExtendedRatios] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();

  const MAX_REF_IMAGES = 4;
  const [referencePreviews, setReferencePreviews] = useState<string[]>([]);

  useEffect(() => {
    if (referenceImages.length === 0) {
      setReferencePreviews([]);
      return;
    }
    const previews: string[] = [];
    let loaded = 0;
    referenceImages.forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = () => {
        previews[idx] = reader.result as string;
        loaded++;
        if (loaded === referenceImages.length) {
          setReferencePreviews([...previews]);
        }
      };
      reader.readAsDataURL(file);
    });
  }, [referenceImages]);

  const handleRefUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith("image/"));
      if (files.length > 0) {
        setReferenceImages([...referenceImages, ...files].slice(0, MAX_REF_IMAGES));
      }
      e.target.value = "";
    },
    [referenceImages, setReferenceImages]
  );

  const removeRefImage = useCallback(
    (index: number) => {
      setReferenceImages(referenceImages.filter((_, i) => i !== index));
    },
    [referenceImages, setReferenceImages]
  );

  const isGeminiNative = model.includes("gemini-3") || model.includes("gemini-3.1");
  const showRefWarning = referenceImages.length > 0 && !isGeminiNative;

  return (
    <aside
      className={`w-full md:w-80 border-r border-(--border) h-full flex-col bg-(--surface-base) relative z-20 shadow-xl overflow-hidden ${className || "flex"}`}
    >
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto pt-4">
        <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
        {/* Header */}
        <div className="px-6 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Wand2 className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">{t("studioTitle")}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)}>
            <Settings className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>

        {/* Prompt */}
        <div className="space-y-2 px-4 md:px-6">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("studioPromptLabel")}
          </Label>

          {/* MT4: Mode toggle — Free / Guided */}
          <div className="flex items-center gap-2 -mt-0.5">
            <button
              onClick={() => setPromptMode(promptMode === "free" ? "guided" : "free")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all",
                promptMode === "guided"
                  ? "bg-purple-500/15 border-purple-500/30 text-purple-300"
                  : "bg-(--surface-elevated) border-(--border) text-(--text-secondary) hover:text-(--text-primary)"
              )}
            >
              {promptMode === "guided" ? (
                <ToggleRight className="w-3.5 h-3.5" />
              ) : (
                <ToggleLeft className="w-3.5 h-3.5" />
              )}
              {t(promptMode === "guided" ? "pbModeGuided" : "pbModeFree")}
            </button>
          </div>

          {promptMode === "guided" ? (
            <PromptBuilder
              onBuildPrompt={(built) => {
                setPrompt(built);
                setPromptMode("free");
              }}
            />
          ) : (
            <>
              <Textarea
                placeholder={t("studioPromptPlaceholder")}
                className="h-32 resize-none bg-(--input-bg) border-(--input-border) focus-visible:ring-1"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  // Ctrl+Enter or Cmd+Enter to generate
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    e.preventDefault();
                    if (prompt.trim() && !generating) {
                      onGenerate();
                    }
                  }
                }}
              />
              <p className="text-[10px] text-muted-foreground">{t("studioShortcutHint")}</p>

              {/* Suggestion Tags — click to append keyword */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("studioTagsLabel")}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTION_TAGS.map((tag) => (
                    <button
                      key={tag.key}
                      onClick={() => {
                        const tagText = t(tag.key);
                        const separator = prompt.trim() ? ", " : "";
                        setPrompt(prompt.trim() + separator + tagText);
                      }}
                      className="px-2.5 py-1 rounded-full text-[11px] font-medium border border-(--border) bg-(--surface-elevated) hover:bg-purple-500/10 hover:border-purple-500/30 text-(--text-secondary) hover:text-(--text-primary) transition-all"
                    >
                      <span className="mr-1">{tag.icon}</span>
                      {t(tag.key)}
                    </button>
                  ))}
                </div>
              </div>

              {/* QW1: Negative Prompt (collapsible) */}
              <div className="pt-1">
                <button
                  onClick={() => setShowNegativePrompt(!showNegativePrompt)}
                  className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-(--text-primary) transition-colors"
                >
                  <Ban className="w-3 h-3" />
                  {t("studioExclude")}
                  {negativePrompt && <span className="w-1.5 h-1.5 rounded-full bg-red-400" />}
                </button>
                {showNegativePrompt && (
                  <Textarea
                    placeholder={t("studioNegativePromptPlaceholder")}
                    className="mt-1.5 h-16 resize-none bg-(--input-bg) border-(--input-border) focus-visible:ring-1 text-xs"
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                  />
                )}
              </div>

              {/* QW7: Text Rendering Tip */}
              {prompt.match(/["'].+?["']/) && model.includes("flash-image") && (
                <button
                  onClick={() => setModel("gemini-3-pro-image")}
                  className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-600 dark:text-amber-400 font-medium hover:bg-amber-500/20 transition-all w-full text-left"
                >
                  <Lightbulb className="w-3.5 h-3.5 shrink-0" />
                  <span className="flex-1">{t("studioTextRenderingTip")}</span>
                </button>
              )}

              {/* QW5: Prompt History */}
              {promptHistory.length > 0 && (
                <div className="pt-1">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setShowHistory(!showHistory)}
                      className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-(--text-primary) transition-colors"
                    >
                      <Clock className="w-3 h-3" />
                      {t("studioPromptHistory")}
                      <span className="text-[9px] font-normal">({promptHistory.length})</span>
                    </button>
                    {showHistory && (
                      <button
                        onClick={onClearHistory}
                        className="text-[10px] text-red-400 hover:text-red-300 transition-colors flex items-center gap-1"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                        {t("studioClearHistory")}
                      </button>
                    )}
                  </div>
                  {showHistory && (
                    <div className="mt-1.5 flex flex-col gap-1 max-h-32 overflow-y-auto custom-scrollbar">
                      {promptHistory.slice(0, 10).map((hp, i) => (
                        <button
                          key={i}
                          onClick={() => setPrompt(hp)}
                          className="text-left text-[11px] text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--surface-hover) px-2 py-1.5 rounded-md transition-colors truncate"
                          title={hp}
                        >
                          {hp}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Magic Enhance Toggle */}
        <div className="space-y-2 px-4 md:px-6 mt-4">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("studioEnhancement")}
          </Label>
          <div
            onClick={() => setIsEnhancerOn(!isEnhancerOn)}
            className={`
                        relative flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all
                        ${
                          isEnhancerOn
                            ? "bg-purple-500/10 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                            : "bg-(--input-bg) border border-(--input-border) hover:border-purple-500/20"
                        }
                    `}
          >
            <div
              className={`
                        flex items-center justify-center w-10 h-10 rounded-lg transition-all
                        ${
                          isEnhancerOn
                            ? "bg-purple-500 text-white shadow-lg"
                            : "bg-(--surface-muted) text-(--text-secondary)"
                        }
                    `}
            >
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm text-(--text-primary)">
                {t("studioAiEnhance")}
              </div>
              <div className="text-[10px] text-(--text-secondary)">{t("studioAiEnhanceDesc")}</div>
            </div>
            <Switch
              checked={isEnhancerOn}
              onCheckedChange={setIsEnhancerOn}
              className="pointer-events-none"
            />
          </div>
        </div>
        {/* Model */}
        <div className="space-y-2 px-6 mt-4">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("studioModel")}
          </Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger className="w-full bg-(--surface-elevated) border-(--border)">
              <SelectValue placeholder={t("studioSelectModel")} />
            </SelectTrigger>
            <SelectContent className="bg-(--surface-elevated) border border-(--border) shadow-xl z-100">
              <SelectItem value="gemini-3.1-flash-image">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">Gemini Image Flash</span>
                  <span className="text-xs text-(--text-secondary)">
                    {t("studioModelFlashDesc")}
                  </span>
                </div>
              </SelectItem>
              <SelectItem value="gemini-3-pro-image">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">Gemini Image Pro</span>
                  <span className="text-xs text-(--text-secondary)">{t("studioModelProDesc")}</span>
                </div>
              </SelectItem>
              <SelectItem value="black-forest-labs/flux-schnell">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">Flux Schnell (Replicate)</span>
                  <span className="text-xs text-(--text-secondary)">
                    {t("studioModelFluxDesc")}
                  </span>
                </div>
              </SelectItem>
              <SelectItem value="gpt-image-2">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">GPT Image 2 (OpenAI)</span>
                  <span className="text-xs text-(--text-secondary)">
                    {t("studioModelGptImageDesc")}
                  </span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Aspect Ratio — Common + Extended */}
        <div className="space-y-2 px-6 mt-4">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("studioDimensions")}
          </Label>
          <div className="grid grid-cols-3 gap-2">
            {COMMON_RATIOS.map((ratio) => (
              <button
                key={ratio}
                onClick={() => setAspectRatio(ratio)}
                className={cn(
                  "px-2 py-2 rounded-md text-xs font-medium border transition-all",
                  aspectRatio === ratio
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-(--surface-elevated) border-(--border) hover:bg-(--surface-hover)"
                )}
              >
                {ratio}
              </button>
            ))}
          </div>
          {/* Extended ratios toggle */}
          <button
            onClick={() => setShowExtendedRatios(!showExtendedRatios)}
            className="text-[10px] font-medium text-purple-400 hover:text-purple-300 transition-colors"
          >
            {showExtendedRatios ? "▾" : "▸"} {t("studioExtraRatios")} ({EXTENDED_RATIOS.length})
          </button>
          {showExtendedRatios && (
            <div className="grid grid-cols-3 gap-2 animate-in fade-in slide-in-from-top-1">
              {EXTENDED_RATIOS.map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => setAspectRatio(ratio)}
                  className={cn(
                    "px-2 py-2 rounded-md text-xs font-medium border transition-all",
                    aspectRatio === ratio
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-(--surface-elevated) border-(--border) hover:bg-(--surface-hover)"
                  )}
                >
                  {ratio}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* QW-A: Resolution Selector */}
        {isGeminiNative && (
          <div className="space-y-2 px-6 mt-4">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("studioResolution")}
            </Label>
            <div className="grid grid-cols-4 gap-1.5">
              {RESOLUTION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setResolution(opt.value)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 px-1.5 py-2 rounded-lg text-xs font-medium border transition-all",
                    resolution === opt.value
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-(--surface-elevated) border-(--border) hover:bg-(--surface-hover)"
                  )}
                >
                  <span className="font-bold">{t(`studioRes${opt.value.replace(".", "")}`)}</span>
                  <span
                    className={cn(
                      "text-[9px]",
                      resolution === opt.value
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground"
                    )}
                  >
                    ~${opt.cost}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Style */}
        <div className="space-y-2 px-6 mt-4">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("studioStyle")}
          </Label>
          <StyleSelector selectedStyle={style} onSelect={setStyle} />
        </div>

        {/* Reference Images (QW-D: Multi-reference, max 4) */}
        <div className="space-y-2 px-4 md:px-6 mt-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("studioReferenceImages")}
            </Label>
            {referenceImages.length > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {t("studioRefCount").replace("{{count}}", String(referenceImages.length))}
              </span>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleRefUpload}
          />
          {referenceImages.length > 0 ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {referencePreviews.map((preview, idx) => (
                  <div
                    key={idx}
                    className="relative group/ref rounded-lg overflow-hidden border border-(--border) bg-(--surface-elevated)"
                  >
                    <img
                      src={preview}
                      alt={`Reference ${idx + 1}`}
                      className="w-full h-20 object-cover"
                    />
                    <button
                      onClick={() => removeRefImage(idx)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-black/60 hover:bg-red-500/80 text-white transition-colors opacity-0 group-hover/ref:opacity-100"
                      title={t("studioRemoveRef")}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {/* Add more button */}
                {referenceImages.length < MAX_REF_IMAGES && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center h-20 rounded-lg border border-dashed border-(--border) hover:border-purple-500/30 hover:bg-purple-500/5 transition-all"
                  >
                    <Upload className="w-4 h-4 text-(--text-secondary) mb-1" />
                    <span className="text-[10px] text-(--text-secondary)">
                      {t("studioAddMoreRef")}
                    </span>
                  </button>
                )}
              </div>
              {showRefWarning && (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-medium px-2.5 py-1.5 rounded-lg text-center">
                  {t("studioRefOnlyGemini")}
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-dashed border-(--border) hover:border-purple-500/30 hover:bg-purple-500/5 transition-all text-left"
            >
              <div className="p-2 rounded-lg bg-(--surface-muted) text-(--text-secondary)">
                <Upload className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-(--text-primary)">
                  {t("studioUploadRef")}
                </div>
                <div className="text-[10px] text-(--text-secondary)">
                  {t("studioRefImagesDesc")}
                </div>
              </div>
            </button>
          )}
        </div>

        {/* Number of Images (Phase 4 - Batch Gen) */}
        {batchQuota && batchQuota.maxBatchSize > 1 && (
          <div className="space-y-2 px-6 mt-4">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("studioNumberOfImages")}
            </Label>
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
                        "w-full px-2 py-2 rounded-md text-xs font-medium border transition-all flex items-center justify-center gap-1",
                        numberOfImages === num
                          ? "bg-primary text-primary-foreground border-primary"
                          : isDisabled
                            ? "bg-(--surface-muted) border-(--border) text-(--text-secondary)/40 cursor-not-allowed opacity-50"
                            : "bg-(--surface-elevated) border-(--border) hover:bg-(--surface-hover)"
                      )}
                    >
                      <ImageIcon className="w-3 h-3" />
                      {num}
                    </button>
                    {/* Quota tooltip */}
                    {tooltipBatch === num && quota && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-(--surface-elevated) border border-(--border) shadow-xl text-[10px] font-medium whitespace-nowrap z-50 animate-in fade-in slide-in-from-bottom-1">
                        <div className="flex items-center gap-1.5">
                          <Info className="w-3 h-3 text-(--text-secondary)" />
                          {isExhausted
                            ? t("studioBatchQuotaExhausted")
                            : t("studioBatchQuotaRemaining").replace(
                                "{remaining}",
                                String(quota.remaining)
                              )}
                        </div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-(--surface-elevated) border-r border-b border-(--border) rotate-45 -mt-1" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Sticky generate/cancel button at bottom */}
      <div className="shrink-0 px-4 md:px-6 py-4 border-t border-(--border)">
        {generating ? (
          <div className="flex gap-2">
            <Button
              disabled
              className="flex-1 bg-linear-to-r from-purple-600 to-blue-600 text-white opacity-80"
              size="lg"
            >
              <span className="animate-pulse">{generatingLabel || t("studioGenerating")}</span>
            </Button>
            {onCancel && (
              <Button
                onClick={onCancel}
                variant="outline"
                size="lg"
                className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
              >
                {t("studioCancel")}
              </Button>
            )}
          </div>
        ) : (
          <Button
            onClick={onGenerate}
            disabled={!prompt.trim()}
            className="w-full bg-linear-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg shadow-purple-900/20"
            size="lg"
          >
            {numberOfImages > 1
              ? `${t("studioGenerate")} (${numberOfImages} ${t("studioBatchImages")})`
              : t("studioGenerate")}
          </Button>
        )}
      </div>
    </aside>
  );
}
