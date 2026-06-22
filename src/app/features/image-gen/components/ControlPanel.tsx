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
  const [showNegativePrompt, setShowNegativePrompt] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [promptMode, setPromptMode] = useState<"free" | "guided">("free");
  const [showExtendedRatios, setShowExtendedRatios] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();

  // P2-7: Prompt Autocomplete state
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIdx, setSelectedSuggestionIdx] = useState(-1);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // P2-7: Fetch AI suggestions
  const fetchSuggestions = useCallback(async (text: string) => {
    if (text.trim().length < 5) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setLoadingSuggestions(true);
    try {
      const res = await fetch("/api/prompt-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partialPrompt: text.trim() }),
      });
      const json = await res.json();
      if (json.success && json.data?.suggestions?.length > 0) {
        setSuggestions(json.data.suggestions);
        setShowSuggestions(true);
        setSelectedSuggestionIdx(-1);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch {
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  // P2-7: Debounced prompt change handler
  const handlePromptChange = useCallback(
    (value: string) => {
      setPrompt(value);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        void fetchSuggestions(value);
      }, 600);
    },
    [setPrompt, fetchSuggestions]
  );

  // P2-7: Keyboard handler for autocomplete navigation
  const handlePromptKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!showSuggestions || suggestions.length === 0) {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          if (prompt.trim() && !generating) {
            onGenerate();
          }
        }
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSuggestionIdx((prev) => Math.min(prev + 1, suggestions.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSuggestionIdx((prev) => Math.max(prev - 1, -1));
      } else if (e.key === "Enter" && selectedSuggestionIdx >= 0) {
        e.preventDefault();
        setPrompt(suggestions[selectedSuggestionIdx]);
        setShowSuggestions(false);
      } else if (e.key === "Escape") {
        setShowSuggestions(false);
      } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        setShowSuggestions(false);
        onGenerate();
      }
    },
    [showSuggestions, suggestions, selectedSuggestionIdx, setPrompt, onGenerate, prompt, generating]
  );

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

          {/* MT4: Mode tabs — Free / Guided */}
          <div className="flex items-center rounded-lg bg-(--surface-muted) border border-(--border) p-0.5 -mt-0.5">
            <button
              onClick={() => setPromptMode("free")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                promptMode === "free"
                  ? "bg-(--surface-elevated) text-(--text-primary) shadow-sm border border-(--border)"
                  : "text-(--text-secondary) hover:text-(--text-primary)"
              )}
            >
              {t("pbModeFree")}
            </button>
            <button
              onClick={() => setPromptMode("guided")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                promptMode === "guided"
                  ? "bg-purple-500/15 text-purple-300 shadow-sm border border-purple-500/30"
                  : "text-(--text-secondary) hover:text-(--text-primary)"
              )}
            >
              {t("pbModeGuided")}
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
              <div className="relative">
                <Textarea
                  placeholder={t("studioPromptPlaceholder")}
                  className="h-32 resize-none bg-(--input-bg) border-(--input-border) focus-visible:ring-1"
                  value={prompt}
                  onChange={(e) => handlePromptChange(e.target.value)}
                  onKeyDown={handlePromptKeyDown}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                />
                {/* AI Autocomplete Suggestions */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-(--surface-elevated) border border-(--border) rounded-lg shadow-xl overflow-hidden">
                    {loadingSuggestions && (
                      <div className="px-3 py-2 text-xs text-(--text-secondary) animate-pulse">
                        ✨ {t("studioSuggestLoading")}
                      </div>
                    )}
                    {suggestions.map((s, idx) => (
                      <button
                        key={idx}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setPrompt(s);
                          setShowSuggestions(false);
                        }}
                        className={cn(
                          "w-full text-left px-3 py-2.5 text-xs transition-colors border-b border-(--border) last:border-b-0",
                          idx === selectedSuggestionIdx
                            ? "bg-purple-500/10 text-purple-300"
                            : "hover:bg-(--surface-hover) text-(--text-primary)"
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">{t("studioShortcutHint")}</p>

              {/* Suggestion Tags — click to append keyword */}
              <div className="space-y-1.5 pt-2">
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-purple-400 cursor-help"
                  title={t("studioQuickAddTooltip")}
                >
                  <Sparkles className="w-3 h-3" />
                  {t("studioQuickAddLabel")}
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
              <div className="pt-2">
                <button
                  onClick={() => setShowNegativePrompt(!showNegativePrompt)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-red-500/8 border border-red-500/20 text-red-400 hover:bg-red-500/15 hover:text-red-300 transition-all"
                  title={t("studioExcludeTooltip")}
                >
                  <Ban className="w-3 h-3" />
                  {t("studioExcludeLabel")}
                  {negativePrompt && (
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                  )}
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
                <div className="pt-2">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setShowHistory(!showHistory)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-blue-500/8 border border-blue-500/20 text-blue-400 hover:bg-blue-500/15 hover:text-blue-300 transition-all"
                      title={t("studioHistoryTooltip")}
                    >
                      <Clock className="w-3 h-3" />
                      {t("studioPromptHistory")}
                      <span className="text-[9px] font-normal bg-blue-500/20 px-1.5 py-0.5 rounded-full">
                        ({promptHistory.length})
                      </span>
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
            {/* Actual pixel dimensions */}
            <div className="flex items-center gap-1.5 mt-1.5 px-1">
              <span className="text-[10px] text-muted-foreground">
                {t("studioActualResolution")}:
              </span>
              <span className="text-[10px] font-bold text-(--text-primary) bg-(--surface-elevated) px-2 py-0.5 rounded border border-(--border)">
                {getPixelDimensions(resolution, aspectRatio)} px
              </span>
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

      {/* Sticky generate button at bottom */}
      <div className="shrink-0 px-4 md:px-6 py-4 border-t border-(--border)">
        <Button
          onClick={onGenerate}
          disabled={generating || !prompt.trim()}
          className="w-full bg-linear-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg shadow-purple-900/20"
          size="lg"
        >
          {generating ? (
            <span className="animate-pulse">{generatingLabel || t("studioGenerating")}</span>
          ) : numberOfImages > 1 ? (
            `${t("studioGenerate")} (${numberOfImages} ${t("studioBatchImages")})`
          ) : (
            t("studioGenerate")
          )}
        </Button>
      </div>
    </aside>
  );
}
