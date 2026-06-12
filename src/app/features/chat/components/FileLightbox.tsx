/**
 * FileLightbox — Full-screen preview modal for files.
 *
 * Supports images (full-size), text (monospace), video/audio (HTML5 players),
 * and generic files (info + download).
 */
"use client";

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

interface FileLightboxProps {
  file: FileItem | null;
  onClose: () => void;
  /** All files in the conversation for navigation */
  files?: FileItem[];
  /** Called when user navigates to a different file */
  onNavigate?: (file: FileItem) => void;
  /** Translation strings */
  t?: Record<string, string>;
}

export function FileLightbox({ file, onClose, files, onNavigate, t }: FileLightboxProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // ─── Navigation helpers ──────────────────────────────────────────────

  const currentIndex = useMemo(() => {
    if (!file || !files?.length) return -1;
    return files.findIndex((f) => f.id === file.id);
  }, [file, files]);

  const hasPrev = currentIndex > 0;
  const hasNext = files ? currentIndex < files.length - 1 : false;

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

  // ─── Fetch signed URL ────────────────────────────────────────────────

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
      .catch(() => {
        if (!cancelled) setFetchError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [file]);

  // Fetch text content for text files
  useEffect(() => {
    if (!file || file.kind !== "text" || !signedUrl) return;

    let cancelled = false;
    fetch(signedUrl)
      .then((r) => r.text())
      .then((text) => {
        if (!cancelled) setTextContent(text.slice(0, 50_000));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [file, signedUrl]);

  // ─── Focus trap & keyboard handling ──────────────────────────────────

  // Focus the container on mount
  useEffect(() => {
    if (file && containerRef.current) {
      containerRef.current.focus();
    }
  }, [file]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        navigatePrev();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        navigateNext();
        return;
      }

      // Focus trap: Tab wrapping
      if (e.key === "Tab" && containerRef.current) {
        const focusable = containerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    },
    [onClose, navigatePrev, navigateNext]
  );

  // ─── Retry handler ──────────────────────────────────────────────────

  const handleRetry = useCallback(() => {
    if (!file) return;
    setFetchError(false);
    setSignedUrl(null);

    fetch(`/api/files/${file.id}/url`)
      .then((r) => r.json())
      .then((data: unknown) => {
        const d = data as { data?: { signedUrl?: string }; signedUrl?: string };
        const url = d.data?.signedUrl ?? d.signedUrl;
        if (url) {
          setSignedUrl(url);
        } else {
          setFetchError(true);
        }
      })
      .catch(() => {
        setFetchError(true);
      });
  }, [file]);

  return (
    <AnimatePresence>
      {file && (
        <motion.div
          ref={containerRef}
          tabIndex={-1}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm outline-none"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          onKeyDown={handleKeyDown}
        >
          {/* Header bar */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/60 to-transparent"
          >
            <div className="flex items-center gap-3 text-white/90 min-w-0">
              <KindIcon kind={file.kind} />
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium truncate max-w-xs" title={file.filename}>
                  {file.filename}
                </span>
                <span className="text-xs text-white/50">
                  {formatFileSize(file.size_bytes)} • {file.mime_type}
                </span>
              </div>

              {/* File counter badge */}
              {files && files.length > 1 && currentIndex >= 0 && (
                <span className="ml-2 px-2 py-0.5 rounded-full bg-white/15 text-white/70 text-xs font-medium tabular-nums">
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
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-sm transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    {t?.fileDownload ?? "Download"}
                  </a>
                  <a
                    href={signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-sm transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {t?.fileOpen ?? "Open"}
                  </a>
                </>
              )}
              <button
                ref={closeButtonRef}
                onClick={onClose}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                aria-label={t?.fileClosePreview ?? "Close preview"}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </motion.div>

          {/* Previous file button */}
          {hasPrev && (
            <button
              onClick={navigatePrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
              aria-label={t?.filePrev ?? "Previous file"}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Next file button */}
          {hasNext && (
            <button
              onClick={navigateNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
              aria-label={t?.fileNext ?? "Next file"}
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Content area */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="max-w-[90vw] max-h-[80vh] overflow-auto"
          >
            {file.kind === "image" && signedUrl && (
              <img
                src={signedUrl}
                alt={file.filename}
                className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
              />
            )}

            {file.kind === "video" && signedUrl && (
              <video
                src={signedUrl}
                controls
                autoPlay={false}
                className="max-w-full max-h-[80vh] rounded-lg shadow-2xl"
              />
            )}

            {file.kind === "audio" && signedUrl && (
              <div className="flex flex-col items-center gap-6 p-12 bg-(--surface-base) rounded-2xl shadow-2xl">
                <Music className="w-16 h-16 text-amber-500" />
                <span
                  className="text-lg font-medium text-(--text-primary) truncate max-w-sm"
                  title={file.filename}
                >
                  {file.filename}
                </span>
                <audio src={signedUrl} controls className="w-full max-w-md" />
              </div>
            )}

            {file.kind === "text" && textContent !== null && (
              <pre className="p-6 bg-(--surface-base) rounded-lg shadow-2xl text-sm text-(--text-primary) font-mono whitespace-pre-wrap break-words max-w-3xl overflow-auto">
                {textContent}
              </pre>
            )}

            {(file.kind === "document" || file.kind === "archive" || file.kind === "other") && (
              <div className="flex flex-col items-center gap-4 p-12 bg-(--surface-base) rounded-2xl shadow-2xl">
                <KindIcon kind={file.kind} large />
                <span
                  className="text-lg font-medium text-(--text-primary) truncate max-w-sm"
                  title={file.filename}
                >
                  {file.filename}
                </span>
                <span className="text-sm text-(--text-secondary)">
                  {formatFileSize(file.size_bytes)} • {file.mime_type}
                </span>
                {signedUrl && (
                  <a
                    href={signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-(--accent) text-white rounded-lg hover:brightness-110 transition-all mt-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {t?.fileOpenInNewTab ?? "Open in new tab"}
                  </a>
                )}
              </div>
            )}

            {/* Error state */}
            {fetchError && !signedUrl && (
              <div className="flex flex-col items-center gap-4 p-12 bg-(--surface-base) rounded-2xl shadow-2xl">
                <AlertCircle className="w-12 h-12 text-(--danger)" />
                <span className="text-sm text-(--text-secondary)">
                  {t?.fileLoadFailed ?? "Failed to load file"}
                </span>
                <button
                  onClick={handleRetry}
                  className="flex items-center gap-2 px-4 py-2 bg-(--accent) text-white rounded-lg hover:brightness-110 transition-all text-sm"
                >
                  <RotateCcw className="w-4 h-4" />
                  {t?.fileRetry ?? "Retry"}
                </button>
              </div>
            )}

            {/* Loading state */}
            {!signedUrl && !fetchError && (
              <div className="flex flex-col items-center gap-4 p-12 bg-(--surface-base) rounded-2xl shadow-2xl">
                <div className="w-12 h-12 rounded-full border-2 border-(--accent) border-t-transparent animate-spin" />
                <span className="text-sm text-(--text-secondary)">
                  {t?.fileLoadingPreview ?? "Loading preview..."}
                </span>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function KindIcon({ kind, large = false }: { kind: string; large?: boolean }) {
  const size = large ? "w-16 h-16" : "w-5 h-5";
  switch (kind) {
    case "image":
      return <ImageIcon className={`${size} text-pink-500`} />;
    case "video":
      return <Film className={`${size} text-purple-500`} />;
    case "audio":
      return <Music className={`${size} text-amber-500`} />;
    case "document":
      return <FileText className={`${size} text-red-500`} />;
    case "text":
      return <FileText className={`${size} text-blue-500`} />;
    default:
      return <File className={`${size} text-(--text-secondary)`} />;
  }
}

export default FileLightbox;
