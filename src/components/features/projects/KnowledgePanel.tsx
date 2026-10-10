"use client";

import React, { useState, useCallback } from "react";
import {
  FileText,
  Upload,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Loader2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { KnowledgeDocument } from "@/types/projects";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";
import { confirm } from "@/lib/store/confirmStore";
import { toast } from "@/lib/store/toastStore";
import { logger } from "@/lib/utils/logger";

interface KnowledgePanelProps {
  projectId: string;
  documents: KnowledgeDocument[];
  storageUsedBytes: number;
  storageMaxBytes: number;
  isLoading?: boolean;
  onUpload: (file: File, payload: FormData | string) => Promise<{ truncated?: boolean } | void>;
  onDelete: (documentId: string) => Promise<void>;
  onRefresh: () => void;
  className?: string;
}

/**
 * Knowledge Base Panel
 * Shows documents in a project and allows upload/delete
 */
export function KnowledgePanel({
  projectId: _projectId,
  documents,
  storageUsedBytes,
  storageMaxBytes,
  isLoading,
  onUpload,
  onDelete,
  onRefresh,
  className,
}: KnowledgePanelProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLanguage();

  const storagePercent = Math.round((storageUsedBytes / storageMaxBytes) * 100);
  const storageUsedMB = (storageUsedBytes / (1024 * 1024)).toFixed(2);
  const storageMaxMB = (storageMaxBytes / (1024 * 1024)).toFixed(0);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > 4 * 1024 * 1024) {
        toast.error(t("fileSizeExceedsLimit") || "Dung lượng file vượt quá giới hạn 4MB");
        e.target.value = "";
        return;
      }

      setError(null);
      setIsUploading(true);

      try {
        const formData = new FormData();
        formData.append("file", file);
        const result = await onUpload(file, formData);
        if (result && result.truncated) {
          toast.info(
            t("documentTruncatedNotice") ||
              "Tài liệu dài đã được tự động cắt ngắn để phù hợp với giới hạn bộ nhớ."
          );
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Upload failed";
        logger.error("[KnowledgePanel] upload failed:", message);
        toast.error(t("kbUploadFailed") || message);
        setError(message);
      } finally {
        setIsUploading(false);
        // Reset input
        e.target.value = "";
      }
    },
    [onUpload, t]
  );

  const handleDelete = async (documentId: string) => {
    const ok = await confirm({
      title: t("kbDeleteConfirm"),
      description: t("kbDeleteConfirmDesc"),
      variant: "danger",
      confirmLabel: t("modalDeleteButton"),
      cancelLabel: t("cancel"),
    });
    if (!ok) return;

    setDeletingId(documentId);
    try {
      await onDelete(documentId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Delete failed";
      logger.error("[KnowledgePanel] delete failed:", message);
      toast.error(t("deleteFailed") || message);
      setError(message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-(--border)">
        <h3 className="font-semibold">{t("knowledgeBase")}</h3>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="p-1.5 hover:bg-(--control-bg) rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none cursor-pointer"
          title={t("refresh")}
          aria-label={t("refresh")}
        >
          <RefreshCw
            className={cn("h-4 w-4 text-(--text-secondary)", isLoading && "animate-spin")}
          />
        </button>
      </div>

      {/* Storage Bar */}
      <div className="px-4 py-3 border-b border-(--border)">
        <div className="flex items-center justify-between text-xs text-(--text-secondary) mb-1.5">
          <span>{t("kbStorage")}</span>
          <span>
            {storageUsedMB} / {storageMaxMB} MB
          </span>
        </div>
        <div className="h-1.5 bg-(--control-bg) rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-colors",
              storagePercent > 90 ? "bg-(--danger)" : "bg-(--accent)"
            )}
            style={{ width: `${Math.min(storagePercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Upload Button */}
      <div className="px-4 py-3 border-b border-(--border)">
        <label
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.currentTarget.querySelector("input")?.click();
            }
          }}
          className={cn(
            "flex items-center justify-center gap-2 px-4 py-2",
            "border-2 border-dashed border-(--border) rounded-lg",
            "hover:border-(--accent) hover:bg-(--accent)/5 transition-colors",
            "cursor-pointer focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
            isUploading && "opacity-50 cursor-not-allowed"
          )}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin text-(--accent)" />
          ) : (
            <Upload className="h-4 w-4 text-(--accent)" />
          )}
          <span className="text-sm font-medium">
            {isUploading ? t("kbUploading") : t("kbUploadDocument")}
          </span>
          <input
            type="file"
            className="hidden"
            accept=".txt,.md,.pdf,.docx,.ini,.ts,.tsx,.js,.jsx,.py,.java,.go,.rs,.json,.yaml,.yml,.toml,.sql,.css,.html"
            onChange={handleFileSelect}
            disabled={isUploading}
          />
        </label>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-3 p-3 rounded-lg bg-(--danger)/10 border border-(--danger)/20 text-sm text-(--danger) flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label={t("close")}
            className="rounded p-0.5 hover:bg-(--danger)/20 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Document List */}
      <div className="flex-1 overflow-auto px-4 py-3 space-y-2">
        {documents.length === 0 ? (
          <div className="text-center py-8 text-sm text-(--text-secondary)">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>{t("kbNoDocuments")}</p>
            <p className="text-xs">{t("kbUploadHint")}</p>
          </div>
        ) : (
          documents.map((doc) => (
            <DocumentItem
              key={doc.id}
              document={doc}
              isDeleting={deletingId === doc.id}
              onDelete={() => handleDelete(doc.id)}
              chunksLabel={t("kbChunks")}
              deleteLabel={t("kbDeleteDocument")}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface DocumentItemProps {
  document: KnowledgeDocument;
  isDeleting: boolean;
  onDelete: () => void;
  chunksLabel: string;
  deleteLabel: string;
}

function DocumentItem({
  document,
  isDeleting,
  onDelete,
  chunksLabel,
  deleteLabel,
}: DocumentItemProps) {
  const sizeKB = (document.size_bytes / 1024).toFixed(1);

  const getStatusIcon = () => {
    switch (document.status) {
      case "ready":
        return <CheckCircle className="h-3.5 w-3.5 text-(--success)" />;
      case "processing":
        return <Loader2 className="h-3.5 w-3.5 text-(--accent) animate-spin" />;
      case "error":
        return <AlertCircle className="h-3.5 w-3.5 text-(--danger)" />;
      default:
        return null;
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-2.5 rounded-lg",
        "bg-(--control-bg)/30 hover:bg-(--control-bg)/50 transition-colors group"
      )}
    >
      <FileText className="h-4 w-4 text-(--text-secondary) shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{document.filename}</span>
          {getStatusIcon()}
        </div>
        <div className="text-xs text-(--text-secondary)">
          {sizeKB} KB • {document.total_chunks} {chunksLabel}
          {document.status === "error" && document.error_message && (
            <span className="text-(--danger)"> • {document.error_message}</span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onDelete}
        disabled={isDeleting}
        className={cn(
          "p-1.5 rounded-lg opacity-0 group-hover:opacity-100",
          "hover:bg-(--danger)/10 text-(--danger) transition-colors cursor-pointer",
          "focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
          isDeleting && "opacity-100"
        )}
        title={deleteLabel}
        aria-label={deleteLabel}
      >
        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      </button>
    </div>
  );
}
