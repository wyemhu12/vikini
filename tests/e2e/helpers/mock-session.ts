import type { Page } from "@playwright/test";

export const E2E_TEST_USER = {
  id: "test-e2e@vikini.dev",
  email: "test-e2e@vikini.dev",
  name: "E2E Tester",
  rank: "pro",
};

export async function mockAuthenticatedSession(page: Page): Promise<void> {
  // Add session cookies to the browser context
  await page.context().addCookies([
    {
      name: "next-auth.session-token",
      value: "mock-e2e-session-token",
      domain: "127.0.0.1",
      path: "/",
      httpOnly: false,
      sameSite: "Lax",
      expires: Math.floor(Date.now() / 1000) + 86400,
    },
    {
      name: "authjs.session-token",
      value: "mock-e2e-session-token",
      domain: "127.0.0.1",
      path: "/",
      httpOnly: false,
      sameSite: "Lax",
      expires: Math.floor(Date.now() / 1000) + 86400,
    },
  ]);

  // Mock session endpoint
  await page.route("**/api/auth/session*", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: E2E_TEST_USER,
        expires: new Date(Date.now() + 86400000).toISOString(),
      }),
    });
  });

  // Mock allowed models endpoint
  await page.route("**/api/user/allowed-models*", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          allowed_models: ["gemini-2.5-flash", "gemini-3.1-flash-image", "claude-3-5-sonnet"],
          features: {},
        },
      }),
    });
  });
}

export async function mockUnauthenticatedSession(page: Page): Promise<void> {
  // Unauthenticated session MUST return null per NextAuth contract
  await page.route("**/api/auth/session", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(null),
    });
  });

  await page.route("**/api/user/allowed-models", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          allowed_models: ["gemini-2.5-flash"],
          features: {},
        },
      }),
    });
  });
}
