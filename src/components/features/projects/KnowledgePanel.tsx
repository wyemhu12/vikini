"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
import { Skeleton } from "@/components/ui/skeleton";
import type { KnowledgeDocument } from "@/types/projects";
import { useLanguage } from "@/app/features/chat/hooks/useLanguage";
import { confirm } from "@/lib/store/confirmStore";
import { toast } from "@/lib/store/toastStore";
import { logger } from "@/lib/utils/logger";
import { TRANSITION, reducedMotionTransition } from "@/lib/utils/motion";
import {
  KNOWLEDGE_ACCEPT,
  validateKnowledgeFile,
  type KnowledgeUploadCallbacks,
} from "@/lib/features/projects/knowledgeUploadHelpers";
import { UPLOAD_ABORTED_SENTINEL } from "@/lib/features/files/fileUploadHelpers";

type KnowledgeDocumentWithLegacyChunks = KnowledgeDocument & { chunk_count?: number };

export function resolveDocumentChunkCount(doc: KnowledgeDocumentWithLegacyChunks): number {
  return doc.total_chunks ?? doc.chunk_count ?? 0;
}

interface PendingKnowledgeUpload {
  id: string;
  filename: string;
  sizeBytes: number;
  progress: number;
  status: "uploading" | "processing";
}

export interface KnowledgePanelProps {
  projectId: string;
  documents: KnowledgeDocument[];
  storageUsedBytes: number;
  storageMaxBytes: number;
  isLoading?: boolean;
  onUpload: (
    file: File,
    payload: FormData | string,
    callbacks?: KnowledgeUploadCallbacks
  ) => Promise<{ truncated?: boolean; document?: KnowledgeDocument } | void>;
  onDelete: (documentId: string) => Promise<void>;
  onRefresh: () => void;
  className?: string;
}

/**
 * Knowledge Base Panel
 * Shows documents in a project and allows multi-file drag-and-drop upload with staged progress.
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
  const safeDocuments = Array.isArray(documents) ? documents : [];
  const shouldReduce = useReducedMotion();
  const [pendingUploads, setPendingUploads] = useState<PendingKnowledgeUpload[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragDepthRef = useRef(0);
  const mountedRef = useRef(true);
  const activeUploadControllersRef = useRef<Map<string, AbortController>>(new Map());
  const { t } = useLanguage();

  useEffect(() => {
    mountedRef.current = true;
    const controllers = activeUploadControllersRef.current;
    return () => {
      mountedRef.current = false;
      for (const ac of controllers.values()) {
        ac.abort();
      }
      controllers.clear();
    };
  }, []);

  const isUploading = pendingUploads.length > 0;
  const storagePercent =
    storageMaxBytes > 0 ? Math.min(100, Math.round((storageUsedBytes / storageMaxBytes) * 100)) : 0;
  const storageUsedMB = (storageUsedBytes / (1024 * 1024)).toFixed(2);
  const storageMaxMB = (Math.max(0, storageMaxBytes) / (1024 * 1024)).toFixed(0);

  const uploadBatch = useCallback(
    async (selectedFiles: File[]) => {
      if (selectedFiles.length === 0) return;

      const validFiles: File[] = [];
      for (const file of selectedFiles) {
        const validationErr = validateKnowledgeFile(file);
        if (validationErr === "TOO_LARGE") {
          toast.error(t("fileSizeExceedsLimit"));
          continue;
        }
        if (validationErr === "UNSUPPORTED_TYPE") {
          toast.error(t("kbUnsupportedFileType"));
          continue;
        }
        validFiles.push(file);
      }
      if (validFiles.length === 0) return;

      setError(null);
      const batch = validFiles.map((file) => ({
        file,
        id:
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `kb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      }));

      setPendingUploads((prev) => [
        ...batch.map((item) => ({
          id: item.id,
          filename: item.file.name,
          sizeBytes: item.file.size,
          progress: 0,
          status: "uploading" as const,
        })),
        ...prev,
      ]);

      for (const item of batch) {
        if (!mountedRef.current) break;
        const ac = new AbortController();
        activeUploadControllersRef.current.set(item.id, ac);

        try {
          const formData = new FormData();
          formData.append("file", item.file);
          const result = await onUpload(item.file, formData, {
            signal: ac.signal,
            onProgress: (pct) => {
              if (!mountedRef.current) return;
              setPendingUploads((prev) =>
                prev.map((p) => (p.id === item.id ? { ...p, progress: pct } : p))
              );
            },
            onProcessing: () => {
              if (!mountedRef.current) return;
              setPendingUploads((prev) =>
                prev.map((p) =>
                  p.id === item.id ? { ...p, progress: 100, status: "processing" } : p
                )
              );
            },
          });

          if (mountedRef.current && result && result.truncated) {
            toast.info(t("documentTruncatedNotice"));
          }
        } catch (err: unknown) {
          if (err instanceof Error && err.message === UPLOAD_ABORTED_SENTINEL) {
            continue;
          }
          if (!mountedRef.current) break;
          const message = err instanceof Error ? err.message : t("kbUploadFailed");
          logger.error("[KnowledgePanel] upload failed:", message);
          toast.error(t("kbUploadFailed"));
          setError(message);
        } finally {
          activeUploadControllersRef.current.delete(item.id);
          if (mountedRef.current) {
            setPendingUploads((prev) => prev.filter((p) => p.id !== item.id));
          }
        }
      }
    },
    [onUpload, t]
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      e.target.value = "";
      await uploadBatch(files);
    },
    [uploadBatch]
  );

  const handleDragEnter = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    void uploadBatch(files);
  };

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
      const message = err instanceof Error ? err.message : t("deleteFailed");
      logger.error("[KnowledgePanel] delete failed:", message);
      toast.error(t("deleteFailed"));
      setError(message);
    } finally {
      if (mountedRef.current) {
        setDeletingId(null);
      }
    }
  };

  const showSkeleton = isLoading && safeDocuments.length === 0 && pendingUploads.length === 0;
  const showEmpty = !isLoading && safeDocuments.length === 0 && pendingUploads.length === 0;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-(--line)">
        <h2 className="font-semibold">{t("knowledgeBase")}</h2>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="p-1.5 hover:bg-(--raised) rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none cursor-pointer"
          title={t("refresh")}
          aria-label={t("refresh")}
        >
          <RefreshCw className={cn("h-4 w-4 text-(--muted)", isLoading && "animate-spin")} />
        </button>
      </div>

      {/* Storage Bar (GPU scaleX animation) */}
      <div className="px-4 py-3 border-b border-(--line)">
        <div className="flex items-center justify-between text-xs text-(--muted) mb-1.5">
          <span>{t("kbStorage")}</span>
          <span className="tabular-nums">
            {storageUsedMB} / {storageMaxMB} MB
          </span>
        </div>
        <div className="h-1.5 bg-(--raised) rounded-full overflow-hidden">
          <motion.div
            className={cn(
              "h-full w-full origin-left rounded-full transition-colors",
              storagePercent > 90 ? "bg-(--danger)" : "bg-(--accent)"
            )}
            initial={false}
            animate={{ transform: `scaleX(${storagePercent / 100})` }}
            transition={reducedMotionTransition(shouldReduce, TRANSITION.NORMAL)}
          />
        </div>
      </div>

      {/* Drag & Drop Multi-File Upload Zone */}
      <div className="px-4 py-3 border-b border-(--line)">
        <label
          tabIndex={0}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.currentTarget.querySelector("input")?.click();
            }
          }}
          className={cn(
            "flex items-center justify-center gap-2 px-4 py-2.5",
            "border-2 border-dashed rounded-lg transition-[border-color,background-color] duration-150",
            "cursor-pointer focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
            isDragging
              ? "border-(--accent) bg-(--soft)"
              : "border-(--line) hover:border-(--accent) hover:bg-(--accent)/5"
          )}
        >
          {isUploading ? (
            <Loader2
              aria-hidden="true"
              className="h-4 w-4 animate-spin motion-reduce:animate-none text-(--accent)"
            />
          ) : (
            <Upload aria-hidden="true" className="h-4 w-4 text-(--accent)" />
          )}
          <span className="text-sm font-medium">
            {isDragging
              ? t("kbDropFilesHint")
              : isUploading
                ? t("kbUploading")
                : t("kbUploadDocument")}
          </span>
          <input
            type="file"
            multiple
            className="hidden"
            accept={KNOWLEDGE_ACCEPT}
            onChange={(e) => void handleFileSelect(e)}
          />
        </label>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-3 p-3 rounded-lg bg-(--danger)/10 border border-(--danger)/20 text-sm text-(--danger) flex items-start gap-2">
          <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label={t("close")}
            className="rounded p-0.5 hover:bg-(--danger)/20 focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Document List (pending uploads always remain visible outside skeleton/empty branches) */}
      <div className="flex-1 overflow-auto px-4 py-3 space-y-2">
        {pendingUploads.length > 0 && (
          <AnimatePresence initial={false} mode="popLayout">
            {pendingUploads.map((item) => (
              <PendingUploadRow
                key={item.id}
                item={item}
                processingLabel={t("kbProcessing")}
                shouldReduce={Boolean(shouldReduce)}
              />
            ))}
          </AnimatePresence>
        )}

        {showSkeleton ? (
          <div className="space-y-2" aria-busy="true" data-testid="kb-loading-skeletons">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-(--raised)/30">
                <Skeleton className="h-4 w-4 rounded shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : showEmpty ? (
          <div className="text-center py-8 text-sm text-(--muted)">
            <FileText aria-hidden="true" className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>{t("kbNoDocuments")}</p>
            <p className="text-xs">{t("kbUploadHint")}</p>
          </div>
        ) : (
          <AnimatePresence initial={false} mode="popLayout">
            {safeDocuments.map((doc) => (
              <DocumentItem
                key={doc.id}
                document={doc}
                isDeleting={deletingId === doc.id}
                onDelete={() => void handleDelete(doc.id)}
                chunksLabel={t("kbChunks")}
                deleteLabel={t("kbDeleteDocument")}
                shouldReduce={Boolean(shouldReduce)}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

interface PendingUploadRowProps {
  item: PendingKnowledgeUpload;
  processingLabel: string;
  shouldReduce: boolean;
}

const PendingUploadRow = React.forwardRef<HTMLDivElement, PendingUploadRowProps>(
  function PendingUploadRow({ item, processingLabel, shouldReduce }, ref) {
    const sizeKB = (item.sizeBytes / 1024).toFixed(1);
    return (
      <motion.div
        ref={ref}
        layout={!shouldReduce}
        initial={shouldReduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={shouldReduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
        transition={reducedMotionTransition(shouldReduce, TRANSITION.FAST)}
        data-testid="kb-pending-upload-row"
        className="relative overflow-hidden flex items-center gap-3 p-2.5 rounded-lg border border-(--accent)/30 bg-(--raised)/60"
      >
        <Loader2
          aria-hidden="true"
          className="h-4 w-4 text-(--accent) animate-spin motion-reduce:animate-none shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{item.filename}</div>
          <div className="text-xs text-(--muted) tabular-nums">
            {sizeKB} KB • {item.status === "processing" ? processingLabel : `${item.progress}%`}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden bg-(--line)/70">
          {item.status === "processing" ? (
            <div className="h-full w-2/5 rounded-full bg-(--accent) animate-vikini-shimmer motion-reduce:animate-none" />
          ) : (
            <motion.div
              className="h-full w-full origin-left bg-(--accent)"
              initial={{ transform: "scaleX(0)" }}
              animate={{ transform: `scaleX(${Math.min(1, Math.max(0, item.progress / 100))})` }}
              transition={reducedMotionTransition(shouldReduce, TRANSITION.EXIT_FAST)}
            />
          )}
        </div>
      </motion.div>
    );
  }
);

interface DocumentItemProps {
  document: KnowledgeDocumentWithLegacyChunks;
  isDeleting: boolean;
  onDelete: () => void;
  chunksLabel: string;
  deleteLabel: string;
  shouldReduce: boolean;
}

const DocumentItem = React.forwardRef<HTMLDivElement, DocumentItemProps>(function DocumentItem(
  { document, isDeleting, onDelete, chunksLabel, deleteLabel, shouldReduce },
  ref
) {
  const sizeKB = ((document.size_bytes ?? 0) / 1024).toFixed(1);
  const chunkCount = resolveDocumentChunkCount(document);

  const getStatusIcon = () => {
    switch (document.status) {
      case "ready":
        return <CheckCircle aria-hidden="true" className="h-3.5 w-3.5 text-(--success)" />;
      case "processing":
        return (
          <Loader2
            aria-hidden="true"
            className="h-3.5 w-3.5 text-(--accent) animate-spin motion-reduce:animate-none"
          />
        );
      case "error":
        return <AlertCircle aria-hidden="true" className="h-3.5 w-3.5 text-(--danger)" />;
      default:
        return null;
    }
  };

  return (
    <motion.div
      ref={ref}
      layout={!shouldReduce}
      initial={shouldReduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={shouldReduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
      transition={reducedMotionTransition(shouldReduce, TRANSITION.FAST)}
      className={cn(
        "flex items-center gap-3 p-2.5 rounded-lg",
        "bg-(--raised)/30 hover:bg-(--raised)/50 transition-colors group"
      )}
    >
      <FileText aria-hidden="true" className="h-4 w-4 text-(--muted) shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{document.filename}</span>
          {getStatusIcon()}
        </div>
        <div className="text-xs text-(--muted) tabular-nums">
          {sizeKB} KB • {chunkCount} {chunksLabel}
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
          "p-1.5 rounded-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 focus-visible:opacity-100",
          "hover:bg-(--danger)/10 text-(--danger) transition-[opacity,background-color,transform] active:scale-[0.95] cursor-pointer",
          "focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none",
          isDeleting && "opacity-100"
        )}
        title={deleteLabel}
        aria-label={deleteLabel}
      >
        {isDeleting ? (
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 aria-hidden="true" className="h-4 w-4" />
        )}
      </button>
    </motion.div>
  );
});
