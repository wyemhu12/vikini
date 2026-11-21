"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Gem, Plus, Edit2, Trash2, AlertCircle, X, RotateCcw } from "lucide-react";
import GemEditor from "@/app/features/gems/components/GemEditor";
import { DynamicIcon } from "@/components/ui/DynamicIcon";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";
import { toast } from "@/lib/store/toastStore";
import { confirm } from "@/lib/store/confirmStore";
import { logger } from "@/lib/utils/logger";

interface PremadeGem {
  id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  icon: string | null;
  color: string | null;
  is_premade: boolean;
}

// No props needed - language comes from useLanguage() hook

export default function GemsManager() {
  const [gems, setGems] = useState<PremadeGem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Editor State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingGem, setEditingGem] = useState<PremadeGem | null>(null);

  const { t } = useLanguage();
  const tRef = useRef(t);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const fetchGems = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/admin/gems");
      if (!res.ok) throw new Error(tRef.current("adminGemsLoadFailed"));
      const json = await res.json();
      const data = json.data || json;
      setGems(data.gems || []);
    } catch (err: unknown) {
      logger.error("[GemsManager] Failed to load gems:", err);
      setError(err instanceof Error ? err.message : tRef.current("adminGemsLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchGems();
  }, [fetchGems]);

  const deleteGem = async (gemId: string) => {
    const ok = await confirm({
      title: t("confirmDeleteGem") || "Delete Gem?",
      description: t("deleteGemWarning") || "This action cannot be undone.",
      variant: "danger",
      confirmLabel: t("deleteGem") || "Delete",
      cancelLabel: t("cancel") || "Cancel",
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/admin/gems?id=${gemId}`, {
        method: "DELETE",
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(json?.error?.message || json?.error || "Failed to delete gem");

      toast.success(t("gemDeleted") || "Gem deleted successfully");
      await fetchGems();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("failedDeleteGem") || "Failed to delete gem"
      );
    }
  };

  const handleSaveGem = async (gemData: Partial<PremadeGem>) => {
    try {
      const method = gemData.id ? "PUT" : "POST";
      const res = await fetch("/api/admin/gems", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gemData),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error?.message || json.error || "Failed to save gem");
      }

      toast.success(t("gemSaved") || "Gem saved successfully");
      await fetchGems();
      setIsEditorOpen(false);
      setEditingGem(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedSaveGem") || "Failed to save gem");
    }
  };

  const openAddModal = () => {
    setEditingGem(null);
    setIsEditorOpen(true);
  };

  const openEditModal = (gem: PremadeGem) => {
    setEditingGem(gem);
    setIsEditorOpen(true);
  };

  if (loading) {
    return (
      <div role="status" className="space-y-4 py-2">
        <span className="sr-only">{t("loadingGems")}</span>
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, idx) => (
            <Skeleton key={idx} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-(--danger)/10 border border-(--danger)/30 text-(--danger)"
      >
        <div className="flex items-center gap-2">
          <AlertCircle aria-hidden="true" className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
        <button
          type="button"
          onClick={() => void fetchGems()}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-(--raised) hover:bg-(--raised-hover) text-(--text) border border-(--line) transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
        >
          <RotateCcw aria-hidden="true" className="w-4 h-4" />
          {t("tryAgain")}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Gem aria-hidden="true" className="w-5 h-5 text-(--accent)" />
          <h2 className="text-xl font-semibold text-(--text)">{t("globalGemsManagement")}</h2>
          <span className="text-sm text-(--faint)">
            ({gems.length} {t("gems")})
          </span>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2 min-h-10 bg-(--soft) text-(--accent) rounded-lg hover:bg-(--accent)/20 border border-(--accent)/30 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
        >
          <Plus aria-hidden="true" className="w-4 h-4" />
          {t("addGem")}
        </button>
      </div>

      {gems.length === 0 ? (
        <div className="text-center py-12 text-(--muted)">
          <Gem aria-hidden="true" className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{t("noGlobalGems")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {gems.map((gem) => (
            <div
              key={gem.id}
              className="p-4 rounded-lg bg-(--raised) border border-(--line) hover:border-(--line-strong) transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  {gem.icon && (
                    <span className="text-2xl shrink-0 flex items-center justify-center w-7 h-7 text-(--text)">
                      <DynamicIcon name={gem.icon} className="w-5 h-5" />
                    </span>
                  )}
                  <h3 className="font-semibold text-(--text) truncate">{gem.name}</h3>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditModal(gem)}
                    aria-label={`${t("edit")} ${gem.name}`}
                    className="inline-flex h-9 w-9 md:h-8 md:w-8 items-center justify-center rounded hover:bg-(--raised-hover) text-(--muted) hover:text-(--text) transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                    title={t("edit")}
                  >
                    <Edit2 aria-hidden="true" className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteGem(gem.id)}
                    aria-label={`${t("deleteGem")} ${gem.name}`}
                    className="inline-flex h-9 w-9 md:h-8 md:w-8 items-center justify-center rounded hover:bg-(--danger)/20 text-(--muted) hover:text-(--danger) transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                    title={t("deleteGem")}
                  >
                    <Trash2 aria-hidden="true" className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {gem.description && (
                <p className="text-sm text-(--muted) line-clamp-2">{gem.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      <Dialog.Root open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-(--z-modal) bg-(--overlay) backdrop-blur-sm" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed inset-0 z-(--z-modal) flex items-center justify-center p-4 pointer-events-none"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 0 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-(--surface) text-(--text) border border-(--line) rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl relative my-auto pointer-events-auto"
            >
              <div className="flex-none flex items-center justify-between p-4 border-b border-(--line) bg-(--surface) rounded-t-xl z-20">
                <Dialog.Title className="text-lg font-semibold">
                  {editingGem ? t("editGlobalGem") : t("createGlobalGem")}
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    aria-label={t("close")}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-(--raised-hover) transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                  >
                    <X aria-hidden="true" className="w-5 h-5 text-(--muted)" />
                  </button>
                </Dialog.Close>
              </div>

              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar min-h-0">
                <GemEditor
                  gem={
                    editingGem
                      ? {
                          ...editingGem,
                          id: editingGem.id,
                          name: editingGem.name,
                          description: editingGem.description || undefined,
                          instructions: editingGem.instructions || undefined,
                          icon: editingGem.icon || undefined,
                          color: editingGem.color || undefined,
                          isPremade: false, // Admin can edit
                        }
                      : null
                  }
                  onSave={handleSaveGem}
                />
              </div>
            </motion.div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
