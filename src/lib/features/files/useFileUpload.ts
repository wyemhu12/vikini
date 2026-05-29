/**
 * useFileUpload — Unified upload logic hook.
 *
 * Consolidates ALL upload entry points into a single hook:
 * - File picker (via "+" button)
 * - Drag & drop (single window-level handler)
 * - Clipboard paste (single global handler)
 * - Per-file upload progress via XHR
 *
 * Replaces: useFileDragDrop + AttachmentsPanel upload + InputForm upload
 */

"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useFileStore } from "./store";
import type { FileKind, FileUploadProgress } from "@/types/files";

interface UseFileUploadOptions {
  conversationId: string | null;
  disabled?: boolean;
  /** Called after each successful upload — typically triggers SWR mutate */
  onUploadComplete?: () => void;
}

/** Client-side file kind classification for immediate UI feedback */
function classifyClientSide(ext: string, mime: string): FileKind {
  if (
    mime.startsWith("image/") ||
    ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "ico"].includes(ext)
  ) {
    return "image";
  }
  if (mime.startsWith("video/") || ["mp4", "mov", "webm", "avi", "mkv"].includes(ext)) {
    return "video";
  }
  if (mime.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a", "flac", "aac"].includes(ext)) {
    return "audio";
  }
  if (["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext)) {
    return "document";
  }
  if (["zip", "tar", "gz", "7z", "rar"].includes(ext)) {
    return "archive";
  }
  if (
    mime.startsWith("text/") ||
    [
      "txt",
      "md",
      "json",
      "csv",
      "xml",
      "yaml",
      "yml",
      "html",
      "css",
      "js",
      "ts",
      "tsx",
      "jsx",
      "py",
      "rs",
      "go",
      "java",
      "c",
      "cpp",
      "h",
      "rb",
      "php",
      "sh",
      "log",
      "toml",
      "ini",
      "cfg",
      "scss",
      "less",
      "sql",
      "env",
    ].includes(ext)
  ) {
    return "text";
  }
  return "other";
}

/** File input accept attribute — all supported types */
const FILE_ACCEPT = [
  "image/*",
  "video/*",
  "audio/*",
  ".pdf",
  ".doc",
  ".docx",
  ".txt",
  ".md",
  ".json",
  ".csv",
  ".xml",
  ".html",
  ".css",
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
  ".py",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".go",
  ".rs",
  ".rb",
  ".php",
  ".sql",
  ".sh",
  ".yaml",
  ".yml",
  ".toml",
  ".ini",
  ".cfg",
  ".log",
  ".zip",
  ".mp4",
  ".mov",
  ".webm",
  ".mp3",
  ".wav",
  ".ogg",
  ".m4a",
].join(",");

export function useFileUpload({
  conversationId,
  disabled,
  onUploadComplete,
}: UseFileUploadOptions) {
  const { addToQueue, updateProgress, setStatus, removeFromQueue, clearQueue } = useFileStore();

  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // === File Picker ===
  const openFilePicker = useCallback(() => {
    if (disabled || !conversationId) return;
    fileInputRef.current?.click();
  }, [disabled, conversationId]);

  // === Core Upload (XHR for per-file progress) ===
  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      if (disabled || !conversationId) return;
      const fileArray = Array.from(files);

      for (const file of fileArray) {
        const tempId = crypto.randomUUID();
        const ext = file.name.split(".").pop()?.toLowerCase() || "";
        const kind = classifyClientSide(ext, file.type);

        const queueItem: FileUploadProgress = {
          tempId,
          file,
          filename: file.name,
          size: file.size,
          kind,
          progress: 0,
          status: "uploading",
        };
        addToQueue(queueItem);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("conversationId", conversationId);

        try {
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.upload.onprogress = (e: ProgressEvent) => {
              if (e.lengthComputable) {
                updateProgress(tempId, Math.round((e.loaded / e.total) * 100));
              }
            };

            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                setStatus(tempId, "ready");
                // Brief "ready" flash before removing from queue
                setTimeout(() => removeFromQueue(tempId), 600);
                resolve();
              } else {
                let msg = "Upload failed";
                try {
                  const body: unknown = JSON.parse(xhr.responseText);
                  if (typeof body === "object" && body !== null && "error" in body) {
                    msg = String((body as { error: string }).error);
                  }
                } catch {
                  /* use default */
                }
                reject(new Error(msg));
              }
            };

            xhr.onerror = () => reject(new Error("Network error"));
            xhr.ontimeout = () => reject(new Error("Upload timed out"));
            xhr.timeout = 120_000; // 2 minutes

            xhr.open("POST", "/api/files/upload");
            xhr.send(formData);
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Upload failed";
          setStatus(tempId, "error", msg);
          // Auto-dismiss error after 5 seconds
          setTimeout(() => removeFromQueue(tempId), 5000);
        }
      }
      onUploadComplete?.();
    },
    [
      conversationId,
      disabled,
      addToQueue,
      updateProgress,
      setStatus,
      removeFromQueue,
      onUploadComplete,
    ]
  );

  // === Handle file input change ===
  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) {
        uploadFiles(e.target.files);
      }
      // Reset input so same file can be re-uploaded
      e.target.value = "";
    },
    [uploadFiles]
  );

  // === Drag & Drop (single window-level handler) ===
  useEffect(() => {
    if (disabled) return;

    const onDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current++;
      if (e.dataTransfer?.types.includes("Files")) {
        setIsDragging(true);
      }
    };

    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current--;
      if (dragCounter.current <= 0) {
        dragCounter.current = 0;
        setIsDragging(false);
      }
    };

    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDragging(false);
      if (e.dataTransfer?.files.length) {
        uploadFiles(e.dataTransfer.files);
      }
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);

    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [disabled, uploadFiles]);

  // === Paste (single global handler) ===
  useEffect(() => {
    if (disabled) return;

    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (const item of Array.from(items)) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) {
            // Rename screenshots with timestamp
            const isScreenshot = file.name === "image.png" || file.name.startsWith("blob");
            if (isScreenshot) {
              const ext = file.name.split(".").pop() || "png";
              const renamed = new File([file], `screenshot-${Date.now()}.${ext}`, {
                type: file.type,
              });
              files.push(renamed);
            } else {
              files.push(file);
            }
          }
        }
      }

      if (files.length > 0) {
        e.preventDefault();
        uploadFiles(files);
      }
    };

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [disabled, uploadFiles]);

  // === Clear queue on conversation change ===
  useEffect(() => {
    clearQueue();
  }, [conversationId, clearQueue]);

  return {
    /** Open native file picker */
    openFilePicker,
    /** Upload files programmatically */
    uploadFiles,
    /** Whether files are being dragged over the window */
    isDragging,
    /** Ref for hidden file input element */
    fileInputRef,
    /** Accept attribute for file input */
    fileAccept: FILE_ACCEPT,
    /** Handle file input change event */
    handleFileInputChange,
    /** Whether any uploads are in progress */
    isUploading: useFileStore((s) => s.uploadQueue.some((q) => q.status === "uploading")),
  };
}
