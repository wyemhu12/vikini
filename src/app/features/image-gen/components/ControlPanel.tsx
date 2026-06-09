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
import { Sparkles, Wand2, Settings, Upload, X, Image as ImageIcon, Info } from "lucide-react";
import React, { useState, useRef, useCallback, useEffect } from "react";
import SettingsModal from "./SettingsModal";
import { cn } from "@/lib/utils/cn";
import { useLanguage } from "../../chat/hooks/useLanguage";

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
  style: string;
  setStyle: (v: string) => void;
  isEnhancerOn: boolean;
  setIsEnhancerOn: (v: boolean) => void;
  onGenerate: () => void;
  generating: boolean;
  className?: string;
  // Phase 2: Reference Image
  referenceImage: File | null;
  setReferenceImage: (f: File | null) => void;
  // Phase 4: Batch Generation
  numberOfImages: number;
  setNumberOfImages: (n: number) => void;
  batchQuota: BatchQuotaInfo | null;
  generatingLabel?: string;
}

export default function ControlPanel({
  prompt,
  setPrompt,
  model,
  setModel,
  aspectRatio,
  setAspectRatio,
  style,
  setStyle,
  isEnhancerOn,
  setIsEnhancerOn,
  onGenerate,
  generating,
  className,
  referenceImage,
  setReferenceImage,
  numberOfImages,
  setNumberOfImages,
  batchQuota,
  generatingLabel,
}: ControlPanelProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tooltipBatch, setTooltipBatch] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();

  const [referencePreview, setReferencePreview] = useState<string | null>(null);

  useEffect(() => {
    if (!referenceImage) {
      setReferencePreview(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setReferencePreview(reader.result as string);
    reader.readAsDataURL(referenceImage);
  }, [referenceImage]);

  const handleRefUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && file.type.startsWith("image/")) {
        setReferenceImage(file);
      }
      // Reset input so same file can be re-selected
      e.target.value = "";
    },
    [setReferenceImage]
  );

  const isGeminiNative = model.includes("gemini-3") || model.includes("gemini-3.1");
  const showRefWarning = referenceImage && !isGeminiNative && !model.includes("imagen");

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
              <SelectItem value="gemini-3.1-flash-image-preview">Gemini Image Flash</SelectItem>
              <SelectItem value="gemini-3-pro-image-preview">Gemini Image Pro</SelectItem>
              <SelectItem value="black-forest-labs/flux-schnell">
                Flux Schnell (Replicate)
              </SelectItem>
              <SelectItem value="dall-e-3">DALL-E 3 (OpenAI)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Aspect Ratio */}
        <div className="space-y-2 px-6 mt-4">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("studioDimensions")}
          </Label>
          <div className="grid grid-cols-3 gap-2">
            {["1:1", "16:9", "9:16", "4:3", "3:4"].map((ratio) => (
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
        </div>

        {/* Style */}
        <div className="space-y-2 px-6 mt-4">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("studioStyle")}
          </Label>
          <StyleSelector selectedStyle={style} onSelect={setStyle} />
        </div>

        {/* Reference Image (Phase 2) */}
        <div className="space-y-2 px-4 md:px-6 mt-4">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("studioReferenceImage")}
          </Label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleRefUpload}
          />
          {referenceImage && referencePreview ? (
            <div className="relative group/ref rounded-lg overflow-hidden border border-(--border) bg-(--surface-elevated)">
              <img src={referencePreview} alt="Reference" className="w-full h-24 object-cover" />
              <button
                onClick={() => setReferenceImage(null)}
                className="absolute top-1 right-1 p-1 rounded-full bg-black/60 hover:bg-red-500/80 text-white transition-colors"
                title={t("studioRemoveRef")}
              >
                <X className="w-3 h-3" />
              </button>
              {showRefWarning && (
                <div className="absolute bottom-0 inset-x-0 bg-amber-500/90 text-white text-[9px] font-medium px-2 py-1 text-center">
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
                <div className="text-[10px] text-(--text-secondary)">{t("studioRefDesc")}</div>
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
