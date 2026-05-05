// /app/features/chat/components/FileChips.tsx
"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  File as FileIcon,
  Image as ImageIcon,
  Video,
  Music,
  FileText,
  FileCode,
  FileArchive,
  Loader2,
  Zap,
} from "lucide-react";

interface FileChip {
  id: string;
  filename: string;
  size_bytes: number;
  mime_type: string;
  kind?: string;
  gemini_ready?: boolean;
  status?: "uploading" | "processing" | "ready" | "error";
}

interface FileChipsProps {
  files: FileChip[];
  onRemove: (id: string) => void;
  disabled?: boolean;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getChipIcon(kind?: string, mime?: string) {
  const k = kind || "";
  const m = String(mime || "").toLowerCase();

  if (k === "image" || m.startsWith("image/")) return <ImageIcon className="w-3.5 h-3.5" />;
  if (k === "video" || m.startsWith("video/")) return <Video className="w-3.5 h-3.5" />;
  if (k === "audio" || m.startsWith("audio/")) return <Music className="w-3.5 h-3.5" />;
  if (k === "document" || m.includes("pdf")) return <FileText className="w-3.5 h-3.5" />;
  if (k === "text" || m.startsWith("text/")) return <FileCode className="w-3.5 h-3.5" />;
  if (k === "archive" || m.includes("zip")) return <FileArchive className="w-3.5 h-3.5" />;
  return <FileIcon className="w-3.5 h-3.5" />;
}

function getChipColor(kind?: string): string {
  switch (kind) {
    case "image":
      return "text-purple-400 bg-purple-400/10 border-purple-400/20";
    case "video":
      return "text-pink-400 bg-pink-400/10 border-pink-400/20";
    case "audio":
      return "text-cyan-400 bg-cyan-400/10 border-cyan-400/20";
    case "document":
      return "text-red-400 bg-red-400/10 border-red-400/20";
    case "text":
      return "text-blue-400 bg-blue-400/10 border-blue-400/20";
    case "archive":
      return "text-yellow-500 bg-yellow-500/10 border-yellow-500/20";
    default:
      return "text-gray-400 bg-gray-400/10 border-gray-400/20";
  }
}

function truncateFilename(name: string, maxLen = 20): string {
  if (name.length <= maxLen) return name;
  const ext = name.lastIndexOf(".") !== -1 ? name.slice(name.lastIndexOf(".")) : "";
  const base = name.slice(0, name.length - ext.length);
  const truncBase = base.slice(0, maxLen - ext.length - 3) + "...";
  return truncBase + ext;
}

export default function FileChips({ files, onRemove, disabled }: FileChipsProps) {
  if (files.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 px-3 pt-2 pb-1">
      <AnimatePresence mode="popLayout">
        {files.map((file) => {
          const isUploading = file.status === "uploading";
          const isError = file.status === "error";
          const colorClass = isError
            ? "text-red-400 bg-red-400/10 border-red-400/30"
            : getChipColor(file.kind);

          return (
            <motion.div
              key={file.id}
              initial={{ opacity: 0, scale: 0.8, y: 5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -5 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={`
                inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border
                text-[11px] font-medium max-w-[200px] group
                ${colorClass}
                ${isUploading ? "animate-pulse" : ""}
              `}
            >
              {/* Icon */}
              {isUploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : (
                <span className="shrink-0">{getChipIcon(file.kind, file.mime_type)}</span>
              )}

              {/* Filename + Size */}
              <span className="truncate">{truncateFilename(file.filename)}</span>
              <span className="text-[9px] opacity-60 shrink-0">{formatBytes(file.size_bytes)}</span>

              {/* Gemini badge */}
              {file.gemini_ready && (
                <span className="shrink-0" title="Gemini-ready">
                  <Zap className="w-3 h-3 text-amber-400" />
                </span>
              )}

              {/* Remove button */}
              {!disabled && !isUploading && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(file.id);
                  }}
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 hover:text-red-400"
                  aria-label={`Remove ${file.filename}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
