// /app/api/projects/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks - declared BEFORE importing the route handlers
// ---------------------------------------------------------------------------

vi.mock("@/lib/features/auth/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/features/projects/projects.server", () => ({
  getUserProjects: vi.fn(),
  createProject: vi.fn(),
  getUserTier: vi.fn(),
  getTierLimits: vi.fn(),
}));

vi.mock("@/lib/utils/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports - AFTER mocks are set up
// ---------------------------------------------------------------------------

import { GET, POST } from "./route";
import { auth } from "@/lib/features/auth/auth";
import {
  getUserProjects,
  createProject,
  getUserTier,
  getTierLimits,
} from "@/lib/features/projects/projects.server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_USER_EMAIL = "test@example.com";
const TEST_PROJECT_ID = "proj-abc-123";

function createRequest(method: string, url: string, body?: unknown): NextRequest {
  const init = {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

function mockAuthenticated() {
  vi.mocked(auth).mockResolvedValue({
    user: { email: TEST_USER_EMAIL },
  } as unknown as Awaited<ReturnType<typeof auth>>);
}

function mockUnauthenticated() {
  vi.mocked(auth).mockResolvedValue(null as unknown as Awaited<ReturnType<typeof auth>>);
}

const MOCK_TIER_LIMITS = {
  maxProjects: 10,
  maxStorageBytesPerProject: 50_000_000,
  embeddingModels: ["text-embedding-004"],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("/api/projects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ======================== GET ========================
  describe("GET", () => {
    it("should return 401 if not authenticated", async () => {
      mockUnauthenticated();

      const res = await GET();

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should list projects for the authenticated user", async () => {
      mockAuthenticated();
      const mockProjects = [{ id: TEST_PROJECT_ID, name: "My Project", userId: TEST_USER_EMAIL }];
      vi.mocked(getUserProjects).mockResolvedValue(mockProjects as never);
      vi.mocked(getUserTier).mockResolvedValue("free" as never);
      vi.mocked(getTierLimits).mockReturnValue(MOCK_TIER_LIMITS as never);

      const res = await GET();

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.projects).toEqual(mockProjects);
      expect(json.data.tier).toBe("free");
      expect(json.data.limits.maxProjects).toBe(10);
      expect(json.data.limits.currentProjects).toBe(1);
      expect(getUserProjects).toHaveBeenCalledWith(TEST_USER_EMAIL);
    });

    it("should return 500 when getUserProjects throws", async () => {
      mockAuthenticated();
      vi.mocked(getUserProjects).mockRejectedValue(new Error("DB error"));
      vi.mocked(getUserTier).mockResolvedValue("free" as never);

      const res = await GET();

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  // ======================== POST ========================
  describe("POST", () => {
    it("should return 401 if not authenticated", async () => {
      mockUnauthenticated();

      const req = createRequest("POST", "/api/projects", {
        name: "New Project",
      });
      const res = await POST(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should create a project successfully", async () => {
      mockAuthenticated();
      const mockProject = {
        id: TEST_PROJECT_ID,
        name: "New Project",
        userId: TEST_USER_EMAIL,
      };
      vi.mocked(createProject).mockResolvedValue(mockProject as never);

      const req = createRequest("POST", "/api/projects", {
        name: "New Project",
        description: "A test project",
      });
      const res = await POST(req);

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.project).toEqual(mockProject);
      expect(createProject).toHaveBeenCalledWith(TEST_USER_EMAIL, {
        name: "New Project",
        description: "A test project",
      });
    });

    it("should return 400 when name is missing", async () => {
      mockAuthenticated();

      const req = createRequest("POST", "/api/projects", {
        description: "No name provided",
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 400 when name is empty string", async () => {
      mockAuthenticated();

      const req = createRequest("POST", "/api/projects", {
        name: "",
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 400 when color has invalid format", async () => {
      mockAuthenticated();

      const req = createRequest("POST", "/api/projects", {
        name: "Test",
        color: "not-a-color",
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 400 when project name already exists", async () => {
      mockAuthenticated();
      vi.mocked(createProject).mockRejectedValue(new Error("Project already exists"));

      const req = createRequest("POST", "/api/projects", {
        name: "Duplicate",
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 403 when project limit is reached", async () => {
      mockAuthenticated();
      vi.mocked(createProject).mockRejectedValue(new Error("Project limit reached"));

      const req = createRequest("POST", "/api/projects", {
        name: "One Too Many",
      });
      const res = await POST(req);

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 500 when createProject throws unexpected error", async () => {
      mockAuthenticated();
      vi.mocked(createProject).mockRejectedValue(new Error("Unexpected"));

      const req = createRequest("POST", "/api/projects", {
        name: "Crash",
      });
      const res = await POST(req);

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });
});
