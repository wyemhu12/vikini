// /app/api/projects/[id]/knowledge/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks - declared BEFORE importing the route handlers
// ---------------------------------------------------------------------------

vi.mock("@/lib/features/auth/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/features/auth/requireApprovedUser", () => ({
  requireApprovedUser: vi.fn(),
}));

vi.mock("@/lib/core/rateLimit", () => ({
  consumeRateLimit: vi.fn(),
}));

vi.mock("@/lib/features/projects/knowledge.server", () => ({
  getProjectDocuments: vi.fn(),
  uploadDocument: vi.fn(),
  deleteDocument: vi.fn(),
  cleanupStuckProcessingDocuments: vi.fn().mockResolvedValue(0),
}));

vi.mock("@/lib/features/projects/projects.server", () => ({
  getProject: vi.fn(),
}));

vi.mock("@/types/projects", () => ({
  isSupportedFileType: vi.fn(),
  ALL_SUPPORTED_EXTENSIONS: [".txt", ".md", ".pdf"],
}));

vi.mock("@/lib/features/files/documentParsers", () => ({
  extractDocumentText: vi.fn(),
  isBinaryCorruptText: vi.fn(),
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

import { GET, POST, DELETE } from "./route";
import { auth } from "@/lib/features/auth/auth";
import { requireApprovedUser } from "@/lib/features/auth/requireApprovedUser";
import { consumeRateLimit } from "@/lib/core/rateLimit";
import { AccessPendingError, UnauthorizedError } from "@/lib/utils/errors";
import {
  getProjectDocuments,
  uploadDocument,
  deleteDocument,
  cleanupStuckProcessingDocuments,
} from "@/lib/features/projects/knowledge.server";
import { getProject } from "@/lib/features/projects/projects.server";
import { isSupportedFileType } from "@/types/projects";
import { extractDocumentText, isBinaryCorruptText } from "@/lib/features/files/documentParsers";

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
  vi.mocked(requireApprovedUser).mockResolvedValue({ userId: TEST_USER_EMAIL, rank: "basic" });
  vi.mocked(consumeRateLimit).mockResolvedValue({
    allowed: true,
    limit: 10,
    remaining: 9,
    resetInMs: 0,
    retryAfterSeconds: 0,
    backend: "memory",
  } as Awaited<ReturnType<typeof consumeRateLimit>>);
}

function mockUnauthenticated() {
  vi.mocked(auth).mockResolvedValue(null as unknown as Awaited<ReturnType<typeof auth>>);
  vi.mocked(requireApprovedUser).mockRejectedValue(new UnauthorizedError());
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
      expect(cleanupStuckProcessingDocuments).toHaveBeenCalledWith(TEST_PROJECT_ID);
      expect(getProjectDocuments).toHaveBeenCalledWith(TEST_PROJECT_ID, TEST_USER_EMAIL);
    });

    it("should succeed and return documents even if opportunistic cleanup throws", async () => {
      mockAuthenticated();
      vi.mocked(getProject).mockResolvedValue(MOCK_PROJECT as never);
      const mockDocs = [{ id: TEST_DOC_ID, filename: "test.txt", projectId: TEST_PROJECT_ID }];
      vi.mocked(getProjectDocuments).mockResolvedValue(mockDocs as never);
      vi.mocked(cleanupStuckProcessingDocuments).mockRejectedValueOnce(
        new Error("Cleanup DB timeout")
      );

      const req = createRequest("GET", `/api/projects/${TEST_PROJECT_ID}/knowledge`);
      const res = await GET(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.documents).toEqual(mockDocs);
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

    it("should return 403 ACCESS_PENDING for unapproved users without touching the project", async () => {
      mockAuthenticated();
      vi.mocked(requireApprovedUser).mockRejectedValue(new AccessPendingError());

      const req = createRequest("POST", `/api/projects/${TEST_PROJECT_ID}/knowledge`, {
        filename: "a.txt",
        content: "hello",
      });
      const res = await POST(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.code).toBe("ACCESS_PENDING");
      expect(getProject).not.toHaveBeenCalled();
      expect(uploadDocument).not.toHaveBeenCalled();
    });

    it("should return 429 when the upload rate limit is exceeded", async () => {
      mockAuthenticated();
      vi.mocked(consumeRateLimit).mockResolvedValue({
        allowed: false,
        limit: 10,
        remaining: 0,
        resetInMs: 30000,
        retryAfterSeconds: 30,
        backend: "memory",
      } as Awaited<ReturnType<typeof consumeRateLimit>>);

      const req = createRequest("POST", `/api/projects/${TEST_PROJECT_ID}/knowledge`, {
        filename: "a.txt",
        content: "hello",
      });
      const res = await POST(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(429);
      expect(consumeRateLimit).toHaveBeenCalledWith(`knowledge-upload:${TEST_USER_EMAIL}`);
      expect(uploadDocument).not.toHaveBeenCalled();
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
      });
    });

    it("should return 400 when embedding_model is provided in upload body (TC-EMB-03)", async () => {
      mockAuthenticated();
      vi.mocked(getProject).mockResolvedValue(MOCK_PROJECT as never);

      const req = createRequest("POST", `/api/projects/${TEST_PROJECT_ID}/knowledge`, {
        filename: "notes.txt",
        content: "Hello world",
        embedding_model: "gemini-embedding-2",
      });
      const res = await POST(req, createParams(TEST_PROJECT_ID));

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toContain(
        "embedding_model cannot be specified for knowledge uploads"
      );
      expect(uploadDocument).not.toHaveBeenCalled();
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

    // ---------------- Multipart Tests ----------------
    it("should return 413 when content-length exceeds 4.5MB", async () => {
      mockAuthenticated();
      vi.mocked(getProject).mockResolvedValue(MOCK_PROJECT as never);

      const req = new NextRequest(
        new URL(`/api/projects/${TEST_PROJECT_ID}/knowledge`, "http://localhost:3000"),
        {
          method: "POST",
          headers: {
            "content-type": "multipart/form-data; boundary=---boundary",
          },
          body: new Uint8Array(10),
        }
      );
      const originalGet = req.headers.get.bind(req.headers);
      vi.spyOn(req.headers, "get").mockImplementation((key: string) => {
        if (key.toLowerCase() === "content-length") {
          return String(5 * 1024 * 1024);
        }
        return originalGet(key);
      });

      const res = await POST(req, createParams(TEST_PROJECT_ID));
      expect(res.status).toBe(413);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toContain("4.5MB");
    });

    it("should successfully upload document via multipart", async () => {
      mockAuthenticated();
      vi.mocked(getProject).mockResolvedValue(MOCK_PROJECT as never);
      vi.mocked(isSupportedFileType).mockReturnValue(true);
      vi.mocked(extractDocumentText).mockResolvedValue("Clean extracted document text");
      vi.mocked(isBinaryCorruptText).mockReturnValue(false);
      vi.mocked(uploadDocument).mockResolvedValue({
        id: "doc-multi-1",
        project_id: TEST_PROJECT_ID,
        filename: "test.pdf",
        mime_type: "application/pdf",
        status: "completed",
        document_type: "document",
      } as never);

      const formData = new FormData();
      const file = new File(["dummy pdf content"], "test.pdf", { type: "application/pdf" });
      formData.append("file", file);

      const req = new NextRequest(
        new URL(`/api/projects/${TEST_PROJECT_ID}/knowledge`, "http://localhost:3000"),
        {
          method: "POST",
          body: formData,
        }
      );

      const res = await POST(req, createParams(TEST_PROJECT_ID));
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.truncated).toBe(false);
      expect(json.data.document.id).toBe("doc-multi-1");
      expect(uploadDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: TEST_PROJECT_ID,
          userId: TEST_USER_EMAIL,
          filename: "test.pdf",
          content: "Clean extracted document text",
          mimeType: "application/pdf",
        })
      );
    });

    it("should flag truncated: true when text extraction reaches 400000 chars", async () => {
      mockAuthenticated();
      vi.mocked(getProject).mockResolvedValue(MOCK_PROJECT as never);
      vi.mocked(isSupportedFileType).mockReturnValue(true);
      vi.mocked(extractDocumentText).mockResolvedValue("a".repeat(400000));
      vi.mocked(isBinaryCorruptText).mockReturnValue(false);
      vi.mocked(uploadDocument).mockResolvedValue({
        id: "doc-multi-trunc",
        project_id: TEST_PROJECT_ID,
        filename: "long.pdf",
        mime_type: "application/pdf",
        status: "completed",
        document_type: "document",
      } as never);

      const formData = new FormData();
      const file = new File(["long content"], "long.pdf", { type: "application/pdf" });
      formData.append("file", file);

      const req = new NextRequest(
        new URL(`/api/projects/${TEST_PROJECT_ID}/knowledge`, "http://localhost:3000"),
        {
          method: "POST",
          body: formData,
        }
      );

      const res = await POST(req, createParams(TEST_PROJECT_ID));
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.truncated).toBe(true);
    });

    it("should return 400 when multipart file exceeds 4MB", async () => {
      mockAuthenticated();
      vi.mocked(getProject).mockResolvedValue(MOCK_PROJECT as never);

      const formData = new FormData();
      // create real byte array > 4MB (4 * 1024 * 1024 + 1024 bytes)
      const bigBytes = new Uint8Array(4 * 1024 * 1024 + 1024);
      const file = new File([bigBytes], "large.pdf", { type: "application/pdf" });
      formData.append("file", file);

      const req = new NextRequest(
        new URL(`/api/projects/${TEST_PROJECT_ID}/knowledge`, "http://localhost:3000"),
        {
          method: "POST",
          body: formData,
        }
      );

      const res = await POST(req, createParams(TEST_PROJECT_ID));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.message).toContain("File size exceeds 4MB limit");
    });

    it("should return 400 when multipart file type is unsupported", async () => {
      mockAuthenticated();
      vi.mocked(getProject).mockResolvedValue(MOCK_PROJECT as never);
      vi.mocked(isSupportedFileType).mockReturnValue(false);

      const formData = new FormData();
      const file = new File(["binary"], "bad.exe", { type: "application/octet-stream" });
      formData.append("file", file);

      const req = new NextRequest(
        new URL(`/api/projects/${TEST_PROJECT_ID}/knowledge`, "http://localhost:3000"),
        {
          method: "POST",
          body: formData,
        }
      );

      const res = await POST(req, createParams(TEST_PROJECT_ID));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.message).toContain("Unsupported file type");
    });

    it("should return 400 when multipart contains embedding_model", async () => {
      mockAuthenticated();
      vi.mocked(getProject).mockResolvedValue(MOCK_PROJECT as never);

      const formData = new FormData();
      const file = new File(["hello"], "valid.txt", { type: "text/plain" });
      formData.append("file", file);
      formData.append("embedding_model", "text-embedding-3-small");

      const req = new NextRequest(
        new URL(`/api/projects/${TEST_PROJECT_ID}/knowledge`, "http://localhost:3000"),
        {
          method: "POST",
          body: formData,
        }
      );

      const res = await POST(req, createParams(TEST_PROJECT_ID));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.message).toContain("embedding_model cannot be specified");
    });

    it("should return 400 when extractDocumentText returns null or corrupt text", async () => {
      mockAuthenticated();
      vi.mocked(getProject).mockResolvedValue(MOCK_PROJECT as never);
      vi.mocked(isSupportedFileType).mockReturnValue(true);
      vi.mocked(extractDocumentText).mockResolvedValue(null);

      const formData = new FormData();
      const file = new File(["bad data"], "corrupt.pdf", { type: "application/pdf" });
      formData.append("file", file);

      const req = new NextRequest(
        new URL(`/api/projects/${TEST_PROJECT_ID}/knowledge`, "http://localhost:3000"),
        {
          method: "POST",
          body: formData,
        }
      );

      const res = await POST(req, createParams(TEST_PROJECT_ID));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.message).toContain("Could not extract clean text from document");
    });

    it("should return 400 when multipart form has no file", async () => {
      mockAuthenticated();
      vi.mocked(getProject).mockResolvedValue(MOCK_PROJECT as never);

      const formData = new FormData();
      formData.append("other_field", "value");

      const req = new NextRequest(
        new URL(`/api/projects/${TEST_PROJECT_ID}/knowledge`, "http://localhost:3000"),
        {
          method: "POST",
          body: formData,
        }
      );

      const res = await POST(req, createParams(TEST_PROJECT_ID));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.message).toContain("Missing file");
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
