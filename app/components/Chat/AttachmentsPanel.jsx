"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function formatBytes(n) {
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

function isImageMime(mime) {
  return String(mime || "").startsWith("image/");
}

function isTextMime(mime) {
  const m = String(mime || "").toLowerCase();
  return m.startsWith("text/") || m.includes("javascript") || m.includes("json") || m === "application/json";
}

export default function AttachmentsPanel({ conversationId, disabled }) {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const totalBytes = useMemo(
    () => (attachments || []).reduce((sum, a) => sum + Number(a?.size_bytes || 0), 0),
    [attachments]
  );

  const refresh = useCallback(async () => {
    if (!conversationId) {
      setAttachments([]);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/attachments?conversationId=${encodeURIComponent(conversationId)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load attachments");
      const json = await res.json();
      setAttachments(Array.isArray(json?.attachments) ? json.attachments : []);
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

  const uploadFiles = useCallback(
    async (files) => {
      if (!conversationId) return;
      const arr = Array.from(files || []).filter(Boolean);
      if (arr.length === 0) return;

      setUploading(true);
      setError("");
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
          if (!res.ok) throw new Error(json?.error || "Upload failed");
        }

        await refresh();
      } catch (e) {
        console.error(e);
        setError(String(e?.message || "Upload failed"));
      } finally {
        setUploading(false);
      }
    },
    [conversationId, refresh]
  );

  const onPickFiles = () => {
    if (disabled || uploading || !conversationId) return;
    fileInputRef.current?.click?.();
  };

  const onInputChange = async (e) => {
    const files = e?.target?.files;
    if (files) await uploadFiles(files);
    e.target.value = "";
  };

  const onDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (disabled || uploading || !conversationId) return;
    const files = e.dataTransfer?.files;
    if (files) await uploadFiles(files);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !uploading && conversationId) setDragOver(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const doPreview = useCallback(async (a) => {
    if (!a?.id) return;
    setError("");
    try {
      const res = await fetch(`/api/attachments/url?id=${encodeURIComponent(a.id)}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create signed url");

      const url = json?.signedUrl;
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
    } catch (e) {
      console.error(e);
      setError(String(e?.message || "Preview failed"));
    }
  }, []);

  const doDelete = useCallback(
    async (a) => {
      if (!a?.id) return;
      setError("");
      try {
        const res = await fetch(`/api/attachments?id=${encodeURIComponent(a.id)}`, {
          method: "DELETE",
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "Delete failed");
        await refresh();
      } catch (e) {
        console.error(e);
        setError(String(e?.message || "Delete failed"));
      }
    },
    [refresh]
  );

  const doDeleteAll = useCallback(async () => {
    if (!conversationId) return;
    if ((attachments || []).length === 0) return;
    setError("");
    try {
      const res = await fetch(`/api/attachments?conversationId=${encodeURIComponent(conversationId)}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Delete all failed");
      await refresh();
    } catch (e) {
      console.error(e);
      setError(String(e?.message || "Delete all failed"));
    }
  }, [conversationId, attachments, refresh]);

  if (!conversationId) {
    return null;
  }

  return (
    <div className="px-4 pb-3">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={
          "rounded-xl border border-neutral-800 bg-neutral-950 p-3 " +
          (dragOver ? "border-[var(--primary)]" : "")
        }
      >
        <details className="group">
          <summary className="flex cursor-pointer items-center justify-between gap-3 list-none">
            <div className="text-sm text-neutral-200">
              <div className="font-medium">Files</div>
              <div className="text-xs text-neutral-400">
                {attachments.length} file(s) - {formatBytes(totalBytes)}
                {loading ? " - loading..." : ""}
              </div>
            </div>
            <div className="text-xs text-neutral-400 group-open:hidden">▸</div>
            <div className="text-xs text-neutral-400 hidden group-open:block">▾</div>
          </summary>

          <div className="mt-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-neutral-500">
                Drop files here or click Upload.
              </div>

              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".txt,.js,.jsx,.json,.png,.jpg,.jpeg,.webp"
                  className="hidden"
                  onChange={onInputChange}
                />

                {attachments.length > 0 ? (
                  <button
                    type="button"
                    onClick={doDeleteAll}
                    disabled={disabled || uploading || loading}
                    className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-100 disabled:opacity-40"
                  >
                    Delete all
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={onPickFiles}
                  disabled={disabled || uploading}
                  className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-100 disabled:opacity-40"
                >
                  {uploading ? "Uploading..." : "Upload"}
                </button>

                <button
                  type="button"
                  onClick={refresh}
                  disabled={disabled || loading}
                  className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-100 disabled:opacity-40"
                >
                  Refresh
                </button>
              </div>
            </div>

            {error ? (
              <div className="mt-2 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-200">
                {error}
              </div>
            ) : null}

            <div className="mt-3 space-y-2">
              {(attachments || []).map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm text-neutral-100">{a.filename}</div>
                    <div className="text-xs text-neutral-400">
                      {a.mime_type} - {formatBytes(a.size_bytes)}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => doPreview(a)}
                      className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-200"
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => doDelete(a)}
                      className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-200"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}

              {attachments.length === 0 ? (
                <div className="text-xs text-neutral-500">No files yet.</div>
              ) : null}
            </div>
          </div>
        </details>
      </div>

      {preview ? (
        <div className="mt-3 rounded-xl border border-neutral-800 bg-neutral-950 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate text-sm text-neutral-100">Preview: {preview.filename}</div>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-100"
            >
              Close
            </button>
          </div>

          <div className="mt-2 max-h-[260px] overflow-auto rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
            {preview.kind === "image" ? (
              <img src={preview.url} alt={preview.filename} className="max-w-full rounded" />
            ) : preview.kind === "text" ? (
              <pre className="whitespace-pre-wrap break-words text-xs text-neutral-100">{preview.text}</pre>
            ) : (
              <a href={preview.url} target="_blank" rel="noreferrer" className="text-xs text-neutral-200 underline">
                Open signed URL
              </a>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
