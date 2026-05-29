/**
 * FileLightbox — Full-screen preview modal for files.
 *
 * Supports images (full-size), text (monospace), video/audio (HTML5 players),
 * and generic files (info + download).
 */
"use client";

import React, { useEffect, useState, useCallback } from "react";
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
} from "lucide-react";
import type { FileItem } from "@/types/files";

interface FileLightboxProps {
  file: FileItem | null;
  onClose: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileLightbox({ file, onClose }: FileLightboxProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);

  // Fetch signed URL when file changes
  useEffect(() => {
    if (!file) {
      setSignedUrl(null);
      setTextContent(null);
      return;
    }

    let cancelled = false;
    fetch(`/api/files/${file.id}/url`)
      .then((r) => r.json())
      .then((data: unknown) => {
        if (cancelled) return;
        const d = data as { data?: { signedUrl?: string }; signedUrl?: string };
        const url = d.data?.signedUrl ?? d.signedUrl;
        if (url) setSignedUrl(url);
      })
      .catch(() => {});

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

  // ESC key handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <AnimatePresence>
      {file && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          {/* Header bar */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/60 to-transparent"
          >
            <div className="flex items-center gap-3 text-white/90">
              <KindIcon kind={file.kind} />
              <div className="flex flex-col">
                <span className="text-sm font-medium truncate max-w-xs">{file.filename}</span>
                <span className="text-xs text-white/50">
                  {formatFileSize(file.size_bytes)} • {file.mime_type}
                </span>
              </div>
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
                    Download
                  </a>
                  <a
                    href={signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-sm transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open
                  </a>
                </>
              )}
              <button
                onClick={onClose}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                aria-label="Close preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </motion.div>

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
                <span className="text-lg font-medium text-(--text-primary)">{file.filename}</span>
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
                <span className="text-lg font-medium text-(--text-primary)">{file.filename}</span>
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
                    Open in new tab
                  </a>
                )}
              </div>
            )}

            {/* Loading state */}
            {!signedUrl && (
              <div className="flex flex-col items-center gap-4 p-12 bg-(--surface-base) rounded-2xl shadow-2xl">
                <div className="w-12 h-12 rounded-full border-2 border-(--accent) border-t-transparent animate-spin" />
                <span className="text-sm text-(--text-secondary)">Loading preview...</span>
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
