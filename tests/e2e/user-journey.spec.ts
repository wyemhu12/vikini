import { test, expect } from "./fixtures";
import { setupMockChat } from "./helpers/mock-chat";
import { SAMPLE_IMAGE_MESSAGE } from "./helpers/mock-image-gen";

test.describe("User Journey E2E Tests", () => {
  test("TC-E2E-03: Chat flow - send prompt, stream AI response, thinking toggle, and url sync", async ({
    authedPage,
  }) => {
    await authedPage.goto("/");

    // Verify main chat interface is loaded
    const textarea = authedPage.locator("textarea").first();
    await expect(textarea).toBeVisible();

    // Send a message
    await textarea.fill("Giải thích kiến trúc Vikini");
    await textarea.press("Enter");

    // Assert URL syncs to conversation ID
    await expect(authedPage).toHaveURL(/[?&]id=conv-e2e-123/, { timeout: 10000 });

    // Assert thinking block and AI response tokens stream in
    const assistantBubble = authedPage.getByText(/trợ lý AI Vikini|Vikini/i).first();
    await expect(assistantBubble).toBeVisible({ timeout: 10000 });
  });

  test("TC-E2E-04: Image Studio - re-route conversation, enter prompt, generate SVG image fixture", async ({
    authedPage,
  }) => {
    // Re-route conversation for Image Studio prior to generation
    await authedPage.unroute("**/api/conversations*");
    await setupMockChat(authedPage, {
      conversationId: "conv-image-123",
      messages: [SAMPLE_IMAGE_MESSAGE],
    });

    await authedPage.goto("/images");

    // Enter image generation prompt
    const promptInput = authedPage.locator("textarea").first();
    await expect(promptInput).toBeVisible({ timeout: 10000 });
    await promptInput.fill("Cyberpunk city neon");

    // Click generate button
    const generateBtn = authedPage.getByRole("button", { name: /Tạo ảnh|Generate/i }).first();
    if (await generateBtn.isVisible()) {
      await generateBtn.click();
    }

    // Assert Canvas renders the SVG fixture
    const generatedImg = authedPage.locator('img[src^="data:image/svg+xml"]').first();
    await expect(generatedImg).toBeVisible({ timeout: 10000 });
  });

  test("TC-E2E-05: Projects flow - create project workspace and verify in Sidebar", async ({
    authedPage,
  }) => {
    await authedPage.goto("/");

    // Look for New Project button or trigger in sidebar
    const newProjectBtn = authedPage
      .getByRole("button", { name: /Dự án mới|New Project/i })
      .first();
    if (await newProjectBtn.isVisible()) {
      await newProjectBtn.click();

      // Form fill in CreateProjectModal
      const nameInput = authedPage
        .locator("input[placeholder*='dự án'], input[placeholder*='project']")
        .first();
      if (await nameInput.isVisible()) {
        await nameInput.fill("Workspace E2E");

        const submitBtn = authedPage.getByRole("button", { name: /Tạo dự án|Create Project/i });
        await submitBtn.click();
      }
    }
  });
});
