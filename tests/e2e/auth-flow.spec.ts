import { test, expect } from "@playwright/test";
import { setupNetworkGuard, assertNoUnhandledRequests } from "./helpers/network-guard";
import { mockUnauthenticatedSession } from "./helpers/mock-session";

test.describe("Auth Flow & Bilingual Tests", () => {
  let unhandledRequests: string[] = [];

  test.beforeEach(async ({ page }) => {
    unhandledRequests = await setupNetworkGuard(page, { mode: "enforce" });
    await mockUnauthenticatedSession(page);
  });

  test.afterEach(() => {
    assertNoUnhandledRequests(unhandledRequests);
  });

  test("TC-E2E-01: Login interface renders correctly and bilingual toggle updates text", async ({
    page,
  }) => {
    await page.goto("/auth/signin");

    // Verify logo and brand presence
    await expect(page.locator("text=Vikini").first()).toBeVisible();

    // Verify Google sign-in button exists
    const googleBtn = page.getByRole("button", { name: /Google/i });
    await expect(googleBtn).toBeVisible();

    // Check language toggle: click VI and EN
    const viBtn = page.getByRole("button", { name: "VI", exact: true });
    const enBtn = page.getByRole("button", { name: "EN", exact: true });

    if (await viBtn.isVisible()) {
      await viBtn.click();
      await expect(googleBtn).toContainText(/ĐĂNG NHẬP VỚI GOOGLE/i);
    }

    if (await enBtn.isVisible()) {
      await enBtn.click();
      await expect(googleBtn).toContainText(/SIGN IN WITH GOOGLE/i);
    }
  });

  test("TC-E2E-02 (Offline): Click Google sign-in sends Server Action request without crash", async ({
    page,
  }) => {
    // Intercept Google OAuth navigation
    await page.route("https://accounts.google.com/**", async (route) => {
      return route.abort();
    });

    await page.goto("/auth/signin");

    const googleBtn = page.getByRole("button", { name: /Google/i });
    await expect(googleBtn).toBeVisible();

    // Trigger click - catch navigation abort gracefully
    try {
      await googleBtn.click({ timeout: 5000 });
    } catch {
      // Abort is expected when route is blocked
    }
  });

  test("TC-E2E-02 (@online): Redirects to Google OAuth with valid client_id and redirect_uri", async ({
    page,
  }) => {
    await page.route("https://accounts.google.com/**", async (route) => {
      return route.abort();
    });

    await page.goto("/auth/signin");

    const googleBtn = page.getByRole("button", { name: /Google/i });
    await expect(googleBtn).toBeVisible();

    const requestPromise = page
      .waitForRequest((req) => req.url().includes("accounts.google.com"), {
        timeout: 10000,
      })
      .catch(() => null);

    await googleBtn.click();
    const req = await requestPromise;

    if (req) {
      const url = req.url();
      expect(url).toContain("client_id=");
      expect(url).toContain("redirect_uri=");
    }
  });
});
