// tests/e2e/a11y.spec.ts
// Vikini 3.0 phase 3D (audit C3): every route must expose accessible names for its controls.
// Fails only on the "accessible name" rule family; other axe findings are logged for tracking.
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import type { FrontendMessage } from "@/app/features/chat/hooks/useConversation";
import { mockAuthenticatedSession } from "./helpers/mock-session";
import { setupMockChat } from "./helpers/mock-chat";
import { setupMockProjects } from "./helpers/mock-projects";
import { setupMockImageGen } from "./helpers/mock-image-gen";

interface AxeNode {
  target: string[];
}
interface AxeViolation {
  id: string;
  nodes: AxeNode[];
}
declare global {
  interface Window {
    axe: {
      run: (
        context: Document,
        options: { resultTypes: string[] }
      ) => Promise<{ violations: AxeViolation[] }>;
    };
  }
}

const AXE_PATH = path.join(process.cwd(), "node_modules/axe-core/axe.min.js");

const NAME_RULES = new Set([
  "button-name",
  "link-name",
  "select-name",
  "label",
  "aria-toggle-field-name",
  "aria-input-field-name",
  "input-button-name",
  "aria-command-name",
  "svg-img-alt",
  "image-alt",
]);

const ROUTES = [
  "/",
  "/?id=conv-e2e-123",
  "/images",
  "/gallery",
  "/describe",
  "/gems",
  "/novelcrafter",
];

const VIEWPORTS = [
  { tag: "desktop", width: 1440, height: 900 },
  { tag: "mobile", width: 375, height: 812 },
] as const;

const CONVERSATION: FrontendMessage[] = [
  { id: "m-user", role: "user", content: "Xin chào" },
  {
    id: "m-bot",
    role: "assistant",
    content: "Chào bạn! Đây là **câu trả lời** mẫu.",
    meta: { model: "gemini-3.8-flash" },
  },
];

async function setup(page: Page): Promise<void> {
  // Catch-all FIRST: Playwright matches the most recently registered route first,
  // so the specific mocks below take precedence and unmocked APIs get an empty body.
  await page.route("**/api/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  );
  await mockAuthenticatedSession(page);
  await setupMockChat(page, { messages: CONVERSATION });
  await setupMockProjects(page);
  await setupMockImageGen(page);
}

async function nameViolations(page: Page): Promise<string[]> {
  await page.addScriptTag({ path: AXE_PATH });
  const { violations } = await page.evaluate(() =>
    window.axe.run(document, { resultTypes: ["violations"] })
  );
  for (const v of violations.filter((v) => !NAME_RULES.has(v.id))) {
    console.warn(`[a11y:info] ${v.id} ×${v.nodes.length}`);
  }
  return violations
    .filter((v) => NAME_RULES.has(v.id))
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
}

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.locator("main, [role='main']").first().waitFor({ timeout: 60_000 });
  await page.waitForTimeout(500);
}

test.describe("Accessible names (axe)", () => {
  test.setTimeout(120_000);

  for (const vp of VIEWPORTS) {
    for (const route of ROUTES) {
      test(`${vp.tag} ${route}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await setup(page);
        await page.goto(route);
        await settle(page);
        expect(await nameViolations(page)).toEqual([]);
      });
    }
  }

  test("mobile composer options sheet", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await setup(page);
    await page.goto("/");
    await settle(page);
    await page
      .getByRole("button", { name: /^(Tùy chọn|Options)/ })
      .first()
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await nameViolations(page)).toEqual([]);
  });
});
