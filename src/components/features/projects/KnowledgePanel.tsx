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
import { useLanguageStore } from "@/lib/store/languageStore";
import { translations } from "@/lib/utils/config";

interface KnowledgePanelProps {
  projectId: string;
  documents: KnowledgeDocument[];
  storageUsedBytes: number;
  storageMaxBytes: number;
  isLoading?: boolean;
  onUpload: (file: File, content: string) => Promise<void>;
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
  const language = useLanguageStore((state) => state.language);
  const t = translations[language];

  const storagePercent = Math.round((storageUsedBytes / storageMaxBytes) * 100);
  const storageUsedMB = (storageUsedBytes / (1024 * 1024)).toFixed(2);
  const storageMaxMB = (storageMaxBytes / (1024 * 1024)).toFixed(0);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setError(null);
      setIsUploading(true);

      try {
        // Read file content
        const content = await file.text();
        await onUpload(file, content);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setIsUploading(false);
        // Reset input
        e.target.value = "";
      }
    },
    [onUpload]
  );

  const handleDelete = async (documentId: string) => {
    setDeletingId(documentId);
    try {
      await onDelete(documentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="font-semibold">{t.knowledgeBase}</h3>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-1.5 hover:bg-muted rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw className={cn("h-4 w-4 text-muted-foreground", isLoading && "animate-spin")} />
        </button>
      </div>

      {/* Storage Bar */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
          <span>{t.kbStorage}</span>
          <span>
            {storageUsedMB} / {storageMaxMB} MB
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              storagePercent > 90 ? "bg-destructive" : "bg-primary"
            )}
            style={{ width: `${Math.min(storagePercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Upload Button */}
      <div className="px-4 py-3 border-b border-border">
        <label
          className={cn(
            "flex items-center justify-center gap-2 px-4 py-2",
            "border-2 border-dashed border-border rounded-lg",
            "hover:border-primary hover:bg-primary/5 transition-colors",
            "cursor-pointer",
            isUploading && "opacity-50 cursor-not-allowed"
          )}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          <span className="text-sm font-medium">
            {isUploading ? t.kbUploading : t.kbUploadDocument}
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
        <div className="mx-4 mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Document List */}
      <div className="flex-1 overflow-auto px-4 py-3 space-y-2">
        {documents.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>{t.kbNoDocuments}</p>
            <p className="text-xs">{t.kbUploadHint}</p>
          </div>
        ) : (
          documents.map((doc) => (
            <DocumentItem
              key={doc.id}
              document={doc}
              isDeleting={deletingId === doc.id}
              onDelete={() => handleDelete(doc.id)}
              chunksLabel={t.kbChunks}
              deleteLabel={t.kbDeleteDocument}
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
        return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
      case "processing":
        return <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />;
      case "error":
        return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
      default:
        return null;
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-2.5 rounded-lg",
        "bg-muted/30 hover:bg-muted/50 transition-colors group"
      )}
    >
      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{document.filename}</span>
          {getStatusIcon()}
        </div>
        <div className="text-xs text-muted-foreground">
          {sizeKB} KB • {document.total_chunks} {chunksLabel}
          {document.status === "error" && document.error_message && (
            <span className="text-destructive"> • {document.error_message}</span>
          )}
        </div>
      </div>
      <button
        onClick={onDelete}
        disabled={isDeleting}
        className={cn(
          "p-1.5 rounded-lg opacity-0 group-hover:opacity-100",
          "hover:bg-destructive/10 text-destructive transition-all",
          isDeleting && "opacity-100"
        )}
        title={deleteLabel}
      >
        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      </button>
    </div>
  );
}
