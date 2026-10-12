import { expect, type Page } from "@playwright/test";

export interface NetworkGuardOptions {
  mode?: "record" | "enforce";
}

export async function setupNetworkGuard(
  page: Page,
  options?: NetworkGuardOptions
): Promise<string[]> {
  const mode = options?.mode || "enforce";
  const unhandledRequests: string[] = [];

  if (mode === "record") {
    page.on("request", (req) => {
      const url = req.url();
      if (url.includes("/api/")) {
        console.warn(`[RECORD-MODE] Request: ${req.method()} ${url}`);
        unhandledRequests.push(`${req.method()} ${url}`);
      }
    });
    return unhandledRequests;
  }

  // Enforce mode: catch-all 501 for unmocked /api/ routes
  await page.route("**/api/**", async (route, req) => {
    const url = req.url();
    const entry = `${req.method()} ${url}`;
    unhandledRequests.push(entry);
    console.warn(`[FAIL-CLOSED GUARD] Unhandled network call: ${entry}`);
    return route.fulfill({
      status: 501,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Not Implemented in E2E sandbox",
        unhandledUrl: url,
      }),
    });
  });

  return unhandledRequests;
}

export function assertNoUnhandledRequests(unhandledRequests: string[]): void {
  expect(
    unhandledRequests,
    `Fail-closed guard caught unhandled API requests during E2E test:\n${unhandledRequests.join("\n")}`
  ).toEqual([]);
}
