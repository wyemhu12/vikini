"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { logger } from "@/lib/utils/logger";
import { useLanguage } from "../../chat/hooks/useLanguage";

interface EditImageModalProps {
  image: { id?: string; url: string; prompt: string; model?: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditComplete: () => void;
  conversationId: string | null;
}

const ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4"] as const;

const EDIT_MODELS = [
  { value: "gemini-3.1-flash-image-preview", label: "Nano Banana 2 (Gemini)" },
  { value: "gemini-3-pro-image-preview", label: "Nano Banana Pro (Gemini)" },
] as const;

export default function EditImageModal({
  image,
  open,
  onOpenChange,
  onEditComplete,
  conversationId,
}: EditImageModalProps) {
  const { t } = useLanguage();
  const [editPrompt, setEditPrompt] = useState("");
  const [model, setModel] = useState<string>(EDIT_MODELS[0].value);
  const [aspectRatio, setAspectRatio] = useState<string>("1:1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestionChips = [
    { key: "studioEditSugChangeBg" as const, label: t("studioEditSugChangeBg") },
    { key: "studioEditSugRemoveBg" as const, label: t("studioEditSugRemoveBg") },
    { key: "studioEditSugLighting" as const, label: t("studioEditSugLighting") },
    { key: "studioEditSugAnime" as const, label: t("studioEditSugAnime") },
    { key: "studioEditSugExtend" as const, label: t("studioEditSugExtend") },
    { key: "studioEditSugColor" as const, label: t("studioEditSugColor") },
  ];

  const handleApplyEdit = async () => {
    if (!image || !editPrompt.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/edit-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceImageUrl: image.url,
          prompt: editPrompt.trim(),
          model,
          aspectRatio,
          conversationId,
        }),
      });

      if (!res.ok) {
        const data: unknown = await res.json().catch(() => ({}));
        const message =
          data && typeof data === "object" && "error" in data
            ? String((data as Record<string, unknown>).error)
            : t("studioEditFailed");
        throw new Error(message);
      }

      setEditPrompt("");
      setError(null);
      onEditComplete();
      onOpenChange(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("studioEditFailed");
      logger.error("[EditImageModal] Edit failed:", err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-(--surface-elevated) border-(--border) max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-(--text-primary)">{t("studioEditImage")}</DialogTitle>
          <DialogDescription className="text-(--text-secondary)">
            {t("studioEditPromptPlaceholder")}
          </DialogDescription>
        </DialogHeader>

        {/* Source image preview */}
        {image && (
          <div className="rounded-lg overflow-hidden border border-(--border)">
            <img
              src={image.url}
              alt={image.prompt}
              className="w-full max-h-48 object-contain rounded-lg bg-black/5"
            />
          </div>
        )}

        {/* Edit prompt */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("studioEditPromptLabel")}
          </Label>
          <Textarea
            placeholder={t("studioEditPromptPlaceholder")}
            className="h-24 resize-none bg-(--input-bg) border-(--input-border) focus-visible:ring-1"
            value={editPrompt}
            onChange={(e) => setEditPrompt(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                if (editPrompt.trim() && !loading) {
                  handleApplyEdit();
                }
              }
            }}
          />
        </div>

        {/* Suggestion chips */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("studioEditSuggestions")}
          </Label>
          <div className="flex flex-wrap gap-2">
            <AnimatePresence>
              {suggestionChips.map((chip, i) => (
                <motion.button
                  key={chip.key}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.25 }}
                  onClick={() => setEditPrompt(chip.label)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                    "bg-(--surface-muted) border-(--border) hover:bg-purple-500/10 hover:border-purple-500/30",
                    "text-(--text-secondary) hover:text-(--text-primary)"
                  )}
                >
                  <Sparkles className="w-3 h-3 inline-block mr-1 opacity-60" />
                  {chip.label}
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Model selector */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("studioModel")}
          </Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger className="w-full bg-(--surface-elevated) border-(--border)">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-(--surface-elevated) border border-(--border) shadow-xl z-100">
              {EDIT_MODELS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Aspect ratio selector */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("studioDimensions")}
          </Label>
          <div className="grid grid-cols-5 gap-2">
            {ASPECT_RATIOS.map((ratio) => (
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

        {/* Error message */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Apply button */}
        <Button
          onClick={handleApplyEdit}
          disabled={loading || !editPrompt.trim()}
          className="w-full bg-linear-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg shadow-purple-900/20"
          size="lg"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t("studioEditing")}
            </span>
          ) : (
            t("studioApplyEdit")
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
