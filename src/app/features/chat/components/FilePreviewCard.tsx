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

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Image as ImageIcon, X, AlertCircle, Loader2, Zap } from "lucide-react";
import type { FileItem, FileKind, FileUploadProgress } from "@/types/files";
import {
  formatFileSize,
  KIND_ICONS,
  KIND_COLORS,
  truncateFilename,
} from "@/lib/utils/fileDisplayUtils";

interface FilePreviewCardProps {
  /** Uploaded file data */
  file?: FileItem;
  /** In-progress upload data */
  upload?: FileUploadProgress;
  /** Remove handler (only for uploaded files) */
  onRemove?: (id: string) => void | Promise<void>;
  /** Click handler for preview */
  onClick?: (file: FileItem) => void;
  /** Compact mode for in-message display */
  compact?: boolean;
  /** Disabled state */
  disabled?: boolean;
}

export function FilePreviewCard({
  file,
  upload,
  onRemove,
  onClick,
  compact = false,
  disabled = false,
}: FilePreviewCardProps) {
  const [deleting, setDeleting] = useState(false);
  const isUploading = !!upload;
  const isError = upload?.status === "error";

  const kind: FileKind = file?.kind ?? upload?.kind ?? "other";
  const filename = file?.filename ?? upload?.filename ?? "file";
  const size = file?.size_bytes ?? upload?.size ?? 0;
  const IconComponent = KIND_ICONS[kind];
  const iconColor = KIND_COLORS[kind];

  const isImage = kind === "image";

  const cardSize = compact ? "w-28 h-20" : "w-36 h-24";
  const iconSize = compact ? "w-6 h-6" : "w-8 h-8";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8, x: -20 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className={`group relative ${cardSize} shrink-0 rounded-xl border transition-[border-color,box-shadow] duration-200 overflow-hidden ${
        isError
          ? "border-(--danger)/50 bg-(--danger)/5"
          : "border-(--control-border) bg-(--surface-base) hover:border-(--accent)/50 hover:shadow-md"
      } ${!isUploading && file ? "cursor-pointer" : ""}`}
      onClick={() => !isUploading && file && onClick?.(file)}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !isUploading && file) {
          e.preventDefault();
          onClick?.(file);
        }
      }}
      role={!isUploading && file ? "button" : undefined}
      tabIndex={!isUploading && file ? 0 : undefined}
      aria-label={!isUploading && file ? `Preview ${filename}` : undefined}
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
          {truncateFilename(filename)}
        </span>

        {/* Size + status */}
        <div className="flex items-center gap-1 text-[9px] text-(--text-secondary)">
          {isUploading ? (
            <>
              {isError ? (
                <AlertCircle className="w-3 h-3 text-(--danger)" />
              ) : (
                <Loader2 className="w-3 h-3 animate-spin text-(--accent)" />
              )}
              <span className={isError ? "text-(--danger)" : ""}>
                {isError ? (upload.error || "Error").slice(0, 20) : `${upload.progress}%`}
              </span>
            </>
          ) : (
            <>
              <span>{formatFileSize(size)}</span>
              {file && "gemini_ready" in file && file.gemini_ready && (
                <span title="Gemini ready">
                  <Zap className="w-3 h-3 text-(--warning)" />
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
            className="h-full w-full bg-(--accent) origin-left"
            initial={{ transform: "scaleX(0)" }}
            animate={{ transform: `scaleX(${(upload.progress ?? 0) / 100})` }}
            transition={{ ease: [0.23, 1, 0.32, 1] }}
          />
        </div>
      )}

      {/* Remove button */}
      {!isUploading && file && onRemove && !disabled && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (deleting) return;
            setDeleting(true);
            void onRemove(file.id);
          }}
          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded-full bg-(--surface-base)/90 hover:bg-(--danger)/20 text-(--text-secondary) hover:text-(--danger)"
          aria-label={`Remove ${filename}`}
          disabled={deleting}
        >
          {deleting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <X className="w-3.5 h-3.5" />
          )}
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
