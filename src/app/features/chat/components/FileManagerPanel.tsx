// /app/features/chat/components/FileManagerPanel.tsx
"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
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
  image: "text-pink-400",
  video: "text-purple-400",
  audio: "text-amber-400",
  document: "text-red-400",
  text: "text-blue-400",
  archive: "text-green-400",
  other: "text-[var(--text-secondary)]",
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
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay listener to avoid instant close from toggle button click
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

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
        <motion.div
          ref={panelRef}
          key="file-manager-dropdown"
          initial={{ opacity: 0, y: -8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="absolute bottom-full right-0 mb-2 w-72 sm:w-80 max-h-80 z-50 rounded-2xl bg-[var(--surface)] border border-[var(--control-border)] shadow-2xl shadow-black/30 backdrop-blur-xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--control-border)]">
            <span className="text-xs font-bold text-[var(--text-primary)] tracking-wide uppercase">
              {t?.files ?? "Files"}{" "}
              <span className="text-[var(--text-secondary)] font-normal">({files.length})</span>
            </span>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-[var(--control-bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* File list */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-1.5 py-1.5 scrollbar-thin">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-4 h-4 animate-spin text-[var(--accent)]" />
              </div>
            ) : files.length === 0 ? (
              <div className="flex items-center justify-center py-6 text-[var(--text-secondary)]">
                <p className="text-[11px]">{t?.noFilesUploaded ?? "No files in this chat"}</p>
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── File List Item ──────────────────────────────────────────────────

interface FileListItemProps {
  file: FileItem;
  isDeleting: boolean;
  onDelete: (id: string) => void;
}

function FileListItem({ file, isDeleting, onDelete }: FileListItemProps) {
  const Icon = KIND_ICONS[file.kind] ?? File;
  const iconColor = KIND_COLORS[file.kind] ?? "text-[var(--text-secondary)]";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 20, transition: { duration: 0.15 } }}
      className="group flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-[var(--control-bg)] transition-colors"
    >
      {/* Kind icon */}
      <div className="shrink-0">
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <p
          className="text-[11px] font-medium text-[var(--text-primary)] truncate"
          title={file.filename}
        >
          {file.filename}
        </p>
        <p className="text-[9px] text-[var(--text-secondary)] mt-0.5">
          {formatFileSize(file.size_bytes)} · {formatRelativeDate(file.created_at)}
        </p>
      </div>

      {/* Delete button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(file.id);
        }}
        disabled={isDeleting}
        className="shrink-0 p-1 rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all hover:bg-red-500/15 text-[var(--text-secondary)] hover:text-red-500 disabled:opacity-50"
        aria-label={`Delete ${file.filename}`}
      >
        {isDeleting ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Trash2 className="w-3.5 h-3.5" />
        )}
      </button>
    </motion.div>
  );
}
