"use client";

import React, { useState } from "react";
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
  "#6366f1", // indigo-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#f43f5e", // rose-500
  "#f97316", // orange-500
  "#eab308", // yellow-500
  "#22c55e", // green-500
  "#14b8a6", // teal-500
  "#06b6d4", // cyan-500
  "#3b82f6", // blue-500
  "#6b7280", // gray-500
  "#1e293b", // slate-800
];

/**
 * Modal to create a new project - uses Radix Dialog for focus trap + ESC
 */
export function CreateProjectModal({ isOpen, onClose, onSuccess }: CreateProjectModalProps) {
  const { createProject, isLoading: _isLoading } = useProjectStore();
  const { t } = useLanguage();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("folder");
  const [color, setColor] = useState("#6366f1");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      });
      onSuccess?.();
      onClose();
      // Reset form
      setName("");
      setDescription("");
      setIcon("folder");
      setColor("#6366f1");

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
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
              style={{ backgroundColor: color }}
            >
              {(() => {
                const IconComponent = ICON_OPTIONS.find((i) => i.id === icon)?.icon || Folder;
                return <IconComponent className="w-4 h-4" />;
              })()}
            </div>
            <h2 className="text-lg font-semibold">{t("createNewProject")}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--control-bg)] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1.5">{t("projectName")}</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("projectNamePlaceholder")}
              maxLength={100}
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1.5">{t("projectDescription")}</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("projectDescriptionPlaceholder")}
              rows={2}
              maxLength={500}
            />
          </div>

          {/* Icon & Color Selection */}
          <div className="grid grid-cols-2 gap-4">
            {/* Icon */}
            <div>
              <label className="block text-sm font-medium mb-1.5">{t("iconLabel")}</label>
              <div className="grid grid-cols-4 gap-1.5 p-2 bg-[var(--control-bg)] rounded-lg border border-[var(--border)] max-h-32 overflow-y-auto">
                {ICON_OPTIONS.map(({ id, icon: IconComp }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setIcon(id)}
                    className={cn(
                      "p-1.5 rounded flex items-center justify-center transition-colors cursor-pointer",
                      icon === id
                        ? "bg-[var(--accent)] text-white"
                        : "text-[var(--text-secondary)] hover:bg-[var(--surface)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    <IconComp className="w-4 h-4" />
                  </button>
                ))}
              </div>
            </div>

            {/* Color */}
            <div>
              <label className="block text-sm font-medium mb-1.5">{t("colorLabel")}</label>
              <div className="grid grid-cols-4 gap-1.5 p-2 bg-[var(--control-bg)] rounded-lg border border-[var(--border)] max-h-32 overflow-y-auto">
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

          {/* Error */}
          {error && (
            <div className="text-sm text-red-500 bg-red-500/10 p-2.5 rounded-lg">{error}</div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              {t("createProject")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
