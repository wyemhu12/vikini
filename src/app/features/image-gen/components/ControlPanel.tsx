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
import { Sparkles, Wand2, Settings } from "lucide-react";
import { useState } from "react";
import SettingsModal from "./SettingsModal";
import { cn } from "@/lib/utils/cn";
import { useLanguage } from "../../chat/hooks/useLanguage";

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
}: ControlPanelProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { t } = useLanguage();

  return (
    <aside className="w-full md:w-80 border-r border-(--border) h-full flex flex-col bg-(--surface-base) relative z-20 shadow-xl overflow-hidden pt-4 overflow-y-auto">
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
      <div className="space-y-2 px-6">
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
      <div className="space-y-2 px-6 mt-4">
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
            <div className="font-medium text-sm text-(--text-primary)">{t("studioAiEnhance")}</div>
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
            <SelectItem value="imagen-4.0-generate-001">Imagen 4.0 (Gemini)</SelectItem>
            <SelectItem value="black-forest-labs/flux-schnell">Flux Schnell (Replicate)</SelectItem>
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

      <div className="mt-auto px-6 pb-6">
        <Button
          onClick={onGenerate}
          disabled={generating || !prompt.trim()}
          className="w-full bg-linear-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg shadow-purple-900/20"
          size="lg"
        >
          {generating ? (
            <span className="animate-pulse">{t("studioGenerating")}</span>
          ) : (
            t("studioGenerate")
          )}
        </Button>
      </div>
    </aside>
  );
}
