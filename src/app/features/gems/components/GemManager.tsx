"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import GemList from "./GemList";
import GemEditor from "./GemEditor";
import GemPreview, { Gem } from "./GemPreview";
import { useGemStore } from "../stores/useGemStore";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { cn } from "@/lib/utils/cn";
import { PageHeader } from "@/components/ui/page-header";
import Link from "next/link";
import { toast } from "@/lib/store/toastStore";
import { confirm } from "@/lib/store/confirmStore";

interface GemManagerProps {
  inModal?: boolean;
}

export default function GemManager({ inModal = false }: GemManagerProps) {
  const sp = useSearchParams();
  const _router = useRouter();
  const { t } = useLanguage();

  // Lấy ID từ store (do Sidebar truyền vào) hoặc từ URL (fallback)
  const { contextConversationId, closeGemModal, triggerGemApplied } = useGemStore();
  const urlConversationId = sp?.get("conversationId");
  const conversationId = contextConversationId || urlConversationId;

  const [gems, setGems] = useState<Gem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [selectedGemId, setSelectedGemId] = useState<string | null>(null);
  const [editingGem, setEditingGem] = useState<Gem | null>(null);
  const [previewGem, setPreviewGem] = useState<Gem | null>(null);
  const [status, setStatus] = useState("");
  const [isApplying, setIsApplying] = useState(false);

  const premade = useMemo(() => gems.filter((g) => g.isPremade), [gems]);
  const mine = useMemo(() => gems.filter((g) => !g.isPremade), [gems]);

  async function refresh() {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/gems", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data = json.data || json;
      setGems(Array.isArray(data?.gems) ? data.gems : []);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load gems";
      setFetchError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const applyGemToConversation = async (gemId: string | null) => {
    if (!conversationId) {
      setStatus(t("libraryOpenFromChat"));
      return;
    }
    if (isApplying) return;
    setIsApplying(true);

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
    } finally {
      setIsApplying(false);
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

  const onDelete = async (gem: Gem) => {
    const ok = await confirm({
      title: t("gemDeleteConfirm") || "Delete Gem?",
      description:
        t("gemDeleteWarning") ||
        `Are you sure you want to delete "${gem.name}"? This action cannot be undone.`,
      variant: "danger",
      confirmLabel: t("deleteGem") || "Delete",
      cancelLabel: t("cancel") || "Cancel",
    });
    if (!ok) return;

    setStatus(t("loading") || "Loading...");
    try {
      const res = await fetch("/api/gems", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: gem.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || json?.error || "Delete failed");
      toast.success(t("gemDeleted") || "Gem deleted successfully");
      setStatus("");
      if (editingGem?.id === gem.id) setEditingGem(null);
      await refresh();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Delete failed";
      toast.error(message);
      setStatus(message);
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

      toast.success(t("gemSaved") || "Gem saved successfully");
      setStatus(t("success") || "Success");
      const data = json.data || json;
      setEditingGem(data?.gem || null);
      await refresh();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Save failed";
      toast.error(message);
      setStatus(message);
    }
  };

  const headerTitle = t("gemsTitle") || "Gems Manager";
  const headerDescription = conversationId
    ? `${t("appliedGem") || "Applied Gem"}: ${conversationId.slice(0, 8)}...`
    : t("gemsPageDescription");
  const createButton = (
    <button
      type="button"
      onClick={onCreate}
      className="rounded-lg bg-(--accent) px-3 py-1.5 text-sm text-(--on-accent) font-medium hover:brightness-110 transition-colors active:scale-95"
    >
      + {t("createGem") || "New Gem"}
    </button>
  );
  const headerActions = inModal ? (
    createButton
  ) : (
    <>
      <Link
        href="/features/personas"
        className="rounded-lg border border-(--line) px-3 py-1.5 text-sm text-(--text) font-medium hover:bg-(--raised) transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
      >
        {t("managePersonas")}
      </Link>
      {createButton}
    </>
  );

  return (
    <div className="flex flex-col h-full bg-transparent text-(--text-primary) overflow-hidden">
      {inModal ? (
        <div className="flex-none py-4 pl-6 pr-14 border-b border-(--border) flex items-center justify-between bg-(--surface)/80 backdrop-blur-md sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-semibold">{headerTitle}</h2>
            <p className="text-xs text-(--text-secondary) truncate max-w-md">{headerDescription}</p>
          </div>
          {headerActions}
        </div>
      ) : (
        <PageHeader
          className="flex-none px-4 md:px-6 pt-4"
          title={headerTitle}
          description={headerDescription}
          actions={headerActions}
        />
      )}

      <div
        className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 scrollbar-thin scrollbar-thumb-[var(--border)]"
        style={{
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-y",
          overscrollBehavior: "contain",
        }}
      >
        {status && (
          <div className="mb-4 rounded-lg border border-(--border) bg-(--surface-muted) px-3 py-2 text-xs text-(--text-secondary)">
            {status}
          </div>
        )}

        <div
          className={cn(
            "grid gap-6 transition-colors duration-300",
            editingGem || previewGem ? "grid-cols-1 lg:grid-cols-[360px_1fr]" : "grid-cols-1"
          )}
        >
          <div className="min-w-0">
            {conversationId && selectedGemId && (
              <div className="mb-3 flex justify-end">
                <button
                  type="button"
                  onClick={clearGem}
                  className="rounded-lg border border-(--line) px-3 py-1.5 text-sm text-(--muted) transition-colors hover:bg-(--raised) hover:text-(--text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                >
                  {t("gemRemove")}
                </button>
              </div>
            )}

            {fetchError && (
              <div
                role="alert"
                className="mb-3 flex items-center gap-2 rounded-lg border border-(--danger)/30 bg-(--danger)/10 px-4 py-2 text-sm text-(--danger)"
              >
                <span className="flex-1">
                  {t("libraryLoadFailed")}: {fetchError}
                </span>
                <button
                  type="button"
                  onClick={refresh}
                  className="rounded-md border border-(--danger)/30 px-2 py-1 font-medium transition-colors hover:bg-(--danger)/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                >
                  {t("tryAgain")}
                </button>
              </div>
            )}

            {!conversationId && (
              <p className="mb-4 text-sm text-(--muted)">{t("libraryOpenFromChat")}</p>
            )}

            <GemList
              loading={loading}
              canApply={Boolean(conversationId)}
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

          {(editingGem || previewGem) && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-1">
              {editingGem ? (
                <div className="rounded-xl border border-(--border) bg-(--surface) p-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium">{t("editGem")}</h3>
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
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
