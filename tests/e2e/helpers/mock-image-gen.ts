import type { Page } from "@playwright/test";
import type { BatchQuotaInfo } from "@/app/features/image-gen/components/ControlPanel";
import type { FrontendMessage } from "@/app/features/chat/hooks/useConversation";

export const SAMPLE_IMAGE_SVG =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='512' height='512'><rect width='512' height='512' fill='%23222'/><text x='50%' y='50%' fill='%23fff' font-size='24' text-anchor='middle' dominant-baseline='middle'>Cyberpunk Neon</text></svg>";

export const SAMPLE_IMAGE_MESSAGE: FrontendMessage = {
  id: "msg-img-123",
  conversationId: "conv-image-123",
  role: "assistant",
  content: "",
  createdAt: new Date().toISOString(),
  meta: {
    imageUrl: SAMPLE_IMAGE_SVG,
    prompt: "Cyberpunk city neon",
    originalOptions: {
      model: "gemini-3.1-flash-image",
      aspectRatio: "1:1",
    },
  },
};

export async function setupMockImageGen(page: Page): Promise<void> {
  // Mock image generation endpoint
  await page.route("**/api/generate-image", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          images: [SAMPLE_IMAGE_SVG],
        },
      }),
    });
  });

  // Mock prompt suggest endpoint (debounced on typing)
  await page.route("**/api/prompt-suggest", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          suggestions: [],
        },
      }),
    });
  });

  // Mock batch gen quota endpoint
  await page.route("**/api/batch-gen-quota", async (route) => {
    const quotaData: BatchQuotaInfo = {
      rank: "pro",
      maxBatchSize: 4,
      quotas: {
        1: { limit: 50, used: 0, remaining: 50 },
        2: { limit: 25, used: 0, remaining: 25 },
        4: { limit: 10, used: 0, remaining: 10 },
      },
    };

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: quotaData,
      }),
    });
  });
}
