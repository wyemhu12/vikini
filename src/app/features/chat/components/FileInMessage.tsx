/**
 * FileInMessage - Compact file indicator for chat bubbles.
 *
 * Shows attached files inline within user messages, displaying miniature image
 * thumbnails (preferring cached local blob previews, then lazy signed URLs)
 * with graceful icon fallback and accessible focus/press feedback.
 */
"use client";

import React, { useEffect, useState } from "react";
import { File, Image as ImageIcon } from "lucide-react";
import { useFiles } from "@/lib/features/files/useFiles";
import { useFileStore } from "@/lib/features/files/store";
import type { FileItem } from "@/types/files";
import { formatFileSize, KIND_ICONS } from "@/lib/utils/fileDisplayUtils";

interface FileInMessageProps {
  conversationId: string;
  fileIds?: string[];
  onClick?: (file: FileItem) => void;
}

function MessageImageThumb({
  fileId,
  initialSrc,
  alt,
}: {
  fileId: string;
  initialSrc?: string;
  alt: string;
}) {
  const [remoteSrc, setRemoteSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (initialSrc) return;
    let cancelled = false;
    fetch(`/api/files/${fileId}/url`)
      .then((r) => r.json())
      .then((data: unknown) => {
        if (!cancelled && typeof data === "object" && data !== null) {
          const d = data as { data?: { signedUrl?: string }; signedUrl?: string };
          const url = d.data?.signedUrl ?? d.signedUrl;
          if (url) setRemoteSrc(url);
          else setError(true);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [fileId, initialSrc]);

  const src = initialSrc ?? remoteSrc;
  if (error || !src) {
    return <ImageIcon aria-hidden="true" className="w-3.5 h-3.5 shrink-0 opacity-70" />;
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setError(true)}
      className="h-7 w-7 shrink-0 rounded object-cover border border-(--line)/60"
      loading="lazy"
    />
  );
}

export function FileInMessage({ conversationId, fileIds, onClick }: FileInMessageProps) {
  const { files } = useFiles(conversationId);
  const localPreviewByFileId = useFileStore((s) => s.localPreviewByFileId);

  const messageFiles = fileIds ? files.filter((f) => fileIds.includes(f.id)) : [];

  if (messageFiles.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mb-2 min-w-0 max-w-full">
      {messageFiles.map((file) => {
        const Icon = KIND_ICONS[file.kind] ?? File;
        const isImage = file.kind === "image";
        return (
          <button
            key={file.id}
            type="button"
            onClick={() => onClick?.(file)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-(--surface)/40 hover:bg-(--surface)/70 border border-(--line)/60 text-xs transition-[background-color,transform] duration-150 active:scale-[0.97] max-w-[min(220px,100%)] min-w-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
          >
            {isImage ? (
              <MessageImageThumb
                fileId={file.id}
                initialSrc={localPreviewByFileId[file.id]}
                alt={file.filename}
              />
            ) : (
              <Icon aria-hidden="true" className="w-3.5 h-3.5 shrink-0 opacity-70" />
            )}
            <span className="truncate">{file.filename}</span>
            <span className="shrink-0 opacity-60 text-xs tabular-nums">
              {formatFileSize(file.size_bytes)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default FileInMessage;
