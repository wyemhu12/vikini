// /app/features/chat/components/hooks/useUrlSync.ts
"use client";

import { useEffect, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

// ============================================
// Type Definitions
// ============================================

export interface UseUrlSyncOptions {
  selectedConversationId: string | null;
  setSelectedConversationId: (id: string | null) => void;
}

export interface UseUrlSyncReturn {
  /** Sync conversation ID to URL and update state */
  setSelectedConversationIdAndUrl: (id: string | null) => void;
  /** Check if URL has remix mode */
  isRemixMode: boolean;
}

// ============================================
// Hook Implementation
// ============================================

/**
 * Custom hook that manages URL ↔ state synchronization for conversation selection.
 * Keeps URL query param `?id=xxx` in sync with selected conversation.
 */
export function useUrlSync({
  selectedConversationId,
  setSelectedConversationId,
}: UseUrlSyncOptions): UseUrlSyncReturn {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Sync URL → State
  useEffect(() => {
    const idFromUrl = searchParams?.get("id");
    if (idFromUrl && idFromUrl !== selectedConversationId) {
      setSelectedConversationId(idFromUrl);
    } else if (!idFromUrl && selectedConversationId) {
      setSelectedConversationId(null);
    }
  }, [searchParams, selectedConversationId, setSelectedConversationId]);

  // Sync State → URL
  const syncUrlWithId = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(searchParams?.toString() || "");
      if (id) {
        params.set("id", id);
      } else {
        params.delete("id");
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, pathname, router]
  );

  const setSelectedConversationIdAndUrl = useCallback(
    (id: string | null) => {
      setSelectedConversationId(id);
      syncUrlWithId(id);
    },
    [setSelectedConversationId, syncUrlWithId]
  );

  const isRemixMode = searchParams?.get("mode") === "remix";

  return {
    setSelectedConversationIdAndUrl,
    isRemixMode,
  };
}
