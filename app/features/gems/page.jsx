"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import GemList from "./components/GemList";
import GemEditor from "./components/GemEditor";

function GemsPageInner() {
  const sp = useSearchParams();
  const router = useRouter();

  const conversationId = sp.get("conversationId");

  const [gems, setGems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedGemId, setSelectedGemId] = useState(null); // applied to conversation
  const [editingGem, setEditingGem] = useState(null); // gem object
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
      setStatus(
        "Thiếu conversationId. Hãy mở /gems từ Sidebar để áp vào chat hiện tại."
      );
      return;
    }

    setStatus("Đang áp Gem vào cuộc trò chuyện hiện tại...");
    try {
      const res = await fetch("/api/conversations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: conversationId, gemId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Apply gem failed");

      setSelectedGemId(gemId);
      setStatus("Đã áp Gem cho cuộc trò chuyện hiện tại. Quay lại chat để sử dụng.");
    } catch (e) {
      setStatus(e?.message || "Apply gem failed");
    }
  };

  const clearGem = async () => applyGemToConversation(null);

  const onCreate = () => {
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
    if (!confirm(`Xoá Gem "${gem.name}"? (soft delete)`)) return;

    setStatus("Đang xoá...");
    try {
      const res = await fetch("/api/gems", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: gem.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Delete failed");
      setStatus("Đã xoá.");
      if (editingGem?.id === gem.id) setEditingGem(null);
      await refresh();
    } catch (e) {
      setStatus(e?.message || "Delete failed");
    }
  };

  const onSave = async (payload) => {
    setStatus("Đang lưu...");
    try {
      const isNew = !payload.id;

      const res = await fetch("/api/gems", {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Save failed");

      setStatus("Đã lưu.");
      setEditingGem(data?.gem || null);
      await refresh();
    } catch (e) {
      setStatus(e?.message || "Save failed");
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-6xl px-4 py-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Gem manager</h1>
            <p className="text-xs text-neutral-400">
              {conversationId
                ? `Áp Gem vào conversation hiện tại: ${conversationId}`
                : "Mở trang này từ Sidebar để tự động có conversationId."}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => router.back()}
              className="rounded-lg border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-900"
            >
              Back
            </button>

            <button
              onClick={onCreate}
              className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm text-black"
            >
              + New Gem
            </button>
          </div>
        </div>

        {status ? (
          <div className="mb-4 rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2 text-xs text-neutral-200">
            {status}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-medium">Explore Gems</div>
              <button
                onClick={clearGem}
                className="rounded-md border border-neutral-700 px-2 py-1 text-[11px] text-neutral-300 hover:bg-neutral-900"
              >
                Clear gem on this chat
              </button>
            </div>

            <GemList
              loading={loading}
              premade={premade}
              mine={mine}
              selectedGemId={selectedGemId}
              onSelect={(gem) => applyGemToConversation(gem.id)}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
              <GemEditor gem={editingGem} onSave={onSave} />
            </div>

            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-medium">Preview</div>
                <span className="text-[11px] text-neutral-500">Placeholder</span>
              </div>

              <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3 text-sm text-neutral-200">
                Preview panel hiện là UI placeholder theo yêu cầu. Route{" "}
                <span className="text-neutral-300">/api/gems/preview</span> đã có
                sẵn để nâng cấp lên gọi Gemini sau này.
              </div>

              <div className="mt-3 rounded-lg border border-neutral-800 bg-neutral-950 p-3">
                <div className="mb-2 text-xs text-neutral-400">Ask (preview)</div>
                <input
                  disabled
                  placeholder="Coming soon..."
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-300 outline-none"
                />
                <button
                  disabled
                  className="mt-2 w-full rounded-lg bg-neutral-800 px-3 py-2 text-sm text-neutral-400"
                >
                  Run preview
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 text-xs text-neutral-500">
          Lưu ý: Save Gem sẽ tạo version mới (gem_versions). Premade gems là read-only.
        </div>
      </div>
    </div>
  );
}

export default function GemsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-950 text-neutral-100">
          <div className="mx-auto max-w-6xl px-4 py-5">
            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-300">
              Loading…
            </div>
          </div>
        </div>
      }
    >
      <GemsPageInner />
    </Suspense>
  );
}
