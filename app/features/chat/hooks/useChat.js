// /app/hooks/useChat.js
"use client";

import { useCallback, useRef, useState } from "react";
import useAutoTitleStore from "@/app/features/chat/hooks/useAutoTitleStore";

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

  // track conversationId thực tế trong vòng đời 1 request để có thể tắt loading ở finally
  const activeConversationIdRef = useRef(null);

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
    async ({ conversationId, content }) => {
      if (!content?.trim()) return { ok: false, error: "Empty content" };

      createdFiredRef.current = false;
      activeConversationIdRef.current = conversationId || null;

      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);

      // show loading if we already know conversationId
      if (conversationId) setTitleLoading(conversationId, true);

      try {
        const res = await fetch("/api/chat-stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // ✅ Only send: conversationId + content
          body: JSON.stringify({ conversationId, content }),
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

        const handleMeta = (meta) => {
          if (meta?.type === "conversationCreated" && meta?.conversation?.id) {
            createdFiredRef.current = true;
            activeConversationIdRef.current = meta.conversation.id;

            onConversationCreated?.(meta.conversation);
            return;
          }

          if (
            meta?.type === "optimisticTitle" &&
            meta?.conversationId &&
            meta?.title
          ) {
            activeConversationIdRef.current = meta.conversationId;

            // nếu conversationId ban đầu null, dùng optimisticTitle để “create placeholder”
            ensureCreatedPlaceholder(meta.conversationId);

            setTitleLoading(meta.conversationId, true);
            setOptimisticTitle(meta.conversationId, meta.title);
            onOptimisticTitle?.(meta.conversationId, meta.title);
            return;
          }

          if (
            meta?.type === "finalTitle" &&
            meta?.conversationId &&
            meta?.title
          ) {
            activeConversationIdRef.current = meta.conversationId;

            ensureCreatedPlaceholder(meta.conversationId);

            setFinalTitle(meta.conversationId, meta.title); // store sẽ tắt loading
            onFinalTitle?.(meta.conversationId, meta.title);
          }
        };

        /**
         * Parse SSE frames from buffer.
         * Frame delimiter: \n\n
         * We support: event: token|meta|error|done, data: <json>
         */
        const tryParseSSE = () => {
          while (true) {
            const sep = buffer.indexOf("\n\n");
            if (sep === -1) break;

            const frame = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);

            if (!frame.trim()) continue;

            let eventName = "message";
            const dataLines = [];

            for (const line of frame.split("\n")) {
              if (line.startsWith("event:")) {
                eventName = line.slice("event:".length).trim();
                continue;
              }
              if (line.startsWith("data:")) {
                dataLines.push(line.slice("data:".length).trim());
              }
            }

            const dataRaw = dataLines.join("\n");
            if (!dataRaw) continue;

            if (eventName === "token") {
              try {
                const payload = JSON.parse(dataRaw);
                const t = payload?.t || "";
                if (t) {
                  assistantFull += t;
                  onAssistantDelta?.(t);
                }
              } catch {
                // ignore token parse error
              }
              continue;
            }

            if (eventName === "meta") {
              try {
                const meta = JSON.parse(dataRaw);
                handleMeta(meta);
              } catch {
                // ignore meta parse error
              }
              continue;
            }

            if (eventName === "error") {
              try {
                const payload = JSON.parse(dataRaw);
                throw new Error(payload?.message || "Stream error");
              } catch (e) {
                throw e instanceof Error ? e : new Error("Stream error");
              }
            }

            // done: ignore (body close will finalize)
          }
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          if (!chunk) continue;

          buffer += chunk;
          tryParseSSE();
        }

        // flush any remaining partial frame (best-effort)
        if (buffer.trim()) {
          buffer += "\n\n";
          tryParseSSE();
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
        // ✅ Nếu cuối cùng không nhận được finalTitle thì vẫn nên tắt loading
        const cid = activeConversationIdRef.current;
        if (cid) setTitleLoading(cid, false);

        setIsStreaming(false);
        abortRef.current = null;
        activeConversationIdRef.current = null;
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
