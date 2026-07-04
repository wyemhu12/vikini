// /app/api/projects/[id]/knowledge/search/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks - declared BEFORE importing the route handlers
// ---------------------------------------------------------------------------

vi.mock("@/lib/features/auth/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/features/projects/knowledge.server", () => ({
  searchKnowledge: vi.fn(),
}));

vi.mock("@/lib/features/projects/projects.server", () => ({
  getProject: vi.fn(),
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

import { POST } from "./route";
import { auth } from "@/lib/features/auth/auth";
import { searchKnowledge } from "@/lib/features/projects/knowledge.server";
import { getProject } from "@/lib/features/projects/projects.server";

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
  userId: TEST_USER_EMAIL,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("/api/projects/[id]/knowledge/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ======================== POST ========================
  describe("POST", () => {
    it("should return 401 if not authenticated", async () => {
      mockUnauthenticated();

      const req = createRequest("POST", `/api/projects/${TEST_PROJECT_ID}/knowledge/search`, {
        query: "test query",
      });
      const res = await POST(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return search results on success", async () => {
      mockAuthenticated();
      vi.mocked(getProject).mockResolvedValue(MOCK_PROJECT as never);
      const mockResults = [
        { content: "matching text", score: 0.95, documentId: "doc-1" },
        { content: "another match", score: 0.8, documentId: "doc-2" },
      ];
      vi.mocked(searchKnowledge).mockResolvedValue(mockResults as never);

      const req = createRequest("POST", `/api/projects/${TEST_PROJECT_ID}/knowledge/search`, {
        query: "test query",
      });
      const res = await POST(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.results).toEqual(mockResults);
      expect(json.data.query).toBe("test query");
      expect(json.data.project_id).toBe(TEST_PROJECT_ID);
      expect(searchKnowledge).toHaveBeenCalledWith(TEST_PROJECT_ID, TEST_USER_EMAIL, "test query", {
        threshold: undefined,
        limit: undefined,
      });
    });

    it("should pass threshold and limit options", async () => {
      mockAuthenticated();
      vi.mocked(getProject).mockResolvedValue(MOCK_PROJECT as never);
      vi.mocked(searchKnowledge).mockResolvedValue([] as never);

      const req = createRequest("POST", `/api/projects/${TEST_PROJECT_ID}/knowledge/search`, {
        query: "test",
        threshold: 0.7,
        limit: 5,
      });
      const res = await POST(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(200);
      expect(searchKnowledge).toHaveBeenCalledWith(TEST_PROJECT_ID, TEST_USER_EMAIL, "test", {
        threshold: 0.7,
        limit: 5,
      });
    });

    it("should return 404 when project is not found", async () => {
      mockAuthenticated();
      vi.mocked(getProject).mockResolvedValue(null as never);

      const req = createRequest("POST", `/api/projects/${TEST_PROJECT_ID}/knowledge/search`, {
        query: "test query",
      });
      const res = await POST(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 400 when query is missing", async () => {
      mockAuthenticated();
      vi.mocked(getProject).mockResolvedValue(MOCK_PROJECT as never);

      const req = createRequest("POST", `/api/projects/${TEST_PROJECT_ID}/knowledge/search`, {});
      const res = await POST(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 400 when query is empty string", async () => {
      mockAuthenticated();
      vi.mocked(getProject).mockResolvedValue(MOCK_PROJECT as never);

      const req = createRequest("POST", `/api/projects/${TEST_PROJECT_ID}/knowledge/search`, {
        query: "",
      });
      const res = await POST(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 400 when query exceeds max length", async () => {
      mockAuthenticated();
      vi.mocked(getProject).mockResolvedValue(MOCK_PROJECT as never);

      const req = createRequest("POST", `/api/projects/${TEST_PROJECT_ID}/knowledge/search`, {
        query: "x".repeat(1001),
      });
      const res = await POST(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 400 when limit is out of range", async () => {
      mockAuthenticated();
      vi.mocked(getProject).mockResolvedValue(MOCK_PROJECT as never);

      const req = createRequest("POST", `/api/projects/${TEST_PROJECT_ID}/knowledge/search`, {
        query: "test",
        limit: 50,
      });
      const res = await POST(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 400 when threshold is out of range", async () => {
      mockAuthenticated();
      vi.mocked(getProject).mockResolvedValue(MOCK_PROJECT as never);

      const req = createRequest("POST", `/api/projects/${TEST_PROJECT_ID}/knowledge/search`, {
        query: "test",
        threshold: 2.0,
      });
      const res = await POST(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 500 when searchKnowledge throws", async () => {
      mockAuthenticated();
      vi.mocked(getProject).mockResolvedValue(MOCK_PROJECT as never);
      vi.mocked(searchKnowledge).mockRejectedValue(new Error("Embedding service down"));

      const req = createRequest("POST", `/api/projects/${TEST_PROJECT_ID}/knowledge/search`, {
        query: "test query",
      });
      const res = await POST(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });
});
