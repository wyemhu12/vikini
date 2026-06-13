// /app/api/projects/[id]/knowledge/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks — declared BEFORE importing the route handlers
// ---------------------------------------------------------------------------

vi.mock("@/lib/features/auth/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/features/projects/knowledge.server", () => ({
  getProjectDocuments: vi.fn(),
  uploadDocument: vi.fn(),
  deleteDocument: vi.fn(),
}));

vi.mock("@/lib/features/projects/projects.server", () => ({
  getProject: vi.fn(),
}));

vi.mock("@/types/projects", () => ({
  isSupportedFileType: vi.fn(),
  ALL_SUPPORTED_EXTENSIONS: [".txt", ".md", ".pdf"],
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

import { GET, POST, DELETE } from "./route";
import { auth } from "@/lib/features/auth/auth";
import {
  getProjectDocuments,
  uploadDocument,
  deleteDocument,
} from "@/lib/features/projects/knowledge.server";
import { getProject } from "@/lib/features/projects/projects.server";
import { isSupportedFileType } from "@/types/projects";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_USER_EMAIL = "test@example.com";
const TEST_PROJECT_ID = "proj-abc-123";
const TEST_DOC_ID = "doc-xyz-456";

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
  storage_bytes: 1024,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("/api/projects/[id]/knowledge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ======================== GET ========================
  describe("GET", () => {
    it("should return 401 if not authenticated", async () => {
      mockUnauthenticated();

      const req = createRequest("GET", `/api/projects/${TEST_PROJECT_ID}/knowledge`);
      const res = await GET(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should list documents for the project", async () => {
      mockAuthenticated();
      vi.mocked(getProject).mockResolvedValue(MOCK_PROJECT as never);
      const mockDocs = [{ id: TEST_DOC_ID, filename: "test.txt", projectId: TEST_PROJECT_ID }];
      vi.mocked(getProjectDocuments).mockResolvedValue(mockDocs as never);

      const req = createRequest("GET", `/api/projects/${TEST_PROJECT_ID}/knowledge`);
      const res = await GET(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.documents).toEqual(mockDocs);
      expect(json.data.project_id).toBe(TEST_PROJECT_ID);
      expect(json.data.storage_used_bytes).toBe(1024);
      expect(getProjectDocuments).toHaveBeenCalledWith(TEST_PROJECT_ID, TEST_USER_EMAIL);
    });

    it("should return 404 when project is not found", async () => {
      mockAuthenticated();
      vi.mocked(getProject).mockResolvedValue(null as never);

      const req = createRequest("GET", `/api/projects/${TEST_PROJECT_ID}/knowledge`);
      const res = await GET(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 500 when getProjectDocuments throws", async () => {
      mockAuthenticated();
      vi.mocked(getProject).mockResolvedValue(MOCK_PROJECT as never);
      vi.mocked(getProjectDocuments).mockRejectedValue(new Error("DB error"));

      const req = createRequest("GET", `/api/projects/${TEST_PROJECT_ID}/knowledge`);
      const res = await GET(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  // ======================== POST ========================
  describe("POST", () => {
    it("should return 401 if not authenticated", async () => {
      mockUnauthenticated();

      const req = createRequest("POST", `/api/projects/${TEST_PROJECT_ID}/knowledge`, {
        filename: "notes.txt",
        content: "Hello world",
      });
      const res = await POST(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should upload a document successfully", async () => {
      mockAuthenticated();
      vi.mocked(getProject).mockResolvedValue(MOCK_PROJECT as never);
      vi.mocked(isSupportedFileType).mockReturnValue(true);
      const mockDoc = {
        id: TEST_DOC_ID,
        filename: "notes.txt",
        projectId: TEST_PROJECT_ID,
      };
      vi.mocked(uploadDocument).mockResolvedValue(mockDoc as never);

      const req = createRequest("POST", `/api/projects/${TEST_PROJECT_ID}/knowledge`, {
        filename: "notes.txt",
        content: "Hello world",
      });
      const res = await POST(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.document).toEqual(mockDoc);
      expect(uploadDocument).toHaveBeenCalledWith({
        projectId: TEST_PROJECT_ID,
        userId: TEST_USER_EMAIL,
        filename: "notes.txt",
        content: "Hello world",
        mimeType: undefined,
        embeddingModel: undefined,
      });
    });

    it("should return 404 when project is not found", async () => {
      mockAuthenticated();
      vi.mocked(getProject).mockResolvedValue(null as never);

      const req = createRequest("POST", `/api/projects/${TEST_PROJECT_ID}/knowledge`, {
        filename: "notes.txt",
        content: "Hello world",
      });
      const res = await POST(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 400 when filename is missing", async () => {
      mockAuthenticated();
      vi.mocked(getProject).mockResolvedValue(MOCK_PROJECT as never);

      const req = createRequest("POST", `/api/projects/${TEST_PROJECT_ID}/knowledge`, {
        content: "Hello world",
      });
      const res = await POST(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 400 when content is missing", async () => {
      mockAuthenticated();
      vi.mocked(getProject).mockResolvedValue(MOCK_PROJECT as never);

      const req = createRequest("POST", `/api/projects/${TEST_PROJECT_ID}/knowledge`, {
        filename: "notes.txt",
      });
      const res = await POST(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 400 when file type is unsupported", async () => {
      mockAuthenticated();
      vi.mocked(getProject).mockResolvedValue(MOCK_PROJECT as never);
      vi.mocked(isSupportedFileType).mockReturnValue(false);

      const req = createRequest("POST", `/api/projects/${TEST_PROJECT_ID}/knowledge`, {
        filename: "virus.exe",
        content: "bad content",
      });
      const res = await POST(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 403 when storage limit is exceeded", async () => {
      mockAuthenticated();
      vi.mocked(getProject).mockResolvedValue(MOCK_PROJECT as never);
      vi.mocked(isSupportedFileType).mockReturnValue(true);
      vi.mocked(uploadDocument).mockRejectedValue(new Error("Storage limit exceeded"));

      const req = createRequest("POST", `/api/projects/${TEST_PROJECT_ID}/knowledge`, {
        filename: "big.txt",
        content: "a".repeat(1000),
      });
      const res = await POST(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 500 when uploadDocument throws unexpected error", async () => {
      mockAuthenticated();
      vi.mocked(getProject).mockResolvedValue(MOCK_PROJECT as never);
      vi.mocked(isSupportedFileType).mockReturnValue(true);
      vi.mocked(uploadDocument).mockRejectedValue(new Error("Unexpected"));

      const req = createRequest("POST", `/api/projects/${TEST_PROJECT_ID}/knowledge`, {
        filename: "notes.txt",
        content: "Hello world",
      });
      const res = await POST(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  // ======================== DELETE ========================
  describe("DELETE", () => {
    it("should return 401 if not authenticated", async () => {
      mockUnauthenticated();

      const req = createRequest(
        "DELETE",
        `/api/projects/${TEST_PROJECT_ID}/knowledge?documentId=${TEST_DOC_ID}`
      );
      const res = await DELETE(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should delete a document successfully", async () => {
      mockAuthenticated();
      vi.mocked(getProject).mockResolvedValue(MOCK_PROJECT as never);
      vi.mocked(deleteDocument).mockResolvedValue(undefined as never);

      const req = createRequest(
        "DELETE",
        `/api/projects/${TEST_PROJECT_ID}/knowledge?documentId=${TEST_DOC_ID}`
      );
      const res = await DELETE(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.deleted).toBe(true);
      expect(deleteDocument).toHaveBeenCalledWith(TEST_DOC_ID, TEST_USER_EMAIL);
    });

    it("should return 404 when project is not found", async () => {
      mockAuthenticated();
      vi.mocked(getProject).mockResolvedValue(null as never);

      const req = createRequest(
        "DELETE",
        `/api/projects/${TEST_PROJECT_ID}/knowledge?documentId=${TEST_DOC_ID}`
      );
      const res = await DELETE(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 400 when documentId query param is missing", async () => {
      mockAuthenticated();
      vi.mocked(getProject).mockResolvedValue(MOCK_PROJECT as never);

      const req = createRequest("DELETE", `/api/projects/${TEST_PROJECT_ID}/knowledge`);
      const res = await DELETE(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 500 when deleteDocument throws", async () => {
      mockAuthenticated();
      vi.mocked(getProject).mockResolvedValue(MOCK_PROJECT as never);
      vi.mocked(deleteDocument).mockRejectedValue(new Error("DB error"));

      const req = createRequest(
        "DELETE",
        `/api/projects/${TEST_PROJECT_ID}/knowledge?documentId=${TEST_DOC_ID}`
      );
      const res = await DELETE(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });
});
