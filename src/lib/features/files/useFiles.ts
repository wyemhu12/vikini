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
  const data: unknown = await res.json();
  return Array.isArray(data) ? (data as FileItem[]) : [];
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
