import { test as base, expect, type Page } from "@playwright/test";
import { setupNetworkGuard, assertNoUnhandledRequests } from "./helpers/network-guard";
import { mockAuthenticatedSession } from "./helpers/mock-session";
import { setupMockChat } from "./helpers/mock-chat";
import { setupMockAiStream } from "./helpers/mock-ai-stream";
import { setupMockImageGen } from "./helpers/mock-image-gen";
import { setupMockProjects } from "./helpers/mock-projects";

interface CustomFixtures {
  authedPage: Page;
}

export const test = base.extend<CustomFixtures>({
  authedPage: async ({ page }, use) => {
    // 1. Fail-closed network guard registered FIRST
    const unhandledRequests = await setupNetworkGuard(page, { mode: "enforce" });

    // 2. Mock authenticated session
    await mockAuthenticatedSession(page);

    // 3. Mock chat conversation & messages
    await setupMockChat(page);

    // 4. Mock AI streaming
    await setupMockAiStream(page);

    // 5. Mock projects & files
    await setupMockProjects(page);

    // 6. Mock image gen studio
    await setupMockImageGen(page);

    // Run test
    await use(page);

    // Teardown: ensure zero unhandled API requests leaked
    assertNoUnhandledRequests(unhandledRequests);
  },
});

export { expect };
