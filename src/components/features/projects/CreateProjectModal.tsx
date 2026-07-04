"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Loader2,
  Folder,
  FolderOpen,
  BookOpen,
  Briefcase,
  Target,
  Rocket,
  Lightbulb,
  Zap,
  FlaskConical,
  Palette,
  BarChart3,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useProjectStore } from "@/lib/store/projectStore";
import { toast } from "@/lib/store/toastStore";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";
import type { EmbeddingModel } from "@/types/projects";

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// Lucide icons for project selection
const ICON_OPTIONS = [
  { id: "folder", icon: Folder },
  { id: "folder-open", icon: FolderOpen },
  { id: "book", icon: BookOpen },
  { id: "briefcase", icon: Briefcase },
  { id: "target", icon: Target },
  { id: "rocket", icon: Rocket },
  { id: "lightbulb", icon: Lightbulb },
  { id: "zap", icon: Zap },
  { id: "flask", icon: FlaskConical },
  { id: "palette", icon: Palette },
  { id: "chart", icon: BarChart3 },
  { id: "star", icon: Star },
];

const COLORS = [
  "var(--color-indigo-500)",
  "var(--color-violet-500)",
  "var(--color-pink-500)",
  "var(--color-red-500)",
  "var(--color-orange-500)",
  "var(--color-yellow-500)",
  "var(--color-green-500)",
  "var(--color-teal-500)",
  "var(--color-cyan-500)",
  "var(--color-blue-500)",
  "var(--color-gray-500)",
  "var(--color-slate-800)",
];

/**
 * Modal to create a new project - uses Radix Dialog for focus trap + ESC
 */
export function CreateProjectModal({ isOpen, onClose, onSuccess }: CreateProjectModalProps) {
  const { createProject, limits, isLoading: _isLoading } = useProjectStore();
  const { t } = useLanguage();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("folder");
  const [color, setColor] = useState("var(--color-indigo-500)");
  const [embeddingModel, setEmbeddingModel] = useState<EmbeddingModel>("text-embedding-004");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableModels = limits?.availableModels ?? ["text-embedding-004"];

  // Embedding model metadata for display
  const EMBEDDING_MODEL_INFO: Record<
    EmbeddingModel,
    { label: string; dims: number; desc: string; descLocked: string }
  > = {
    "text-embedding-004": {
      label: "text-embedding-004",
      dims: 768,
      desc: t("freeModelDesc"),
      descLocked: t("freeModelDesc"),
    },
    "gemini-embedding-2": {
      label: "gemini-embedding-2",
      dims: 3072,
      desc: t("bestModelDesc"),
      descLocked: t("notAvailableTier"),
    },
  };

  // Auto-select best available model when tier limits load
  useEffect(() => {
    if (availableModels.includes("gemini-embedding-2")) {
      setEmbeddingModel("gemini-embedding-2");
    }
  }, [availableModels]);

  // All models in display order
  const allModels: EmbeddingModel[] = ["text-embedding-004", "gemini-embedding-2"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError(t("projectNameRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      await createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        icon,
        color,
        embedding_model: embeddingModel,
      });
      onSuccess?.();
      onClose();
      // Reset form
      setName("");
      setDescription("");
      setIcon("folder");
      setColor("var(--color-indigo-500)");

      toast.success(t("projectCreatedSuccess"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("createProjectFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-0 gap-0 [&>button]:hidden">
        <DialogTitle className="sr-only">{t("createNewProject")}</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-(--border)">
          <h2 className="text-lg font-semibold">{t("createNewProject")}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-(--control-bg-hover) rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-(--text-secondary)" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Project Name */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              {t("projectName")} <span className="text-(--danger)">*</span>
            </label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("projectNamePlaceholder")}
              maxLength={50}
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1.5">{t("descriptionOptional")}</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("descriptionPlaceholder")}
              rows={2}
              maxLength={200}
              className="resize-none"
            />
          </div>

          {/* Icon & Color */}
          <div className="grid grid-cols-2 gap-4">
            {/* Icon Picker */}
            <div>
              <label className="block text-sm font-medium mb-1.5">{t("iconLabel")}</label>
              <div className="flex flex-wrap gap-1">
                {ICON_OPTIONS.map(({ id, icon: IconComponent }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setIcon(id)}
                    className={cn(
                      "w-8 h-8 flex items-center justify-center rounded",
                      "hover:bg-(--control-bg-hover) transition-colors",
                      icon === id && "ring-2 ring-(--accent) bg-(--control-bg)"
                    )}
                  >
                    <IconComponent className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>

            {/* Color Picker */}
            <div>
              <label className="block text-sm font-medium mb-1.5">{t("colorLabel")}</label>
              <div className="flex flex-wrap gap-1">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn(
                      "w-7 h-7 rounded-full transition-transform cursor-pointer",
                      "hover:scale-110",
                      color === c &&
                        "ring-2 ring-offset-2 ring-offset-[var(--surface)] ring-[var(--accent)] scale-110"
                    )}
                    style={{ backgroundColor: c }}
                  >
                    <span className="sr-only">{c}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Embedding Model */}
          <div>
            <label className="block text-sm font-medium mb-1.5">{t("embeddingModelLabel")}</label>
            <div className="space-y-2">
              {allModels.map((modelId) => {
                const info = EMBEDDING_MODEL_INFO[modelId];
                const isAvailable = availableModels.includes(modelId);
                return (
                  <label
                    key={modelId}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border cursor-pointer",
                      "transition-colors",
                      !isAvailable && "opacity-50 cursor-not-allowed",
                      embeddingModel === modelId
                        ? "border-(--accent) bg-(--accent)/5"
                        : "border-(--border) hover:bg-(--control-bg)"
                    )}
                  >
                    <input
                      type="radio"
                      name="embedding"
                      value={modelId}
                      checked={embeddingModel === modelId}
                      onChange={() => isAvailable && setEmbeddingModel(modelId)}
                      disabled={!isAvailable}
                      className="accent-[var(--accent)]"
                    />
                    <div>
                      <div className="text-sm font-medium">{info.label}</div>
                      <div className="text-xs text-(--text-secondary)">
                        {isAvailable ? info.desc : info.descLocked}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 rounded-lg bg-(--danger)/10 border border-(--danger)/20 text-sm text-(--danger)">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              {t("cancelLabel")}
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()} className="flex-1">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("createProjectBtn")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
