// /app/features/chat/components/AttachmentsPanel.tsx
"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trash2,
  Eye,
  UploadCloud,
  RefreshCw,
  File as FileIcon,
  Image as ImageIcon,
  FileCode,
  FileArchive,
  FileText,
  X,
  ChevronDown,
} from "lucide-react";

interface Attachment {
  id: string;
  filename: string;
  size_bytes: number;
  mime_type: string;
  created_at?: string;
  expires_at?: string;
  conversation_id?: string;
}

interface AttachmentsPanelProps {
  conversationId: string | null;
  disabled?: boolean;
  isExpanded?: boolean;
  onToggle?: (expanded: boolean) => void;
  onCountChange?: (count: number) => void;
}

export interface AttachmentsPanelRef {
  uploadFiles: (files: FileList | File[]) => Promise<void>;
}

function formatBytes(n: number | string) {
  const num = Number(n || 0);
  if (!Number.isFinite(num)) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let v = num;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return (i === 0 ? v.toFixed(0) : v.toFixed(1)) + " " + units[i];
}

function isImageMime(mime?: string) {
  return String(mime || "").startsWith("image/");
}

function isTextMime(mime?: string) {
  const m = String(mime || "").toLowerCase();
  return (
    m.startsWith("text/") ||
    m.includes("javascript") ||
    m.includes("json") ||
    m === "application/json"
  );
}

function getFileIcon(mime?: string, filename?: string) {
  const m = String(mime || "").toLowerCase();
  const f = String(filename || "").toLowerCase();

  if (m.startsWith("image/")) return <ImageIcon className="w-4 h-4 text-purple-400" />;
  if (
    m.includes("zip") ||
    m.includes("compressed") ||
    m.includes("tar") ||
    f.endsWith(".zip") ||
    f.endsWith(".rar")
  ) {
    return <FileArchive className="w-4 h-4 text-yellow-500" />;
  }
  if (m.includes("pdf")) return <FileText className="w-4 h-4 text-red-400" />;
  if (
    m.includes("javascript") ||
    m.includes("json") ||
    m.includes("html") ||
    m.includes("css") ||
    f.endsWith(".js") ||
    f.endsWith(".jsx")
  ) {
    return <FileCode className="w-4 h-4 text-blue-400" />;
  }
  if (m.startsWith("text/")) return <FileText className="w-4 h-4 text-gray-400" />;

  return <FileIcon className="w-4 h-4 text-gray-400" />;
}

function extractClipboardImages(clipboardData: DataTransfer) {
  const out: File[] = [];
  const items = clipboardData?.items ? Array.from(clipboardData.items) : [];

  for (const item of items) {
    if (!item) continue;
    if (item.kind !== "file") continue;

    const type = String(item.type || "");
    if (!type.startsWith("image/")) continue;

    const blob = item.getAsFile?.();
    if (!blob) continue;

    const ext =
      type === "image/png"
        ? "png"
        : type === "image/webp"
          ? "webp"
          : type === "image/jpeg"
            ? "jpg"
            : "img";

    out.push(
      new File([blob], `pasted-${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`, {
        type,
      })
    );
  }

  return out;
}

const AttachmentsPanel = forwardRef<AttachmentsPanelRef, AttachmentsPanelProps>(
  ({ conversationId, disabled, isExpanded = false, onToggle, onCountChange }, ref) => {
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Drag & drop UI state
    const [dragOver, setDragOver] = useState(false);
    const dragCounterRef = useRef(0);

    const dropZoneRef = useRef<HTMLDivElement>(null);
    const [preview, setPreview] = useState<{
      kind: "image" | "text" | "other";
      filename: string;
      url?: string;
      text?: string;
    } | null>(null);
    const [error, setError] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const totalBytes = useMemo(
      () => (attachments || []).reduce((sum, a) => sum + Number(a?.size_bytes || 0), 0),
      [attachments]
    );

    // Notify parent about file count changes
    useEffect(() => {
      onCountChange?.(attachments.length);
    }, [attachments.length, onCountChange]);

    const refresh = useCallback(async () => {
      if (!conversationId) {
        setAttachments([]);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const res = await fetch(
          `/api/attachments?conversationId=${encodeURIComponent(conversationId)}`,
          {
            cache: "no-store",
          }
        );
        if (!res.ok) throw new Error("Failed to load attachments");
        const json = await res.json();
        const data = json.data || json;
        setAttachments(Array.isArray(data?.attachments) ? data.attachments : []);
      } catch (e) {
        console.error(e);
        setError("Failed to load attachments");
        setAttachments([]);
      } finally {
        setLoading(false);
      }
    }, [conversationId]);

    useEffect(() => {
      refresh();
    }, [refresh]);

    // Cross-component sync
    useEffect(() => {
      const handler = (ev: Event) => {
        const customEv = ev as CustomEvent;
        const cid = customEv?.detail?.conversationId;
        if (cid && conversationId && cid === conversationId) {
          refresh();
        }
      };
      window.addEventListener("vikini:attachments-changed", handler);
      return () => window.removeEventListener("vikini:attachments-changed", handler);
    }, [conversationId, refresh]);

    const uploadFiles = useCallback(
      async (files: FileList | File[]) => {
        if (!conversationId) return;
        const arr = Array.from(files || []).filter(Boolean);
        if (arr.length === 0) return;

        setUploading(true);
        setError("");

        // Auto-expand if uploading via drag-drop
        if (!isExpanded && onToggle) {
          onToggle(true);
        }

        try {
          for (const f of arr) {
            const form = new FormData();
            form.set("conversationId", conversationId);
            form.set("file", f);

            const res = await fetch("/api/attachments/upload", {
              method: "POST",
              body: form,
            });

            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.error?.message || json?.error || "Upload failed");
          }

          window.dispatchEvent(
            new CustomEvent("vikini:attachments-changed", { detail: { conversationId } })
          );
          await refresh();
        } catch (e: unknown) {
          console.error(e);
          const message = e instanceof Error ? e.message : "Upload failed";
          setError(message);
        } finally {
          setUploading(false);
        }
      },
      [conversationId, refresh, isExpanded, onToggle]
    );

    // Expose uploadFiles to parent
    useImperativeHandle(ref, () => ({
      uploadFiles,
    }));

    const onPickFiles = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (disabled || uploading || !conversationId) return;
      fileInputRef.current?.click?.();
    };

    const onInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e?.target?.files;
      if (files) await uploadFiles(files);
      e.target.value = "";
    };

    const onDrop = async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      dragCounterRef.current = 0;
      setDragOver(false);

      if (disabled || uploading || !conversationId) return;
      const files = e.dataTransfer?.files;
      if (files) await uploadFiles(files);
    };

    const onDragEnter = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled || uploading || !conversationId) return;

      dragCounterRef.current += 1;
      setDragOver(true);
    };

    const onDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled || uploading || !conversationId) return;
      setDragOver(true);
    };

    const onDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled || uploading || !conversationId) return;

      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
      if (dragCounterRef.current === 0) setDragOver(false);
    };

    const onPaste = useCallback(
      async (e: React.ClipboardEvent) => {
        // Only handle paste if panel is visible
        if (!isExpanded) return;
        if (disabled || uploading || !conversationId) return;

        const activeId = document?.activeElement?.id || "";
        if (activeId === "chat-input") return;

        const images = extractClipboardImages(e.clipboardData);
        if (images.length === 0) return;

        e.preventDefault();
        e.stopPropagation();
        try {
          dropZoneRef.current?.focus?.();
        } catch {
          // Ignore focus errors
        }

        await uploadFiles(images);
      },
      [isExpanded, disabled, uploading, conversationId, uploadFiles]
    );

    const doPreview = useCallback(async (a: Attachment) => {
      if (!a?.id) return;
      setError("");
      try {
        const res = await fetch(`/api/attachments/url?id=${encodeURIComponent(a.id)}`, {
          cache: "no-store",
        });
        const json = await res.json();
        const data = json.data || json;
        if (!res.ok) {
          throw new Error(json?.error?.message || json?.error || "Failed to create signed url");
        }

        const url = data?.signedUrl;
        if (!url) throw new Error("Missing signed url");

        if (isImageMime(a.mime_type)) {
          setPreview({ kind: "image", filename: a.filename, url });
          return;
        }

        if (isTextMime(a.mime_type)) {
          const tRes = await fetch(url, { cache: "no-store" });
          const text = await tRes.text();
          setPreview({ kind: "text", filename: a.filename, text });
          return;
        }

        setPreview({ kind: "other", filename: a.filename, url });
      } catch (e: unknown) {
        console.error(e);
        const message = e instanceof Error ? e.message : "Preview failed";
        setError(message);
      }
    }, []);

    const doDelete = useCallback(
      async (a: Attachment) => {
        if (!a?.id) return;
        setError("");
        try {
          const res = await fetch(`/api/attachments?id=${encodeURIComponent(a.id)}`, {
            method: "DELETE",
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json?.error?.message || json?.error || "Delete failed");

          window.dispatchEvent(
            new CustomEvent("vikini:attachments-changed", { detail: { conversationId } })
          );
          await refresh();
        } catch (e: unknown) {
          console.error(e);
          const message = e instanceof Error ? e.message : "Delete failed";
          setError(message);
        }
      },
      [conversationId, refresh]
    );

    const doDeleteAll = useCallback(
      async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!conversationId) return;
        if ((attachments || []).length === 0) return;

        if (!window.confirm("Delete all files?")) return;

        setError("");
        try {
          const res = await fetch(
            `/api/attachments?conversationId=${encodeURIComponent(conversationId)}`,
            {
              method: "DELETE",
            }
          );
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json?.error?.message || json?.error || "Delete all failed");

          window.dispatchEvent(
            new CustomEvent("vikini:attachments-changed", { detail: { conversationId } })
          );
          await refresh();
        } catch (e: unknown) {
          console.error(e);
          const message = e instanceof Error ? e.message : "Delete all failed";
          setError(message);
        }
      },
      [conversationId, attachments, refresh]
    );

    if (!conversationId) {
      return null;
    }

    const hasFiles = attachments.length > 0;

    return (
      <>
        <div className="px-4">
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                layout
                initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                animate={{ height: "auto", opacity: 1, marginBottom: 16 }}
                exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                className="overflow-hidden"
              >
                <div
                  ref={dropZoneRef}
                  tabIndex={0}
                  onPaste={onPaste}
                  onDrop={onDrop}
                  onDragEnter={onDragEnter}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  className={`relative rounded-2xl border bg-neutral-950 transition-colors ${
                    dragOver ? "border-purple-500/50 bg-purple-500/5" : "border-neutral-800"
                  }`}
                >
                  {/* Drag Overlay */}
                  <AnimatePresence>
                    {dragOver && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl bg-neutral-950/80 backdrop-blur-sm border-2 border-purple-500/50"
                      >
                        <UploadCloud className="w-10 h-10 text-purple-400 mb-2 animate-bounce" />
                        <span className="text-sm font-semibold text-purple-100">
                          Drop files to upload
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="p-4">
                    {/* Toolbar */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-[10px] uppercase tracking-wider font-semibold text-secondary flex items-center gap-2">
                        <span>Attached Files</span>
                        {hasFiles && (
                          <span className="px-1.5 py-0.5 rounded bg-surface-elevated text-secondary">
                            {attachments.length} • {formatBytes(totalBytes)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={refresh}
                          title="Refresh"
                          className="p-1.5 rounded-md hover:bg-control-hover text-secondary hover:text-primary transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        {hasFiles && (
                          <button
                            onClick={doDeleteAll}
                            title="Delete All"
                            className="p-1.5 rounded-md hover:bg-red-900/20 text-secondary hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <div className="w-px h-3 bg-[var(--border)] mx-1" />
                        <button
                          onClick={onPickFiles}
                          disabled={uploading}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-accent hover:brightness-110 text-[var(--surface)] text-xs font-semibold transition-colors disabled:opacity-50 shadow-[0_0_10px_var(--glow)]"
                        >
                          {uploading ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>Uploading...</span>
                            </>
                          ) : (
                            <>
                              <UploadCloud className="w-3 h-3" />
                              <span>Upload</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                      <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                        {error}
                      </div>
                    )}

                    {/* File Grid */}
                    {hasFiles ? (
                      <div className="space-y-1 max-h-[240px] overflow-y-auto custom-scrollbar pr-1">
                        {attachments.map((a) => (
                          <motion.div
                            key={a.id}
                            layout
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="group flex items-center gap-3 p-2.5 rounded-xl border border-transparent hover:border-token bg-surface-elevated hover:bg-control-hover transition-all"
                          >
                            {/* Icon */}
                            <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-surface border border-token shadow-sm">
                              {getFileIcon(a.mime_type, a.filename)}
                            </div>

                            {/* Info */}
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-xs font-medium text-secondary group-hover:text-primary transition-colors">
                                {a.filename}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-secondary">
                                <span>{formatBytes(a.size_bytes)}</span>
                                <span className="w-0.5 h-0.5 rounded-full bg-[var(--border)]" />
                                <span className="uppercase">
                                  {a.mime_type.split("/")[1] || "FILE"}
                                </span>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => doPreview(a)}
                                className="p-1.5 rounded-md hover:bg-control-hover text-secondary hover:text-primary transition-colors"
                                title="Preview"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => doDelete(a)}
                                className="p-1.5 rounded-md hover:bg-red-900/20 text-secondary hover:text-red-400 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div
                        onClick={onPickFiles}
                        className="cursor-pointer flex flex-col items-center justify-center py-8 text-center border border-dashed border-token rounded-xl bg-surface-elevated hover:bg-control-hover transition-all"
                      >
                        <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center mb-3">
                          <UploadCloud className="w-5 h-5 text-secondary" />
                        </div>
                        <div className="text-sm font-medium text-secondary">Drop files here</div>
                        <div className="text-xs text-secondary mt-1">or click to browse</div>
                      </div>
                    )}

                    {/* Hidden Input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={onInputChange}
                    />
                  </div>

                  {/* Close Toggle (Bottom) */}
                  <div
                    onClick={() => onToggle?.(false)}
                    className="flex items-center justify-center py-1.5 border-t border-token bg-surface hover:bg-surface-muted cursor-pointer transition-colors"
                  >
                    <ChevronDown className="w-4 h-4 text-secondary" />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Preview Modal ... */}
        <AnimatePresence>
          {preview && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--surface)_85%,black)] backdrop-blur-sm p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl bg-surface-elevated border border-token shadow-2xl overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-token bg-surface-elevated">
                  <div className="truncate text-sm font-medium text-primary">
                    {preview.filename}
                  </div>
                  <button
                    onClick={() => setPreview(null)}
                    className="p-1 rounded-full hover:bg-control-hover text-secondary transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-auto p-4 bg-surface">
                  {preview.kind === "image" ? (
                    <img
                      src={preview.url}
                      alt={preview.filename}
                      className="max-w-full h-auto mx-auto rounded-lg"
                    />
                  ) : preview.kind === "text" ? (
                    <pre className="whitespace-pre-wrap break-words text-xs text-secondary font-mono bg-surface p-4 rounded-lg border border-token">
                      {preview.text}
                    </pre>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48 gap-4">
                      <FileIcon className="w-12 h-12 text-secondary" />
                      <a
                        href={preview.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 rounded-lg bg-accent text-[var(--surface)] text-xs font-bold hover:brightness-110 transition-colors"
                      >
                        Download / Open File
                      </a>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </>
    );
  }
);

AttachmentsPanel.displayName = "AttachmentsPanel";

export default AttachmentsPanel;
