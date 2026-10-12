import type { Page } from "@playwright/test";
import type { ProjectLimits } from "@/lib/store/projectStore";

export async function setupMockProjects(page: Page): Promise<void> {
  const limits: ProjectLimits = {
    maxProjects: 10,
    currentProjects: 0,
    maxStorageBytesPerProject: 52428800,
  };

  // Mock projects list & creation
  await page.route("**/api/projects", async (route, req) => {
    if (req.method() === "POST") {
      const body = req.postDataJSON() || {};
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            project: {
              id: "proj-e2e-123",
              name: body.name || "Workspace E2E",
              description: body.description || "",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          },
        }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          projects: [],
          tier: "pro",
          limits,
        },
      }),
    });
  });

  // Mock files endpoint called by useFiles
  await page.route("**/api/files*", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          files: [],
        },
      }),
    });
  });
}
