/**
 * FileLightbox - Full-screen preview modal for files.
 *
 * Supports images (full-size), text (monospace), video/audio (HTML5 players),
 * and generic files (info + download).
 */
"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion } from "framer-motion";
import {
  X,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  File,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import type { FileItem } from "@/types/files";
import { formatFileSize } from "@/lib/utils/fileDisplayUtils";
import { useLanguage } from "../hooks/useLanguage";
import { logger } from "@/lib/utils/logger";
import { TRANSITION } from "@/lib/utils/motion";

interface FileLightboxProps {
  file: FileItem | null;
  onClose: () => void;
  /** All files in the conversation for navigation */
  files?: FileItem[];
  /** Called when user navigates to a different file */
  onNavigate?: (file: FileItem) => void;
}

export function FileLightbox({ file, onClose, files, onNavigate }: FileLightboxProps) {
  const { t } = useLanguage();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  // ─── Navigation helpers ──────────────────────────────────────────────

  const currentIndex = useMemo(() => {
    if (!file || !files?.length) return -1;
    return files.findIndex((f) => f.id === file.id);
  }, [file, files]);

  const hasPrev = Boolean(onNavigate) && currentIndex > 0;
  const hasNext = Boolean(onNavigate) && Boolean(files) && currentIndex < (files?.length ?? 0) - 1;

  const navigatePrev = useCallback(() => {
    if (hasPrev && files && onNavigate) {
      onNavigate(files[currentIndex - 1]);
    }
  }, [hasPrev, files, onNavigate, currentIndex]);

  const navigateNext = useCallback(() => {
    if (hasNext && files && onNavigate) {
      onNavigate(files[currentIndex + 1]);
    }
  }, [hasNext, files, onNavigate, currentIndex]);

  // ─── Fetch signed URL (re-runs on file change or retryNonce) ─────────

  useEffect(() => {
    if (!file) {
      setSignedUrl(null);
      setTextContent(null);
      setFetchError(false);
      return;
    }

    let cancelled = false;
    setSignedUrl(null);
    setFetchError(false);
    setTextContent(null);

    fetch(`/api/files/${file.id}/url`)
      .then((r) => r.json())
      .then((data: unknown) => {
        if (cancelled) return;
        const d = data as { data?: { signedUrl?: string }; signedUrl?: string };
        const url = d.data?.signedUrl ?? d.signedUrl;
        if (url) {
          setSignedUrl(url);
        } else {
          setFetchError(true);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          logger.error("[FileLightbox] Failed to fetch signed URL:", err);
          setFetchError(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [file, retryNonce]);

  // Fetch text content for text files
  useEffect(() => {
    if (!file || file.kind !== "text" || !signedUrl) return;

    let cancelled = false;
    fetch(signedUrl)
      .then((r) => r.text())
      .then((text) => {
        if (!cancelled) setTextContent(text.slice(0, 50_000));
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          logger.error("[FileLightbox] Failed to load text file preview:", err);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [file, signedUrl]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        navigatePrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        navigateNext();
      }
    },
    [navigatePrev, navigateNext]
  );

  const handleRetry = useCallback(() => {
    if (!file) return;
    setRetryNonce((n) => n + 1);
  }, [file]);

  return (
    <Dialog.Root
      open={Boolean(file)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-(--z-modal) bg-(--overlay) backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-(--z-modal) flex flex-col items-center justify-center outline-none"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          onKeyDown={handleKeyDown}
        >
          {file && (
            <>
              <Dialog.Title className="sr-only">
                {file.filename || t("filePreviewTitle")}
              </Dialog.Title>

              {/* Header bar */}
              <motion.div
                initial={{ y: -12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={TRANSITION.EXIT_FAST}
                className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 md:px-6 py-4 bg-gradient-to-b from-(--overlay) to-transparent"
              >
                <div className="flex items-center gap-3 text-(--on-overlay)/90 min-w-0">
                  <KindIcon kind={file.kind} />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium truncate max-w-xs" title={file.filename}>
                      {file.filename}
                    </span>
                    <span className="text-xs text-(--on-overlay)/60">
                      {formatFileSize(file.size_bytes)} • {file.mime_type}
                    </span>
                  </div>

                  {/* File counter badge */}
                  {files && files.length > 1 && currentIndex >= 0 && (
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-(--on-overlay)/15 text-(--on-overlay)/80 text-xs font-medium tabular-nums">
                      {currentIndex + 1} / {files.length}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {signedUrl && (
                    <>
                      <a
                        href={signedUrl}
                        download={file.filename}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-(--on-overlay)/10 hover:bg-(--on-overlay)/20 text-(--on-overlay)/90 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                      >
                        <Download aria-hidden="true" className="w-4 h-4" />
                        {t("studioDownload")}
                      </a>
                      <a
                        href={signedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-(--on-overlay)/10 hover:bg-(--on-overlay)/20 text-(--on-overlay)/90 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                      >
                        <ExternalLink aria-hidden="true" className="w-4 h-4" />
                        {t("openInNewTab")}
                      </a>
                    </>
                  )}
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="flex items-center justify-center w-10 h-10 rounded-full bg-(--on-overlay)/10 hover:bg-(--on-overlay)/20 text-(--on-overlay) transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                      aria-label={t("close")}
                    >
                      <X aria-hidden="true" className="w-5 h-5" />
                    </button>
                  </Dialog.Close>
                </div>
              </motion.div>

              {/* Previous file button */}
              {hasPrev && (
                <button
                  type="button"
                  onClick={navigatePrev}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-10 h-10 rounded-full bg-(--on-overlay)/10 hover:bg-(--on-overlay)/20 text-(--on-overlay)/80 hover:text-(--on-overlay) transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                  aria-label={t("previousImage")}
                >
                  <ChevronLeft aria-hidden="true" className="w-6 h-6" />
                </button>
              )}

              {/* Next file button */}
              {hasNext && (
                <button
                  type="button"
                  onClick={navigateNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-10 h-10 rounded-full bg-(--on-overlay)/10 hover:bg-(--on-overlay)/20 text-(--on-overlay)/80 hover:text-(--on-overlay) transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                  aria-label={t("nextImage")}
                >
                  <ChevronRight aria-hidden="true" className="w-6 h-6" />
                </button>
              )}

              {/* Content area */}
              <motion.div
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={TRANSITION.EXIT_FAST}
                className="max-w-[90vw] max-h-[80vh] overflow-auto"
              >
                {file.kind === "image" && signedUrl && (
                  <img
                    src={signedUrl}
                    alt={file.filename}
                    className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-(--shadow-elevated)"
                  />
                )}

                {file.kind === "video" && signedUrl && (
                  <video
                    src={signedUrl}
                    controls
                    autoPlay={false}
                    className="max-w-full max-h-[80vh] rounded-lg shadow-(--shadow-elevated)"
                  />
                )}

                {file.kind === "audio" && signedUrl && (
                  <div className="flex flex-col items-center gap-6 p-12 bg-(--surface) rounded-2xl shadow-(--shadow-elevated)">
                    <Music aria-hidden="true" className="w-16 h-16 text-(--warning)" />
                    <span
                      className="text-lg font-medium text-(--text) truncate max-w-sm"
                      title={file.filename}
                    >
                      {file.filename}
                    </span>
                    <audio src={signedUrl} controls className="w-full max-w-md" />
                  </div>
                )}

                {file.kind === "text" && textContent !== null && (
                  <pre className="p-6 bg-(--surface) rounded-lg shadow-(--shadow-elevated) text-sm text-(--text) font-mono whitespace-pre-wrap break-words max-w-3xl overflow-auto">
                    {textContent}
                  </pre>
                )}

                {(file.kind === "document" || file.kind === "archive" || file.kind === "other") && (
                  <div className="flex flex-col items-center gap-4 p-12 bg-(--surface) rounded-2xl shadow-(--shadow-elevated)">
                    <KindIcon kind={file.kind} large />
                    <span
                      className="text-lg font-medium text-(--text) truncate max-w-sm"
                      title={file.filename}
                    >
                      {file.filename}
                    </span>
                    <span className="text-sm text-(--muted)">
                      {formatFileSize(file.size_bytes)} • {file.mime_type}
                    </span>
                    {signedUrl && (
                      <a
                        href={signedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-(--accent) text-(--on-accent) rounded-lg hover:brightness-110 transition-[filter] mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                      >
                        <ExternalLink aria-hidden="true" className="w-4 h-4" />
                        {t("openInNewTab")}
                      </a>
                    )}
                  </div>
                )}

                {/* Error state */}
                {fetchError && !signedUrl && (
                  <div
                    role="alert"
                    className="flex flex-col items-center gap-4 p-12 bg-(--surface) rounded-2xl shadow-(--shadow-elevated)"
                  >
                    <AlertCircle aria-hidden="true" className="w-12 h-12 text-(--danger)" />
                    <span className="text-sm text-(--muted)">{t("error")}</span>
                    <button
                      type="button"
                      onClick={handleRetry}
                      className="flex items-center gap-2 px-4 py-2 bg-(--accent) text-(--on-accent) rounded-lg hover:brightness-110 transition-[filter] text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
                    >
                      <RotateCcw aria-hidden="true" className="w-4 h-4" />
                      {t("tryAgain")}
                    </button>
                  </div>
                )}

                {/* Loading state */}
                {!signedUrl && !fetchError && (
                  <div className="flex flex-col items-center gap-4 p-12 bg-(--surface) rounded-2xl shadow-(--shadow-elevated)">
                    <div className="w-12 h-12 rounded-full border-2 border-(--accent) border-t-transparent animate-spin" />
                    <span className="text-sm text-(--muted)">{t("loading")}</span>
                  </div>
                )}
              </motion.div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function KindIcon({ kind, large = false }: { kind: string; large?: boolean }) {
  const size = large ? "w-16 h-16" : "w-5 h-5";
  switch (kind) {
    case "image":
      return <ImageIcon className={`${size} text-(--accent)`} />;
    case "video":
      return <Film className={`${size} text-(--accent)`} />;
    case "audio":
      return <Music className={`${size} text-(--warning)`} />;
    case "document":
      return <FileText className={`${size} text-(--danger)`} />;
    case "text":
      return <FileText className={`${size} text-(--accent)`} />;
    default:
      return <File className={`${size} text-(--muted)`} />;
  }
}

export default FileLightbox;
