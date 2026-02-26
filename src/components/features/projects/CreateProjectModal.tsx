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
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#6b7280",
  "#1f2937",
];

/**
 * Modal to create a new project
 */
export function CreateProjectModal({ isOpen, onClose, onSuccess }: CreateProjectModalProps) {
  const { createProject, limits, isLoading: _isLoading } = useProjectStore();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("folder");
  const [color, setColor] = useState("#6366f1");
  const [embeddingModel, setEmbeddingModel] = useState<EmbeddingModel>("text-embedding-004");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableModels = limits?.availableModels ?? ["text-embedding-004"];
  const canUseGemini = availableModels.includes("gemini-embedding-001");

  // Auto-select best available model when tier limits load
  useEffect(() => {
    if (canUseGemini) {
      setEmbeddingModel("gemini-embedding-001");
    }
  }, [canUseGemini]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Project name is required");
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
      setIcon("📁");
      setColor("#6366f1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        className={cn(
          "relative w-full max-w-md mx-4",
          "bg-[color-mix(in_srgb,var(--surface)_98%,transparent)] backdrop-blur-xl",
          "border border-(--border) rounded-xl shadow-2xl",
          "animate-in fade-in-0 zoom-in-95 duration-200"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">Create New Project</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Project Name */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Project Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Research Project"
              className={cn(
                "w-full px-3 py-2 rounded-lg",
                "bg-muted/50 border border-border",
                "focus:outline-none focus:ring-2 focus:ring-primary/50",
                "text-sm placeholder:text-muted-foreground"
              )}
              maxLength={50}
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this project..."
              rows={2}
              className={cn(
                "w-full px-3 py-2 rounded-lg resize-none",
                "bg-muted/50 border border-border",
                "focus:outline-none focus:ring-2 focus:ring-primary/50",
                "text-sm placeholder:text-muted-foreground"
              )}
              maxLength={200}
            />
          </div>

          {/* Icon & Color */}
          <div className="grid grid-cols-2 gap-4">
            {/* Icon Picker */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Icon</label>
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
              <label className="block text-sm font-medium mb-1.5">Color</label>
              <div className="flex flex-wrap gap-1">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn(
                      "w-6 h-6 rounded-full transition-transform",
                      "hover:scale-110",
                      color === c && "ring-2 ring-offset-2 ring-offset-background ring-primary"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Embedding Model */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Embedding Model</label>
            <div className="space-y-2">
              <label
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border cursor-pointer",
                  "hover:bg-muted/50 transition-colors",
                  embeddingModel === "text-embedding-004"
                    ? "border-primary bg-primary/5"
                    : "border-border"
                )}
              >
                <input
                  type="radio"
                  name="embedding"
                  value="text-embedding-004"
                  checked={embeddingModel === "text-embedding-004"}
                  onChange={() => setEmbeddingModel("text-embedding-004")}
                  className="accent-primary"
                />
                <div>
                  <div className="text-sm font-medium">text-embedding-004</div>
                  <div className="text-xs text-muted-foreground">
                    Free • 768 dimensions • Good quality
                  </div>
                </div>
              </label>

              <label
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border cursor-pointer",
                  "transition-colors",
                  !canUseGemini && "opacity-50 cursor-not-allowed",
                  embeddingModel === "gemini-embedding-001"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                )}
              >
                <input
                  type="radio"
                  name="embedding"
                  value="gemini-embedding-001"
                  checked={embeddingModel === "gemini-embedding-001"}
                  onChange={() => canUseGemini && setEmbeddingModel("gemini-embedding-001")}
                  disabled={!canUseGemini}
                  className="accent-primary"
                />
                <div>
                  <div className="text-sm font-medium">gemini-embedding-001</div>
                  <div className="text-xs text-muted-foreground">
                    {canUseGemini
                      ? "Pro/Admin • 3072 dimensions • Best quality"
                      : "Requires Pro tier"}
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "flex-1 px-4 py-2 rounded-lg",
                "border border-border hover:bg-muted transition-colors",
                "text-sm font-medium"
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className={cn(
                "flex-1 px-4 py-2 rounded-lg",
                "bg-primary text-primary-foreground",
                "hover:bg-primary/90 transition-colors",
                "text-sm font-medium",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "flex items-center justify-center gap-2"
              )}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
