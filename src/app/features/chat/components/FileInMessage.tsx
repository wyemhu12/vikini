/**
 * FileInMessage — Compact file indicator for chat bubbles.
 *
 * Shows file cards inline within user messages.
 * Filters by specific fileIds attached to that message.
 */
"use client";

import React from "react";
import { File } from "lucide-react";
import { useFiles } from "@/lib/features/files/useFiles";
import type { FileItem } from "@/types/files";
import { formatFileSize, KIND_ICONS } from "@/lib/utils/fileDisplayUtils";

interface FileInMessageProps {
  conversationId: string;
  fileIds?: string[];
  onClick?: (file: FileItem) => void;
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
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--surface)]/15 hover:bg-[var(--surface)]/25 text-xs transition-colors max-w-[200px] group"
          >
            <Icon className="w-3.5 h-3.5 shrink-0 opacity-70" />
            <span className="truncate">{file.filename}</span>
            <span className="shrink-0 opacity-50 text-[9px]">
              {formatFileSize(file.size_bytes)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default FileInMessage;
