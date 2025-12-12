// /app/hooks/useChat.js
"use client";

import { useCallback, useRef, useState } from "react";
import useAutoTitleStore from "@/app/hooks/useAutoTitleStore";

/**
 * useChat
 *
 * Hook này chịu trách nhiệm:
 * - Gọi /api/chat-stream (stream text)
 * - Parse $$META:{...}$$ để cập nhật auto-title + conversation list
 *
 * Bạn có thể truyền vào các callback để hook “bơm” dữ liệu ra ngoài:
 * - onConversationCreated(conversation)
 * - onOptimisticTitle(conversationId, title)
 * - onFinalTitle(conversationId, title)
 * - onAssistantDelta(deltaText)
 * - onStreamDone(fullAssistantText)
 */
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

  const stop = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  const sendMessage = useCallback(
    async ({ conversationId, content, systemMode = "default" }) => {
      if (!content?.trim()) return { ok: false, error: "Empty content" };

      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);

      // nếu chưa có conversationId, backend sẽ tự tạo → ta bật loading “tạm”
      // (sau khi nhận META optimistic/final sẽ tự cập nhật store)
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

        // META format: $$META:{json}$$\n
        // Lưu ý: chunk có thể cắt giữa META → phải buffer lại.
        const tryExtractMeta = () => {
          // xử lý nhiều META trong buffer
          while (true) {
            const start = buffer.indexOf("$$META:");
            if (start === -1) break;

            const end = buffer.indexOf("$$\n", start);
            if (end === -1) break; // chưa đủ dữ liệu

            const metaRaw = buffer.slice(start + "$$META:".length, end);
            const before = buffer.slice(0, start);
            const after = buffer.slice(end + "$$\n".length);

            // phần trước META là text assistant “thật”
            if (before) {
              assistantFull += before;
              onAssistantDelta?.(before);
            }

            // parse META
            try {
              const meta = JSON.parse(metaRaw);

              if (meta?.type === "conversationCreated" && meta?.conversation?.id) {
                onConversationCreated?.(meta.conversation);
              }

              if (meta?.type === "optimisticTitle" && meta?.conversationId && meta?.title) {
                setOptimisticTitle(meta.conversationId, meta.title);
                onOptimisticTitle?.(meta.conversationId, meta.title);
              }

              if (meta?.type === "finalTitle" && meta?.conversationId && meta?.title) {
                setFinalTitle(meta.conversationId, meta.title);
                onFinalTitle?.(meta.conversationId, meta.title);
              }
            } catch {
              // ignore META parse errors (không phá stream)
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

        // flush phần còn lại (không có META)
        if (buffer) {
          assistantFull += buffer;
          onAssistantDelta?.(buffer);
          buffer = "";
        }

        onStreamDone?.(assistantFull);

        return { ok: true };
      } catch (err) {
        if (err?.name !== "AbortError") {
          console.error("useChat sendMessage error:", err);
        }
        return { ok: false, error: err?.message || "Unknown error" };
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [
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
