import type { Page } from "@playwright/test";
import type { Conversation } from "@/lib/features/chat/conversations";
import type { FrontendMessage } from "@/app/features/chat/hooks/useConversation";

export interface SetupMockChatOptions {
  conversationId?: string;
  messages?: FrontendMessage[];
}

export async function setupMockChat(page: Page, options?: SetupMockChatOptions): Promise<void> {
  const convId = options?.conversationId || "conv-e2e-123";
  const messages = options?.messages ?? [];

  await page.route("**/api/conversations*", async (route, request) => {
    if (request.method() === "POST") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            conversation: {
              id: convId,
              title: "New Conversation",
              model: "gemini-2.5-flash",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            } satisfies Partial<Conversation>,
          },
        }),
      });
    }

    if (request.method() === "GET" && request.url().includes("?id=")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { id: convId, title: "New Conversation", messages },
        }),
      });
    }

    if (request.method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { conversations: [] } }),
      });
    }

    return route.fallback();
  });

  await page.route("**/api/messages", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          message: {
            id: "msg-partial-123",
            conversation_id: convId,
            role: "assistant",
            content: "...",
            created_at: new Date().toISOString(),
          },
          alreadyComplete: false,
        },
      }),
    });
  });
}
