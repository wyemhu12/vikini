/**
 * useFiles — SWR-powered hook for fetching conversation files.
 *
 * Single source of truth for file data. Auto-refreshes when mutated.
 * Used by FilePreviewArea and FileInMessage components.
 */

"use client";

import useSWR from "swr";
import type { FileItem } from "@/types/files";

const fetcher = async (url: string): Promise<FileItem[]> => {
  const res = await fetch(url);
  if (!res.ok) return [];
  const json: unknown = await res.json();

  // API returns { data: { files: [...] } } via success() helper
  if (typeof json === "object" && json !== null) {
    const obj = json as Record<string, unknown>;
    // Unwrap: { data: { files: [...] } }
    if (typeof obj.data === "object" && obj.data !== null) {
      const inner = obj.data as Record<string, unknown>;
      if (Array.isArray(inner.files)) return inner.files as FileItem[];
    }
    // Fallback: { files: [...] }
    if (Array.isArray(obj.files)) return obj.files as FileItem[];
    // Fallback: { data: [...] }
    if (Array.isArray(obj.data)) return obj.data as FileItem[];
  }
  // Fallback: plain array
  if (Array.isArray(json)) return json as FileItem[];
  return [];
};

export function useFiles(conversationId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<FileItem[]>(
    conversationId ? `/api/files?conversationId=${conversationId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 2000,
    }
  );

  return {
    /** List of uploaded files for this conversation */
    files: data ?? [],
    /** Number of files */
    fileCount: data?.length ?? 0,
    /** Loading state */
    isLoading,
    /** Error state */
    error,
    /** Manually revalidate (e.g., after upload) */
    mutate,
  };
}
