"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import GemList from "./GemList";
import GemEditor from "./GemEditor";
import GemPreview from "./GemPreview";
import { useGemStore } from "../stores/useGemStore";
import { useLanguage } from "../../chat/hooks/useLanguage";

export default function GemManager() {
  const sp = useSearchParams();
  const _router = useRouter();
  const { t, language } = useLanguage();

  // Lấy ID từ store (do Sidebar truyền vào) hoặc từ URL (fallback)
  const { contextConversationId, closeGemModal } = useGemStore();
  const urlConversationId = sp.get("conversationId");
  const conversationId = contextConversationId || urlConversationId;

  const [gems, setGems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedGemId, setSelectedGemId] = useState(null);
  const [editingGem, setEditingGem] = useState(null);
  const [previewGem, setPreviewGem] = useState(null);
  const [status, setStatus] = useState("");

  const premade = useMemo(() => gems.filter((g) => g.isPremade), [gems]);
  const mine = useMemo(() => gems.filter((g) => !g.isPremade), [gems]);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/gems", { cache: "no-store" });
      const data = await res.json();
      setGems(Array.isArray(data?.gems) ? data.gems : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const applyGemToConversation = async (gemId) => {
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
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Apply gem failed");

      setSelectedGemId(gemId);
      setStatus(t("success") || "Success");

      setTimeout(() => {
        closeGemModal();
      }, 500);
    } catch (e) {
      setStatus(e?.message || "Apply gem failed");
    }
  };

  const clearGem = async () => applyGemToConversation(null);

  const onCreate = () => {
    setPreviewGem(null);
    setEditingGem({
      id: null,
      name: "",
      description: "",
      instructions: "",
      icon: "",
      color: "",
      isPremade: false,
    });
  };

  const onEdit = (gem) => setEditingGem(gem);

  const onDelete = async (gem) => {
    const confirmMsg = t("gemDeleteConfirm") || "Are you sure you want to delete this Gem?";
    if (!confirm(`${confirmMsg} "${gem.name}"?`)) return;

    setStatus(t("loading") || "Loading...");
    try {
      const res = await fetch("/api/gems", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: gem.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Delete failed");
      setStatus(t("success") || "Success");
      if (editingGem?.id === gem.id) setEditingGem(null);
      await refresh();
    } catch (e) {
      setStatus(e?.message || "Delete failed");
    }
  };

  const onSave = async (payload) => {
    setStatus(t("loading") || "Loading...");
    try {
      const isNew = !payload.id;
      const res = await fetch("/api/gems", {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Save failed");

      setStatus(t("success") || "Success");
      setEditingGem(data?.gem || null);
      await refresh();
    } catch (e) {
      setStatus(e?.message || "Save failed");
    }
  };

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-neutral-100 overflow-hidden">
      <div className="flex-none px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950 sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-semibold">{t("gemsTitle") || "Gems Manager"}</h1>
          <p className="text-xs text-neutral-400 truncate max-w-md">
            {conversationId
              ? `${t("appliedGem") || "Applied Gem"}: ${conversationId.slice(0, 8)}...`
              : "Global Mode"}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCreate}
            className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-sm text-black font-medium hover:brightness-110 transition-all active:scale-95"
          >
            + {t("createGem") || "New Gem"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin scrollbar-thumb-neutral-800">
        {status && (
          <div className="mb-4 rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2 text-xs text-neutral-200">
            {status}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-3 h-fit">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-medium">{t("myGems") || "My Gems"}</div>
              <button
                onClick={clearGem}
                className="rounded-md border border-neutral-700 px-2 py-1 text-[10px] text-neutral-300 hover:bg-neutral-800 transition-colors"
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
              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-medium">Editor</h3>
                  <button
                    onClick={() => setEditingGem(null)}
                    className="text-xs text-neutral-500 hover:text-white"
                  >
                    {t("cancel") || "Cancel"}
                  </button>
                </div>
                <GemEditor gem={editingGem} onSave={onSave} />
              </div>
            ) : previewGem ? (
              <div className="rounded-xl border border-neutral-800 bg-neutral-950/50 h-full">
                <GemPreview gem={previewGem} />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/20 p-8 flex flex-col items-center justify-center text-center text-neutral-500 min-h-[300px]">
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
    </div>
  );
}
