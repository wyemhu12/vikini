// /app/features/chat/components/FileManagerPanel.tsx
"use client";

import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { File, X, Trash2, Loader2, Image as ImageIcon } from "lucide-react";

import { PopoverContent } from "@/components/ui/popover";
import { useFiles } from "@/lib/features/files/useFiles";
import { useFileStore } from "@/lib/features/files/store";
import {
  filterVisibleUploadQueue,
  formatRelativeFileDate,
} from "@/lib/features/files/uploadPresentation";
import type { FileItem } from "@/types/files";
import { formatFileSize, KIND_ICONS, KIND_COLORS } from "@/lib/utils/fileDisplayUtils";
import { logger } from "@/lib/utils/logger";
import { toast } from "@/lib/store/toastStore";
import { useLanguage } from "../hooks/useLanguage";
import { TRANSITION } from "@/lib/utils/motion";

// ─── Types ───────────────────────────────────────────────────────────

export interface FileManagerPanelProps {
  conversationId: string;
  isOpen: boolean;
  onClose: () => void;
  onPreviewFile?: (file: FileItem, files: FileItem[]) => void;
}

// ─── Component ───────────────────────────────────────────────────────

export default function FileManagerPanel({
  conversationId,
  onClose,
  onPreviewFile,
}: FileManagerPanelProps) {
  const { t } = useLanguage();
  const { files, isLoading, mutate } = useFiles(conversationId);
  const uploadQueue = useFileStore((s) => s.uploadQueue);
  const localPreviewByFileId = useFileStore((s) => s.localPreviewByFileId);
  const releaseFileMetadata = useFileStore((s) => s.releaseFileMetadata);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const visibleQueue = filterVisibleUploadQueue(uploadQueue, files);
  const totalCount = files.length + visibleQueue.length;

  const handleDelete = useCallback(
    async (fileId: string) => {
      setDeletingId(fileId);
      try {
        const res = await fetch(`/api/files?id=${encodeURIComponent(fileId)}`, {
          method: "DELETE",
        });
        if (res.ok) {
          releaseFileMetadata(fileId);
          await mutate();
        } else {
          toast.error(t("deleteFileFailed"));
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : t("deleteFileFailed");
        logger.error("[FileManagerPanel] delete error:", message);
        toast.error(t("deleteFileFailed"));
      } finally {
        setDeletingId(null);
      }
    },
    [mutate, releaseFileMetadata, t]
  );

  return (
    <PopoverContent
      side="top"
      align="start"
      sideOffset={8}
      className="w-[min(20rem,calc(100vw-2rem))] max-h-80 p-0 rounded-2xl bg-(--surface) border border-(--line) shadow-(--shadow-elevated) overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-(--line)">
        <span className="text-xs font-bold text-(--text)">
          {t("files")}{" "}
          <span className="text-(--muted) font-normal tabular-nums">({totalCount})</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-(--raised) text-(--muted) hover:text-(--text) transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
          aria-label={t("close")}
        >
          <X aria-hidden="true" className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-1.5 py-1.5 scrollbar-thin scrollbar-thumb-(--line)">
        {isLoading && totalCount === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin text-(--accent)" />
          </div>
        ) : totalCount === 0 ? (
          <div className="flex items-center justify-center py-6 text-(--muted)">
            <p className="text-xs">{t("noFilesUploaded")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {visibleQueue.map((upload) => (
              <div
                key={upload.tempId}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-(--raised)/60"
              >
                <div className="shrink-0">
                  {upload.previewUrl ? (
                    <img
                      src={upload.previewUrl}
                      alt={upload.filename}
                      className="h-7 w-7 rounded-md object-cover opacity-75 border border-(--line)"
                    />
                  ) : (
                    <Loader2
                      aria-hidden="true"
                      className="w-4 h-4 animate-spin motion-reduce:animate-none text-(--accent)"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-(--text) truncate" title={upload.filename}>
                    {upload.filename}
                  </p>
                  <p className="text-xs text-(--muted) mt-0.5 tabular-nums">
                    {upload.status === "queued"
                      ? t("fileStatusQueued")
                      : upload.status === "processing"
                        ? t("fileStatusProcessing")
                        : `${upload.progress}%`}
                  </p>
                </div>
              </div>
            ))}

            <AnimatePresence mode="popLayout" initial={false}>
              {files.map((file) => (
                <FileListItem
                  key={file.id}
                  file={file}
                  localPreviewUrl={localPreviewByFileId[file.id]}
                  isDeleting={deletingId === file.id}
                  onDelete={handleDelete}
                  onPreview={onPreviewFile ? () => onPreviewFile(file, files) : undefined}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </PopoverContent>
  );
}

// ─── File List Item (forwardRef for AnimatePresence mode="popLayout") ───

interface FileListItemProps {
  file: FileItem;
  localPreviewUrl?: string;
  isDeleting: boolean;
  onDelete: (id: string) => void;
  onPreview?: () => void;
}

const FileListItem = React.forwardRef<HTMLDivElement, FileListItemProps>(function FileListItem(
  { file, localPreviewUrl, isDeleting, onDelete, onPreview },
  ref
) {
  const { t } = useLanguage();
  const Icon = KIND_ICONS[file.kind] ?? File;
  const iconColor = KIND_COLORS[file.kind] ?? "text-(--muted)";
  const isImage = file.kind === "image";

  const rowContent = (
    <>
      <div className="shrink-0">
        {isImage ? (
          <ListImageThumb fileId={file.id} initialSrc={localPreviewUrl} alt={file.filename} />
        ) : (
          <Icon aria-hidden="true" className={`w-4 h-4 ${iconColor}`} />
        )}
      </div>

      <div className="flex-1 min-w-0 text-left">
        <p className="text-xs font-medium text-(--text) truncate" title={file.filename}>
          {file.filename}
        </p>
        <p className="text-xs text-(--muted) mt-0.5 tabular-nums">
          {formatFileSize(file.size_bytes)} · {formatRelativeFileDate(file.created_at, t)}
        </p>
      </div>
    </>
  );

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 16, transition: TRANSITION.EXIT_FAST }}
      className="group flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-(--raised) transition-colors"
    >
      {onPreview ? (
        <button
          type="button"
          onClick={onPreview}
          aria-label={`${t("openFilePreview")}: ${file.filename}`}
          className="flex flex-1 min-w-0 items-center gap-2.5 rounded-lg py-0.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
        >
          {rowContent}
        </button>
      ) : (
        <div className="flex flex-1 min-w-0 items-center gap-2.5 py-0.5">{rowContent}</div>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(file.id);
        }}
        disabled={isDeleting}
        className="shrink-0 p-1.5 rounded-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 focus-visible:opacity-100 transition-[opacity,color,background-color,transform] active:scale-[0.95] hover:bg-(--danger)/15 text-(--muted) hover:text-(--danger) disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
        aria-label={`${t("removeFile")}: ${file.filename}`}
      >
        {isDeleting ? (
          <Loader2 aria-hidden="true" className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Trash2 aria-hidden="true" className="w-3.5 h-3.5" />
        )}
      </button>
    </motion.div>
  );
});

function ListImageThumb({
  fileId,
  initialSrc,
  alt,
}: {
  fileId: string;
  initialSrc?: string;
  alt: string;
}) {
  const [remoteSrc, setRemoteSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (initialSrc) return;
    let cancelled = false;
    fetch(`/api/files/${fileId}/url`)
      .then((r) => r.json())
      .then((data: unknown) => {
        if (!cancelled && typeof data === "object" && data !== null) {
          const d = data as { data?: { signedUrl?: string }; signedUrl?: string };
          const url = d.data?.signedUrl ?? d.signedUrl;
          if (url) setRemoteSrc(url);
          else setError(true);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [fileId, initialSrc]);

  const src = initialSrc ?? remoteSrc;
  if (error || !src) {
    return <ImageIcon aria-hidden="true" className="w-4 h-4 text-(--accent)" />;
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setError(true)}
      className="h-7 w-7 rounded-md object-cover border border-(--line)"
      loading="lazy"
    />
  );
}
