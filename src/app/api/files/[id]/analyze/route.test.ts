// Tests for POST /api/files/[id]/analyze
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ============================================================================
// Mocks - declared BEFORE importing the route
// ============================================================================

vi.mock("@/app/api/conversations/auth", () => ({
  requireUser: vi.fn(),
}));

vi.mock("@/lib/features/files/fileService.server", () => ({
  downloadFileBytes: vi.fn(),
}));

vi.mock("@/lib/features/files/fileProcessors", () => ({
  analyzeWithAI: vi.fn(),
}));

vi.mock("@/lib/utils/logger", () => ({
  logger: {
    withContext: () => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

// ============================================================================
// Imports - AFTER mocks
// ============================================================================

import { POST } from "./route";
import { requireUser } from "@/app/api/conversations/auth";
import { downloadFileBytes } from "@/lib/features/files/fileService.server";
import { analyzeWithAI } from "@/lib/features/files/fileProcessors";

// ============================================================================
// Helpers
// ============================================================================

const VALID_FILE_ID = "a1b2c3d4-e5f6-7890-abcd-ef0123456789";

function createRequest(method: string, url: string, body?: unknown): NextRequest {
  const init = {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

function mockUnauthorized() {
  vi.mocked(requireUser).mockResolvedValue({
    ok: false,
    response: new Response(
      JSON.stringify({ success: false, error: { message: "Unauthorized", code: "UNAUTHORIZED" } }),
      { status: 401 }
    ) as unknown as import("next/server").NextResponse,
  });
}

function mockAuthorized(userId = "test@test.com") {
  vi.mocked(requireUser).mockResolvedValue({
    ok: true,
    userId,
    session: {},
  });
}

// ============================================================================
// Tests
// ============================================================================

describe("/api/files/[id]/analyze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // Auth
  // --------------------------------------------------------------------------
  describe("POST - Auth", () => {
    it("should return 401 if not authenticated", async () => {
      mockUnauthorized();

      const req = createRequest("POST", `/api/files/${VALID_FILE_ID}/analyze`);
      const res = await POST(req, { params: Promise.resolve({ id: VALID_FILE_ID }) });
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Validation
  // --------------------------------------------------------------------------
  describe("POST - Validation", () => {
    it("should return 400 when file id is empty", async () => {
      mockAuthorized();

      const req = createRequest("POST", "/api/files//analyze");
      const res = await POST(req, { params: Promise.resolve({ id: "" }) });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });
  });

  // --------------------------------------------------------------------------
  // Happy path
  // --------------------------------------------------------------------------
  describe("POST - Happy path", () => {
    it("should analyze file and return analysis result", async () => {
      mockAuthorized();

      const mockRow = {
        id: VALID_FILE_ID,
        filename: "document.pdf",
        mime_type: "application/pdf",
        storage_path: "uploads/document.pdf",
      };
      const mockBytes = new ArrayBuffer(10);

      vi.mocked(downloadFileBytes).mockResolvedValue({
        row: mockRow,
        bytes: mockBytes,
      } as unknown as Awaited<ReturnType<typeof downloadFileBytes>>);

      vi.mocked(analyzeWithAI).mockResolvedValue(
        "This document contains financial data." as Awaited<ReturnType<typeof analyzeWithAI>>
      );

      const req = createRequest("POST", `/api/files/${VALID_FILE_ID}/analyze`);
      const res = await POST(req, { params: Promise.resolve({ id: VALID_FILE_ID }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.analysis).toBe("This document contains financial data.");
      expect(json.data.filename).toBe("document.pdf");

      expect(downloadFileBytes).toHaveBeenCalledWith({
        userId: "test@test.com",
        id: VALID_FILE_ID,
      });
    });
  });

  // --------------------------------------------------------------------------
  // Error handling
  // --------------------------------------------------------------------------
  describe("POST - Error handling", () => {
    it("should return 500 when downloadFileBytes throws", async () => {
      mockAuthorized();
      vi.mocked(downloadFileBytes).mockRejectedValue(new Error("Storage down"));

      const req = createRequest("POST", `/api/files/${VALID_FILE_ID}/analyze`);
      const res = await POST(req, { params: Promise.resolve({ id: VALID_FILE_ID }) });
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
    });

    it("should return 500 when analyzeWithAI throws", async () => {
      mockAuthorized();

      vi.mocked(downloadFileBytes).mockResolvedValue({
        row: { id: VALID_FILE_ID, filename: "doc.pdf", mime_type: "application/pdf" },
        bytes: new ArrayBuffer(10),
      } as unknown as Awaited<ReturnType<typeof downloadFileBytes>>);
      vi.mocked(analyzeWithAI).mockRejectedValue(new Error("AI service unavailable"));

      const req = createRequest("POST", `/api/files/${VALID_FILE_ID}/analyze`);
      const res = await POST(req, { params: Promise.resolve({ id: VALID_FILE_ID }) });
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
    });
  });
});
