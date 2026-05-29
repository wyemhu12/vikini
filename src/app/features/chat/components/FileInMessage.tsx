/**
 * FileInMessage — Compact file indicator for chat bubbles.
 *
 * Shows file cards inline within user messages.
 * Filters by specific fileIds attached to that message.
 */
"use client";

import React from "react";
import { FileText, Image, Video, Music, Archive, File } from "lucide-react";
import { useFiles } from "@/lib/features/files/useFiles";
import type { FileItem } from "@/types/files";

interface FileInMessageProps {
  conversationId: string;
  fileIds?: string[];
  onClick?: (file: FileItem) => void;
}

const KIND_ICONS: Record<string, React.ElementType> = {
  document: FileText,
  text: FileText,
  image: Image,
  video: Video,
  audio: Music,
  archive: Archive,
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileInMessage({ conversationId, fileIds, onClick }: FileInMessageProps) {
  const { files } = useFiles(conversationId);

  // Filter files by IDs attached to this specific message
  const messageFiles = fileIds ? files.filter((f) => fileIds.includes(f.id)) : [];

  if (messageFiles.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {messageFiles.map((file) => {
        const Icon = KIND_ICONS[file.kind] ?? File;
        return (
          <button
            key={file.id}
            type="button"
            onClick={() => onClick?.(file)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] transition-colors max-w-[200px] group"
          >
            <Icon className="w-3.5 h-3.5 shrink-0 opacity-70" />
            <span className="truncate">{file.filename}</span>
            <span className="shrink-0 opacity-50 text-[9px]">{formatSize(file.size_bytes)}</span>
          </button>
        );
      })}
    </div>
  );
}

export default FileInMessage;
