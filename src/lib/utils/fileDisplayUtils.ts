/**
 * File formatting and display utilities — shared across all file UI components.
 *
 * Extracted from FilePreviewCard, FileLightbox, FileManagerPanel, FileInMessage
 * to eliminate 4× duplication.
 */

import type { FileKind } from "@/types/files";
import { FileText, Image as ImageIcon, Film, Music, Archive, File } from "lucide-react";
import type React from "react";

// ─── File Size Formatting ────────────────────────────────────────────

/**
 * Format a byte count into a human-readable size string.
 * @example formatFileSize(1536) // "1.5 KB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── File Kind Icons & Colors ────────────────────────────────────────

/** Lucide icon component mapped by FileKind. */
export const KIND_ICONS: Record<FileKind, React.ElementType> = {
  image: ImageIcon,
  video: Film,
  audio: Music,
  document: FileText,
  text: FileText,
  archive: Archive,
  other: File,
};

/** Tailwind color class mapped by FileKind (for dark-on-light and light-on-dark). */
export const KIND_COLORS: Record<FileKind, string> = {
  image: "text-pink-500",
  video: "text-purple-500",
  audio: "text-amber-500",
  document: "text-red-500",
  text: "text-blue-500",
  archive: "text-green-500",
  other: "text-(--text-secondary)",
};

// ─── Filename Truncation ─────────────────────────────────────────────

/**
 * Truncate a filename while preserving its extension.
 * @example truncateFilename("report-final-v2.pdf", 15) // "report-fina…v2.pdf"
 */
export function truncateFilename(name: string, maxLength: number = 18): string {
  if (name.length <= maxLength) return name;

  const dotIndex = name.lastIndexOf(".");
  if (dotIndex === -1 || dotIndex === 0) {
    // No extension or hidden file — simple truncate
    return name.slice(0, maxLength - 1) + "…";
  }

  const ext = name.slice(dotIndex); // includes the dot: ".pdf"
  const base = name.slice(0, dotIndex);

  // Ensure we have room for at least a few base chars + ext
  const maxBase = maxLength - ext.length - 1; // -1 for the "…"
  if (maxBase < 3) {
    // Extension is very long — just truncate everything
    return name.slice(0, maxLength - 1) + "…";
  }

  return base.slice(0, maxBase) + "…" + ext;
}
