// /app/features/chat/components/FileManagerPanel.tsx
"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  File,
  X,
  Trash2,
  Loader2,
  FolderOpen,
} from "lucide-react";

import { useFiles } from "@/lib/features/files/useFiles";
import type { FileItem, FileKind } from "@/types/files";

// ─── Types ───────────────────────────────────────────────────────────

interface FileManagerPanelProps {
  conversationId: string;
  isOpen: boolean;
  onClose: () => void;
  t?: Record<string, string>;
}

// ─── Constants ───────────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelativeDate(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return "yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(isoDate).toLocaleDateString();
}

// ─── Component ───────────────────────────────────────────────────────

export default function FileManagerPanel({
  conversationId,
  isOpen,
  onClose,
  t,
}: FileManagerPanelProps) {
  const { files, isLoading, mutate } = useFiles(conversationId);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = useCallback(
    async (fileId: string) => {
      setDeletingId(fileId);
      try {
        const res = await fetch(`/api/files?id=${fileId}`, { method: "DELETE" });
        if (res.ok) {
          await mutate();
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to delete file";
        console.error("[FileManagerPanel] delete error:", message);
      } finally {
        setDeletingId(null);
      }
    },
    [mutate]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop overlay */}
          <motion.div
            key="file-manager-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Slide-in panel */}
          <motion.aside
            key="file-manager-panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="fixed top-0 right-0 z-50 h-full w-80 flex flex-col bg-[var(--surface)]/95 backdrop-blur-xl border-l border-(--control-border) shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-(--control-border)">
              <h2 className="text-sm font-bold text-(--text-primary) tracking-wide uppercase flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-(--accent)" />
                {t?.files ?? "Files"}{" "}
                <span className="text-(--text-secondary) font-normal">({files.length})</span>
              </h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-(--control-bg-hover) text-(--text-secondary) hover:text-(--text-primary) transition-colors"
                aria-label="Close file manager"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* File list */}
            <div className="flex-1 overflow-y-auto px-3 py-2 scrollbar-thin">
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-5 h-5 animate-spin text-(--accent)" />
                </div>
              ) : files.length === 0 ? (
                /* Empty state */
                <div className="flex flex-col items-center justify-center h-48 gap-3 text-(--text-secondary)">
                  <FolderOpen className="w-10 h-10 opacity-30" />
                  <p className="text-xs font-medium">{t?.noFilesUploaded ?? "No files uploaded"}</p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {files.map((file) => (
                    <FileListItem
                      key={file.id}
                      file={file}
                      isDeleting={deletingId === file.id}
                      onDelete={handleDelete}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── File List Item ──────────────────────────────────────────────────

interface FileListItemProps {
  file: FileItem;
  isDeleting: boolean;
  onDelete: (id: string) => void;
  onClick?: (file: FileItem) => void;
}

function FileListItem({ file, isDeleting, onDelete, onClick }: FileListItemProps) {
  const Icon = KIND_ICONS[file.kind] ?? File;
  const iconColor = KIND_COLORS[file.kind] ?? "text-(--text-secondary)";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
      className="group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-(--control-bg) transition-colors mb-1"
    >
      {/* Kind icon */}
      <div className="shrink-0">
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>

      {/* File info */}
      <button type="button" className="flex-1 min-w-0 text-left" onClick={() => onClick?.(file)}>
        <p className="text-xs font-medium text-(--text-primary) truncate" title={file.filename}>
          {file.filename}
        </p>
        <p className="text-[10px] text-(--text-secondary) mt-0.5">
          {formatFileSize(file.size_bytes)} · {formatRelativeDate(file.created_at)}
        </p>
      </button>

      {/* Delete button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(file.id);
        }}
        disabled={isDeleting}
        className="shrink-0 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/15 text-(--text-secondary) hover:text-red-500 disabled:opacity-50"
        aria-label={`Delete ${file.filename}`}
      >
        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
      </button>
    </motion.div>
  );
}
