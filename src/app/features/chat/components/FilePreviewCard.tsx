/**
 * FilePreviewCard — Single file card component.
 *
 * Two modes:
 * 1. Uploaded file — shows thumbnail/icon, filename, size
 * 2. Uploading file — shows progress bar and status
 *
 * Used by FilePreviewArea (inline above textarea) and FileInMessage (in chat bubbles).
 */
"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  File,
  X,
  AlertCircle,
  Loader2,
  Zap,
} from "lucide-react";
import type { FileItem, FileKind, FileUploadProgress } from "@/types/files";

interface FilePreviewCardProps {
  /** Uploaded file data */
  file?: FileItem;
  /** In-progress upload data */
  upload?: FileUploadProgress;
  /** Remove handler (only for uploaded files) */
  onRemove?: (id: string) => void;
  /** Click handler for preview */
  onClick?: (file: FileItem) => void;
  /** Compact mode for in-message display */
  compact?: boolean;
  /** Disabled state */
  disabled?: boolean;
}

const KIND_ICONS: Record<FileKind, React.ElementType> = {
  image: ImageIcon,
  video: Film,
  audio: Music,
  document: FileText,
  text: FileText,
  archive: Archive,
  other: File,
};

const KIND_COLORS: Record<FileKind, string> = {
  image: "text-pink-500",
  video: "text-purple-500",
  audio: "text-amber-500",
  document: "text-red-500",
  text: "text-blue-500",
  archive: "text-green-500",
  other: "text-(--text-secondary)",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FilePreviewCard({
  file,
  upload,
  onRemove,
  onClick,
  compact = false,
  disabled = false,
}: FilePreviewCardProps) {
  const isUploading = !!upload;
  const isError = upload?.status === "error";

  const kind: FileKind = file?.kind ?? upload?.kind ?? "other";
  const filename = file?.filename ?? upload?.filename ?? "file";
  const size = file?.size_bytes ?? upload?.size ?? 0;
  const IconComponent = KIND_ICONS[kind];
  const iconColor = KIND_COLORS[kind];

  const isImage = kind === "image";
  const _signedUrlBase = file ? `/api/files/${file.id}/url` : null;

  const cardSize = compact ? "w-28 h-20" : "w-36 h-24";
  const iconSize = compact ? "w-6 h-6" : "w-8 h-8";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`group relative ${cardSize} shrink-0 rounded-xl border transition-all duration-200 overflow-hidden ${
        isError
          ? "border-red-500/50 bg-red-500/5"
          : "border-(--control-border) bg-(--surface-base) hover:border-(--accent)/50 hover:shadow-md"
      } ${!isUploading && file ? "cursor-pointer" : ""}`}
      onClick={() => !isUploading && file && onClick?.(file)}
      role={!isUploading && file ? "button" : undefined}
      tabIndex={!isUploading && file ? 0 : undefined}
    >
      {/* Content area */}
      <div className="flex flex-col items-center justify-center h-full px-2 py-1.5 gap-0.5">
        {/* Thumbnail for images, icon for others */}
        {isImage && file ? (
          <ImageThumbnail fileId={file.id} alt={filename} compact={compact} />
        ) : (
          <IconComponent
            className={`${iconSize} ${iconColor} ${isUploading ? "animate-pulse" : ""}`}
          />
        )}

        {/* Filename */}
        <span
          className="text-[10px] text-(--text-secondary) truncate w-full text-center leading-tight"
          title={filename}
        >
          {filename.length > 18 ? filename.slice(0, 15) + "..." : filename}
        </span>

        {/* Size + status */}
        <div className="flex items-center gap-1 text-[9px] text-(--text-secondary)">
          {isUploading ? (
            <>
              {isError ? (
                <AlertCircle className="w-3 h-3 text-red-500" />
              ) : (
                <Loader2 className="w-3 h-3 animate-spin text-(--accent)" />
              )}
              <span className={isError ? "text-red-500" : ""}>
                {isError ? (upload.error || "Error").slice(0, 20) : `${upload.progress}%`}
              </span>
            </>
          ) : (
            <>
              <span>{formatFileSize(size)}</span>
              {file && "gemini_ready" in file && file.gemini_ready && (
                <span title="Gemini ready">
                  <Zap className="w-3 h-3 text-yellow-500" />
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {isUploading && !isError && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-(--control-border)">
          <motion.div
            className="h-full bg-(--accent)"
            initial={{ width: 0 }}
            animate={{ width: `${upload.progress}%` }}
            transition={{ ease: "easeOut" }}
          />
        </div>
      )}

      {/* Remove button */}
      {!isUploading && file && onRemove && !disabled && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(file.id);
          }}
          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded-full bg-(--surface-base)/90 hover:bg-red-500/20 text-(--text-secondary) hover:text-red-500"
          aria-label={`Remove ${filename}`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </motion.div>
  );
}

/** Image thumbnail with lazy loading */
function ImageThumbnail({
  fileId,
  alt,
  compact,
}: {
  fileId: string;
  alt: string;
  compact: boolean;
}) {
  const [src, setSrc] = React.useState<string | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/files/${fileId}/url`)
      .then((r) => r.json())
      .then((data: unknown) => {
        if (!cancelled && typeof data === "object" && data !== null) {
          const d = data as { data?: { signedUrl?: string }; signedUrl?: string };
          const url = d.data?.signedUrl ?? d.signedUrl;
          if (url) setSrc(url);
          else setError(true);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  if (error || !src) {
    return (
      <ImageIcon
        className={`${compact ? "w-6 h-6" : "w-8 h-8"} text-pink-500 ${!src && !error ? "animate-pulse" : ""}`}
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`${compact ? "w-12 h-10" : "w-16 h-12"} object-cover rounded-md`}
      loading="lazy"
    />
  );
}

export default FilePreviewCard;
