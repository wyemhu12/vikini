/**
 * FilePreviewCard - Single file card component with in-place upload -> ready morphing.
 *
 * Uses React.forwardRef so Framer Motion AnimatePresence mode="popLayout" measures exit
 * geometry cleanly. Preserves DOM identity across queued -> uploading -> processing -> ready
 * transitions when keyed by stable tempId, showing instant local image previews with zero flash.
 */
"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Image as ImageIcon, X, AlertCircle, Loader2, Zap, Check, Clock } from "lucide-react";
import type { FileItem, FileKind, FileUploadProgress } from "@/types/files";
import {
  formatFileSize,
  KIND_ICONS,
  KIND_COLORS,
  truncateFilename,
} from "@/lib/utils/fileDisplayUtils";
import { useLanguage } from "../hooks/useLanguage";
import { TRANSITION, reducedMotionTransition, staggerDelay } from "@/lib/utils/motion";

export interface FilePreviewCardProps {
  /** Uploaded file data */
  file?: FileItem;
  /** In-progress upload data */
  upload?: FileUploadProgress;
  /** Local blob objectURL carried over seamlessly until signed URL loads */
  localPreviewUrl?: string;
  /** Brief transient highlight right after upload settles in place */
  justCompleted?: boolean;
  /** Optional stagger index for multi-file drop entrance */
  staggerIndex?: number;
  /** Remove handler (for uploaded files) */
  onRemove?: (id: string) => void | Promise<void>;
  /** Cancel handler (for queued/uploading/processing uploads) */
  onCancelUpload?: (tempId: string) => void;
  /** Dismiss handler (for failed uploads) */
  onDismissError?: (tempId: string) => void;
  /** Click handler for preview */
  onClick?: (file: FileItem) => void;
  /** Compact mode for in-message display */
  compact?: boolean;
  /** Disabled state */
  disabled?: boolean;
}

export const FilePreviewCard = React.forwardRef<HTMLDivElement, FilePreviewCardProps>(
  function FilePreviewCard(
    {
      file,
      upload,
      localPreviewUrl,
      justCompleted = false,
      staggerIndex = 0,
      onRemove,
      onCancelUpload,
      onDismissError,
      onClick,
      compact = false,
      disabled = false,
    },
    ref
  ) {
    const { t } = useLanguage();
    const shouldReduce = useReducedMotion();
    const [deleting, setDeleting] = useState(false);
    const mountedRef = useRef(true);

    useEffect(() => {
      mountedRef.current = true;
      return () => {
        mountedRef.current = false;
      };
    }, []);

    const isUploading = Boolean(upload);
    const isQueued = upload?.status === "queued";
    const isProcessing = upload?.status === "processing";
    const isError = upload?.status === "error";

    const kind: FileKind = file?.kind ?? upload?.kind ?? "other";
    const filename = file?.filename ?? upload?.filename ?? "file";
    const size = file?.size_bytes ?? upload?.size ?? 0;
    const IconComponent = KIND_ICONS[kind];
    const iconColor = KIND_COLORS[kind];

    const isImage = kind === "image";
    const initialImageSrc = upload?.previewUrl ?? localPreviewUrl;
    const cardSize = compact ? "w-28 h-20" : "w-36 h-24";
    const iconSize = compact ? "w-6 h-6" : "w-8 h-8";

    const handleRemoveClick = async () => {
      if (!file || !onRemove || deleting) return;
      setDeleting(true);
      try {
        await onRemove(file.id);
      } catch {
        // Caller owns user-facing error toast/logging; prevent unhandled promise rejection here
      } finally {
        if (mountedRef.current) {
          setDeleting(false);
        }
      }
    };

    const cardInner = (
      <>
        {/* Thumbnail for images (instant local objectURL -> signed URL), icon for others */}
        {isImage && (initialImageSrc || file) ? (
          <ImageThumbnail
            fileId={file?.id}
            initialSrc={initialImageSrc}
            alt={filename}
            compact={compact}
            dimmed={isUploading && !isError}
          />
        ) : (
          <IconComponent
            aria-hidden="true"
            className={`${iconSize} ${iconColor} ${isUploading && !isError ? "opacity-75" : ""}`}
          />
        )}

        {/* Filename */}
        <span
          className="text-xs text-(--muted) truncate w-full text-center leading-tight"
          title={filename}
        >
          {truncateFilename(filename)}
        </span>

        {/* Size + staged status */}
        <div className="flex items-center gap-1 text-xs text-(--muted) min-w-0 max-w-full">
          {isUploading ? (
            <>
              {isError ? (
                <AlertCircle aria-hidden="true" className="w-3 h-3 shrink-0 text-(--danger)" />
              ) : isQueued ? (
                <Clock aria-hidden="true" className="w-3 h-3 shrink-0 text-(--muted)" />
              ) : (
                <Loader2
                  aria-hidden="true"
                  className="w-3 h-3 shrink-0 animate-spin motion-reduce:animate-none text-(--accent)"
                />
              )}
              <span
                className={`truncate tabular-nums ${isError ? "text-(--danger)" : ""}`}
                title={isError ? upload?.error : undefined}
              >
                {isError
                  ? (upload?.error || t("uploadFailed")).slice(0, 22)
                  : isQueued
                    ? t("fileStatusQueued")
                    : isProcessing
                      ? t("fileStatusProcessing")
                      : `${upload?.progress ?? 0}%`}
              </span>
            </>
          ) : (
            <>
              <span className="tabular-nums">{formatFileSize(size)}</span>
              {justCompleted ? (
                <span title={t("fileStatusReady")} className="inline-flex text-(--success)">
                  <Check aria-hidden="true" className="w-3 h-3" />
                </span>
              ) : (
                file &&
                "gemini_ready" in file &&
                file.gemini_ready && (
                  <span title="Gemini ready">
                    <Zap aria-hidden="true" className="w-3 h-3 text-(--warning)" />
                  </span>
                )
              )}
            </>
          )}
        </div>
      </>
    );

    const borderClasses = isError
      ? "border-(--danger)/50 bg-(--danger)/5"
      : justCompleted
        ? "border-(--success)/60 bg-(--surface) shadow-sm"
        : "border-(--line) bg-(--surface) hover:border-(--accent)/50 hover:shadow-md";

    return (
      <motion.div
        ref={ref}
        layout={!shouldReduce}
        initial={shouldReduce ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={shouldReduce ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
        transition={reducedMotionTransition(shouldReduce, {
          ...TRANSITION.FAST,
          delay: staggerDelay(staggerIndex),
        })}
        className={`group relative snap-start ${cardSize} shrink-0 rounded-xl border transition-[border-color,box-shadow,background-color] duration-200 overflow-hidden ${borderClasses}`}
      >
        {/* Content area: native sibling button when clickable (avoids nested interactive with action button) */}
        {!isUploading && file && onClick ? (
          <button
            type="button"
            onClick={() => onClick(file)}
            aria-label={`${t("openFilePreview")}: ${filename}`}
            className="flex w-full h-full flex-col items-center justify-center px-2 py-1.5 gap-0.5 cursor-pointer transition-transform duration-150 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--ring)"
          >
            {cardInner}
          </button>
        ) : (
          <div className="flex flex-col items-center justify-center h-full px-2 py-1.5 gap-0.5">
            {cardInner}
          </div>
        )}

        {/* Bottom progress bar: determinate GPU scaleX while uploading, GPU shimmer while processing */}
        {isUploading && !isError && !isQueued && (
          <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden bg-(--line)/70">
            {isProcessing ? (
              <div
                data-testid="upload-processing-shimmer"
                className="h-full w-2/5 rounded-full bg-(--accent) animate-vikini-shimmer motion-reduce:animate-none"
              />
            ) : (
              <motion.div
                className="h-full w-full bg-(--accent) origin-left"
                initial={{ transform: "scaleX(0)" }}
                animate={{
                  transform: `scaleX(${Math.min(1, Math.max(0, (upload?.progress ?? 0) / 100))})`,
                }}
                transition={reducedMotionTransition(shouldReduce, TRANSITION.EXIT_FAST)}
              />
            )}
          </div>
        )}

        {/* Action button: Cancel upload / Dismiss error / Remove uploaded file */}
        {isUploading && upload && !isError && onCancelUpload && (
          <button
            type="button"
            onClick={() => onCancelUpload(upload.tempId)}
            className="absolute top-1 right-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 focus-visible:opacity-100 min-w-7 min-h-7 md:min-w-6 md:min-h-6 flex items-center justify-center transition-[opacity,background-color,color,transform] duration-150 active:scale-[0.95] p-1 rounded-full bg-(--surface)/90 hover:bg-(--danger)/20 text-(--muted) hover:text-(--danger) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
            aria-label={`${t("cancelUpload")}: ${filename}`}
          >
            <X aria-hidden="true" className="w-3.5 h-3.5" />
          </button>
        )}

        {isUploading && upload && isError && onDismissError && (
          <button
            type="button"
            onClick={() => onDismissError(upload.tempId)}
            className="absolute top-1 right-1 opacity-100 min-w-7 min-h-7 md:min-w-6 md:min-h-6 flex items-center justify-center transition-[background-color,color,transform] duration-150 active:scale-[0.95] p-1 rounded-full bg-(--surface)/90 hover:bg-(--danger)/20 text-(--danger) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
            aria-label={`${t("dismissUploadError")}: ${filename}`}
          >
            <X aria-hidden="true" className="w-3.5 h-3.5" />
          </button>
        )}

        {!isUploading && file && onRemove && !disabled && (
          <button
            type="button"
            onClick={() => void handleRemoveClick()}
            className="absolute top-1 right-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 focus-visible:opacity-100 min-w-7 min-h-7 md:min-w-6 md:min-h-6 flex items-center justify-center transition-[opacity,background-color,color,transform] duration-150 active:scale-[0.95] p-1 rounded-full bg-(--surface)/90 hover:bg-(--danger)/20 text-(--muted) hover:text-(--danger) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
            aria-label={`${t("removeFile")}: ${filename}`}
            disabled={deleting}
          >
            {deleting ? (
              <Loader2 aria-hidden="true" className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <X aria-hidden="true" className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </motion.div>
    );
  }
);

/** Image thumbnail using instant CSP-safe local data URL when available, falling back to signed URL. */
function ImageThumbnail({
  fileId,
  initialSrc,
  alt,
  compact,
  dimmed = false,
}: {
  fileId?: string;
  initialSrc?: string;
  alt: string;
  compact: boolean;
  dimmed?: boolean;
}) {
  const [remoteSrc, setRemoteSrc] = useState<string | null>(null);
  const [initialFailed, setInitialFailed] = useState(false);
  const [loaded, setLoaded] = useState(Boolean(initialSrc));
  const [remoteError, setRemoteError] = useState(false);

  useEffect(() => {
    setInitialFailed(false);
    if (initialSrc) setLoaded(true);
  }, [initialSrc]);

  const usableInitialSrc = initialSrc && !initialFailed ? initialSrc : null;

  useEffect(() => {
    if (usableInitialSrc || !fileId) return;
    let cancelled = false;
    setRemoteError(false);
    fetch(`/api/files/${fileId}/url`)
      .then((r) => r.json())
      .then((data: unknown) => {
        if (!cancelled && typeof data === "object" && data !== null) {
          const d = data as { data?: { signedUrl?: string }; signedUrl?: string };
          const url = d.data?.signedUrl ?? d.signedUrl;
          if (url) setRemoteSrc(url);
          else setRemoteError(true);
        }
      })
      .catch(() => {
        if (!cancelled) setRemoteError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [fileId, usableInitialSrc]);

  const activeSrc = usableInitialSrc ?? remoteSrc;

  if ((remoteError && !usableInitialSrc) || !activeSrc) {
    return (
      <ImageIcon
        aria-hidden="true"
        className={`${compact ? "w-6 h-6" : "w-8 h-8"} text-(--accent) ${!activeSrc && !remoteError ? "animate-pulse motion-reduce:animate-none" : ""}`}
      />
    );
  }

  return (
    <img
      src={activeSrc}
      alt={alt}
      onLoad={() => setLoaded(true)}
      onError={() => {
        if (usableInitialSrc && activeSrc === usableInitialSrc) {
          setInitialFailed(true);
        } else {
          setRemoteError(true);
        }
      }}
      className={`${compact ? "w-12 h-10" : "w-16 h-12"} object-cover rounded-md transition-opacity duration-200 ${
        dimmed ? "opacity-70" : loaded ? "opacity-100" : "opacity-0"
      }`}
      loading="lazy"
    />
  );
}

export default FilePreviewCard;
