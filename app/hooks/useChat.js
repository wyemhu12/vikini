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
    async ({
      conversationId,
      content,
      systemMode = "default",
      language = "vi",
    }) => {
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
          body: JSON.stringify({ conversationId, content, systemMode, language }),
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
            onConversationCreated?.(meta.conversation);
            return;
          }

          if (meta?.type === "optimisticTitle" && meta?.conversationId && meta?.title) {
            // nếu conversationId ban đầu null, dùng optimisticTitle để “create placeholder”
            ensureCreatedPlaceholder(meta.conversationId);

            setTitleLoading(meta.conversationId, true);
            setOptimisticTitle(meta.conversationId, meta.title);
            onOptimisticTitle?.(meta.conversationId, meta.title);
            return;
          }

          if (meta?.type === "finalTitle" && meta?.conversationId && meta?.title) {
            ensureCreatedPlaceholder(meta.conversationId);

            setFinalTitle(meta.conversationId, meta.title); // sẽ tự tắt loading trong store
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
