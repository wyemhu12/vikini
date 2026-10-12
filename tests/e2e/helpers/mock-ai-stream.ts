import type { Page } from "@playwright/test";

export interface StreamFrame {
  event: string;
  data: Record<string, unknown>;
}

export const DEFAULT_STREAM_FRAMES: StreamFrame[] = [
  { event: "meta", data: { optimisticTitle: "Hỏi về Vikini E2E" } },
  { event: "thinking", data: { thinking: "Phân tích yêu cầu kiểm thử và tạo phản hồi..." } },
  { event: "token", data: { t: "Xin " } },
  { event: "token", data: { t: "chào! " } },
  { event: "token", data: { t: "Tôi " } },
  { event: "token", data: { t: "là " } },
  { event: "token", data: { t: "trợ lý " } },
  { event: "token", data: { t: "AI " } },
  { event: "token", data: { t: "Vikini." } },
  { event: "done", data: {} },
];

export async function setupMockAiStream(
  page: Page,
  options?: { frames?: StreamFrame[]; delayMs?: number }
): Promise<void> {
  const frames = options?.frames || DEFAULT_STREAM_FRAMES;
  const delayMs = options?.delayMs ?? 30;

  await page.addInitScript(
    ({ frames, delayMs }) => {
      const originalFetch = window.fetch;

      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url =
          typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

        if (url.includes("/api/chat-stream")) {
          // Check early abort
          if (init?.signal?.aborted) {
            throw new DOMException("The user aborted a request.", "AbortError");
          }

          const stream = new ReadableStream({
            async start(controller) {
              const encoder = new TextEncoder();

              const abortHandler = () => {
                try {
                  controller.error(new DOMException("The user aborted a request.", "AbortError"));
                } catch {
                  // Ignore if already closed or aborted
                }
              };

              init?.signal?.addEventListener("abort", abortHandler);

              try {
                for (const frame of frames) {
                  if (init?.signal?.aborted) {
                    abortHandler();
                    return;
                  }

                  const payload = `event: ${frame.event}\ndata: ${JSON.stringify(frame.data)}\n\n`;
                  controller.enqueue(encoder.encode(payload));

                  if (delayMs > 0) {
                    await new Promise((r) => setTimeout(r, delayMs));
                  }
                }
                controller.close();
              } catch (err) {
                controller.error(err);
              } finally {
                init?.signal?.removeEventListener("abort", abortHandler);
              }
            },
          });

          return new Response(stream, {
            status: 200,
            headers: {
              "Content-Type": "text/event-stream; charset=utf-8",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            },
          });
        }

        return originalFetch(input, init);
      };
    },
    { frames, delayMs }
  );
}
