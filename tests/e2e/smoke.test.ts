import { test, expect } from "@playwright/test";

test.describe("Smoke Tests", () => {
  test("app loads without crashing", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBeLessThan(500);
  });

  test("404 page renders for unknown routes", async ({ page }) => {
    await page.goto("/this-route-does-not-exist");
    await expect(page.locator("text=404")).toBeVisible();
  });
});
