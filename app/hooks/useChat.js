// app/hooks/useChat.js
"use client";

import { useCallback, useRef, useState } from "react";
import useAutoTitleStore from "@/app/hooks/useAutoTitleStore";

export default function useChat({
  onConversationCreated,
  onOptimisticTitle,
  onFinalTitle,
  onAssistantDelta,
  onStreamDone,
} = {}) {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef(null);

  const setOptimisticTitle = useAutoTitleStore((s) => s.setOptimisticTitle);
  const setFinalTitle = useAutoTitleStore((s) => s.setFinalTitle);
  const setTitleLoading = useAutoTitleStore((s) => s.setTitleLoading);

  // guard: nếu backend không gửi conversationCreated (hoặc parse trượt),
  // ta sẽ dựng placeholder từ optimisticTitle/finalTitle để sidebar vẫn hiện.
  const createdFiredRef = useRef(false);

  const stop = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  const ensureCreatedPlaceholder = useCallback(
    (conversationId) => {
      if (!conversationId) return;
      if (createdFiredRef.current) return;

      createdFiredRef.current = true;
      onConversationCreated?.({
        id: conversationId,
        title: "New Chat",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    },
    [onConversationCreated]
  );

  const sendMessage = useCallback(
    async ({ conversationId, content, systemMode = "default" }) => {
      if (!content?.trim()) return { ok: false, error: "Empty content" };

      createdFiredRef.current = false;

      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);

      if (conversationId) setTitleLoading(conversationId, true);

      try {
        const res = await fetch("/api/chat-stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, content, systemMode }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const txt = await res.text().catch(() => "");
          throw new Error(txt || "chat-stream failed");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        let buffer = "";
        let assistantFull = "";

        const tryExtractMeta = () => {
          while (true) {
            const start = buffer.indexOf("$$META:");
            if (start === -1) break;

            const end = buffer.indexOf("$$\n", start);
            if (end === -1) break;

            const metaRaw = buffer.slice(start + "$$META:".length, end);
            const before = buffer.slice(0, start);
            const after = buffer.slice(end + "$$\n".length);

            if (before) {
              assistantFull += before;
              onAssistantDelta?.(before);
            }

            try {
              const meta = JSON.parse(metaRaw);

              if (meta?.type === "conversationCreated" && meta?.conversation?.id) {
                createdFiredRef.current = true;
                onConversationCreated?.(meta.conversation);
              }

              if (meta?.type === "optimisticTitle" && meta?.conversationId && meta?.title) {
                // nếu conversationId ban đầu null, dùng optimisticTitle để “create placeholder”
                ensureCreatedPlaceholder(meta.conversationId);

                setTitleLoading(meta.conversationId, true);
                setOptimisticTitle(meta.conversationId, meta.title);
                onOptimisticTitle?.(meta.conversationId, meta.title);
              }

              if (meta?.type === "finalTitle" && meta?.conversationId && meta?.title) {
                ensureCreatedPlaceholder(meta.conversationId);

                setFinalTitle(meta.conversationId, meta.title); // sẽ tự tắt loading trong store
                onFinalTitle?.(meta.conversationId, meta.title);
              }
            } catch {
              // ignore meta parse error
            }

            buffer = after;
          }
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          if (!chunk) continue;

          buffer += chunk;
          tryExtractMeta();
        }

        if (buffer) {
          assistantFull += buffer;
          onAssistantDelta?.(buffer);
          buffer = "";
        }

        onStreamDone?.(assistantFull);
        return { ok: true };
      } catch (err) {
        if (err?.name !== "AbortError") console.error("useChat sendMessage error:", err);
        return { ok: false, error: err?.message || "Unknown error" };
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [
      ensureCreatedPlaceholder,
      onAssistantDelta,
      onConversationCreated,
      onFinalTitle,
      onOptimisticTitle,
      onStreamDone,
      setFinalTitle,
      setOptimisticTitle,
      setTitleLoading,
    ]
  );

  return { sendMessage, stop, isStreaming };
}
