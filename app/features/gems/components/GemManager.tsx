"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import GemList from "./GemList";
import GemEditor from "./GemEditor";
import GemPreview, { Gem } from "./GemPreview";
import { useGemStore } from "../stores/useGemStore";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { cn } from "@/lib/utils/cn";
import { toast } from "@/lib/store/toastStore";

interface GemManagerProps {
  inModal?: boolean;
}

export default function GemManager({ inModal = false }: GemManagerProps) {
  const sp = useSearchParams();
  const _router = useRouter();
  const { t, language } = useLanguage();

  // Lấy ID từ store (do Sidebar truyền vào) hoặc từ URL (fallback)
  const { contextConversationId, closeGemModal, triggerGemApplied } = useGemStore();
  const urlConversationId = sp?.get("conversationId");
  const conversationId = contextConversationId || urlConversationId;

  const [gems, setGems] = useState<Gem[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedGemId, setSelectedGemId] = useState<string | null>(null);
  const [editingGem, setEditingGem] = useState<Gem | null>(null);
  const [previewGem, setPreviewGem] = useState<Gem | null>(null);
  const [status, setStatus] = useState("");

  const premade = useMemo(() => gems.filter((g) => g.isPremade), [gems]);
  const mine = useMemo(() => gems.filter((g) => !g.isPremade), [gems]);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/gems", { cache: "no-store" });
      const json = await res.json();
      const data = json.data || json;
      setGems(Array.isArray(data?.gems) ? data.gems : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const applyGemToConversation = async (gemId: string | null) => {
    if (!conversationId) {
      setStatus(`${t("error") || "Error"}: No conversation ID`);
      return;
    }

    setStatus(t("loading") || "Loading...");
    try {
      const res = await fetch("/api/conversations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: conversationId, gemId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || json?.error || "Apply gem failed");

      setSelectedGemId(gemId);
      setStatus(t("success") || "Success");

      // Find the gem data to pass for optimistic update
      const selectedGem = gemId ? gems.find((g) => g.id === gemId) : null;
      const gemInfo = selectedGem
        ? {
            name: selectedGem.name,
            icon: selectedGem.icon || null,
            color: selectedGem.color || null,
          }
        : null;

      // Trigger optimistic update in ChatApp with gem data
      triggerGemApplied(conversationId, gemInfo);

      setTimeout(() => {
        closeGemModal();
      }, 300);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Apply gem failed";
      setStatus(message);
    }
  };

  const clearGem = async () => applyGemToConversation(null);

  const onCreate = () => {
    setPreviewGem(null);
    setEditingGem({
      id: "", // new gem has temporary empty id
      name: "",
      description: "",
      instructions: "",
      icon: "",
      color: "",
      isPremade: false,
    } as Gem);
  };

  const onEdit = (gem: Gem) => setEditingGem(gem);

  const [pendingDeleteGem, setPendingDeleteGem] = useState<Gem | null>(null);

  const onDelete = async (gem: Gem) => {
    setPendingDeleteGem(gem);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteGem) return;

    setStatus(t("loading") || "Loading...");
    try {
      const res = await fetch("/api/gems", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pendingDeleteGem.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || json?.error || "Delete failed");
      toast.success(t("gemDeleted") || "Gem deleted successfully");
      setStatus("");
      if (editingGem?.id === pendingDeleteGem.id) setEditingGem(null);
      await refresh();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Delete failed";
      toast.error(message);
      setStatus(message);
    } finally {
      setPendingDeleteGem(null);
    }
  };

  const onSave = async (payload: Partial<Gem>) => {
    setStatus(t("loading") || "Loading...");
    try {
      const isNew = !payload.id;
      const res = await fetch("/api/gems", {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || json?.error || "Save failed");

      setStatus(t("success") || "Success");
      const data = json.data || json;
      setEditingGem(data?.gem || null);
      await refresh();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Save failed";
      setStatus(message);
    }
  };

  return (
    <div className="flex flex-col h-full bg-transparent text-(--text-primary) overflow-hidden">
      <div
        className={cn(
          "flex-none py-4 border-b border-(--border) flex items-center justify-between bg-(--surface)/80 backdrop-blur-md sticky top-0 z-10",
          inModal ? "pl-6 pr-14" : "px-6"
        )}
      >
        <div>
          <h1 className="text-xl font-semibold">{t("gemsTitle") || "Gems Manager"}</h1>
          <p className="text-xs text-(--text-secondary) truncate max-w-md">
            {conversationId
              ? `${t("appliedGem") || "Applied Gem"}: ${conversationId.slice(0, 8)}...`
              : "Global Mode"}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCreate}
            className="rounded-lg bg-(--primary) px-3 py-1.5 text-sm text-black font-medium hover:brightness-110 transition-all active:scale-95"
          >
            + {t("createGem") || "New Gem"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin scrollbar-thumb-[var(--border)]">
        {status && (
          <div className="mb-4 rounded-lg border border-(--border) bg-(--surface-muted) px-3 py-2 text-xs text-(--text-secondary)">
            {status}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
          <div className="rounded-xl border border-(--border) bg-(--surface-muted)/50 p-3 h-fit">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-medium">{t("myGems") || "My Gems"}</div>
              <button
                onClick={clearGem}
                className="rounded-md border border-(--control-border) px-2 py-1 text-[10px] text-(--text-secondary) hover:bg-(--control-bg-hover) transition-colors"
              >
                Reset Default
              </button>
            </div>

            <GemList
              loading={loading}
              premade={premade}
              mine={mine}
              selectedGemId={selectedGemId}
              onSelect={(gem) => applyGemToConversation(gem.id)}
              onPreview={(gem) => {
                setEditingGem(null);
                setPreviewGem(gem);
              }}
              onEdit={(gem) => {
                setPreviewGem(null);
                onEdit(gem);
              }}
              onDelete={onDelete}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-1">
            {editingGem ? (
              <div className="rounded-xl border border-(--border) bg-(--surface) p-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-medium">Editor</h3>
                  <button
                    onClick={() => setEditingGem(null)}
                    className="text-xs text-(--text-secondary) hover:text-(--text-primary)"
                  >
                    {t("cancel") || "Cancel"}
                  </button>
                </div>
                <GemEditor gem={editingGem} onSave={onSave} />
              </div>
            ) : previewGem ? (
              <div className="rounded-xl border border-(--border) bg-(--surface-muted)/50 h-full">
                <GemPreview gem={previewGem} />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-(--border) bg-(--surface-muted)/20 p-8 flex flex-col items-center justify-center text-center text-(--text-secondary) min-h-[300px]">
                <p className="text-sm">
                  {language === "vi"
                    ? 'Chọn "Tạo Gem mới" để bắt đầu hoặc chọn Gem từ danh sách.'
                    : 'Select "Create New Gem" to start or pick a Gem from the list.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {pendingDeleteGem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-(--surface) border border-(--border) rounded-xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold text-(--text-primary) mb-2">
              {t("gemDeleteConfirm") || "Delete Gem?"}
            </h3>
            <p className="text-sm text-(--text-secondary) mb-6">
              {t("gemDeleteWarning") ||
                `Are you sure you want to delete "${pendingDeleteGem.name}"? This action cannot be undone.`}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setPendingDeleteGem(null)}
                className="px-4 py-2 text-sm text-(--text-secondary) hover:text-(--text-primary) transition-colors"
              >
                {t("cancel") || "Cancel"}
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 border border-red-500/30 transition-all"
              >
                {t("deleteGem") || "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
