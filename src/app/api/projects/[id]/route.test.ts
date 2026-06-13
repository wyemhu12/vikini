// /app/api/projects/[id]/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks — declared BEFORE importing the route handlers
// ---------------------------------------------------------------------------

vi.mock("@/lib/features/auth/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/features/projects/projects.server", () => ({
  getProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
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
// Imports — AFTER mocks are set up
// ---------------------------------------------------------------------------

import { GET, PATCH, DELETE } from "./route";
import { auth } from "@/lib/features/auth/auth";
import { getProject, updateProject, deleteProject } from "@/lib/features/projects/projects.server";

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

function createParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

const MOCK_PROJECT = {
  id: TEST_PROJECT_ID,
  name: "Test Project",
  description: "A test project",
  userId: TEST_USER_EMAIL,
  storage_bytes: 0,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("/api/projects/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ======================== GET ========================
  describe("GET", () => {
    it("should return 401 if not authenticated", async () => {
      mockUnauthenticated();

      const req = createRequest("GET", `/api/projects/${TEST_PROJECT_ID}`);
      const res = await GET(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return project details on success", async () => {
      mockAuthenticated();
      vi.mocked(getProject).mockResolvedValue(MOCK_PROJECT as never);

      const req = createRequest("GET", `/api/projects/${TEST_PROJECT_ID}`);
      const res = await GET(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.project).toEqual(MOCK_PROJECT);
      expect(getProject).toHaveBeenCalledWith(TEST_PROJECT_ID, TEST_USER_EMAIL);
    });

    it("should return 404 when project is not found", async () => {
      mockAuthenticated();
      vi.mocked(getProject).mockResolvedValue(null as never);

      const req = createRequest("GET", `/api/projects/${TEST_PROJECT_ID}`);
      const res = await GET(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 500 when getProject throws", async () => {
      mockAuthenticated();
      vi.mocked(getProject).mockRejectedValue(new Error("DB error"));

      const req = createRequest("GET", `/api/projects/${TEST_PROJECT_ID}`);
      const res = await GET(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  // ======================== PATCH ========================
  describe("PATCH", () => {
    it("should return 401 if not authenticated", async () => {
      mockUnauthenticated();

      const req = createRequest("PATCH", `/api/projects/${TEST_PROJECT_ID}`, {
        name: "Updated",
      });
      const res = await PATCH(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should update project successfully", async () => {
      mockAuthenticated();
      const updatedProject = { ...MOCK_PROJECT, name: "Updated Name" };
      vi.mocked(updateProject).mockResolvedValue(updatedProject as never);

      const req = createRequest("PATCH", `/api/projects/${TEST_PROJECT_ID}`, {
        name: "Updated Name",
      });
      const res = await PATCH(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.project.name).toBe("Updated Name");
      expect(updateProject).toHaveBeenCalledWith(TEST_PROJECT_ID, TEST_USER_EMAIL, {
        name: "Updated Name",
      });
    });

    it("should return 400 when color has invalid format", async () => {
      mockAuthenticated();

      const req = createRequest("PATCH", `/api/projects/${TEST_PROJECT_ID}`, {
        color: "invalid",
      });
      const res = await PATCH(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 400 when name exceeds max length", async () => {
      mockAuthenticated();

      const req = createRequest("PATCH", `/api/projects/${TEST_PROJECT_ID}`, {
        name: "x".repeat(101),
      });
      const res = await PATCH(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 500 when updateProject throws", async () => {
      mockAuthenticated();
      vi.mocked(updateProject).mockRejectedValue(new Error("Unexpected"));

      const req = createRequest("PATCH", `/api/projects/${TEST_PROJECT_ID}`, {
        name: "Valid",
      });
      const res = await PATCH(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  // ======================== DELETE ========================
  describe("DELETE", () => {
    it("should return 401 if not authenticated", async () => {
      mockUnauthenticated();

      const req = createRequest("DELETE", `/api/projects/${TEST_PROJECT_ID}`);
      const res = await DELETE(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should delete a project successfully", async () => {
      mockAuthenticated();
      vi.mocked(getProject).mockResolvedValue(MOCK_PROJECT as never);
      vi.mocked(deleteProject).mockResolvedValue(undefined as never);

      const req = createRequest("DELETE", `/api/projects/${TEST_PROJECT_ID}`);
      const res = await DELETE(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.deleted).toBe(true);
      expect(deleteProject).toHaveBeenCalledWith(TEST_PROJECT_ID, TEST_USER_EMAIL);
    });

    it("should return 404 when project is not found", async () => {
      mockAuthenticated();
      vi.mocked(getProject).mockResolvedValue(null as never);

      const req = createRequest("DELETE", `/api/projects/${TEST_PROJECT_ID}`);
      const res = await DELETE(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 500 when deleteProject throws", async () => {
      mockAuthenticated();
      vi.mocked(getProject).mockResolvedValue(MOCK_PROJECT as never);
      vi.mocked(deleteProject).mockRejectedValue(new Error("Cascade failed"));

      const req = createRequest("DELETE", `/api/projects/${TEST_PROJECT_ID}`);
      const res = await DELETE(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });
});
