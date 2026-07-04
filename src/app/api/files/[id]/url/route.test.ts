// Tests for GET /api/files/[id]/url
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ============================================================================
// Mocks - declared BEFORE importing the route
// ============================================================================

vi.mock("@/app/api/conversations/auth", () => ({
  requireUser: vi.fn(),
}));

vi.mock("@/lib/features/files/fileService.server", () => ({
  createSignedUrl: vi.fn(),
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

import { GET } from "./route";
import { requireUser } from "@/app/api/conversations/auth";
import { createSignedUrl } from "@/lib/features/files/fileService.server";

// ============================================================================
// Helpers
// ============================================================================

const VALID_FILE_ID = "a1b2c3d4-e5f6-7890-abcd-ef0123456789";

function createRequest(method: string, url: string): NextRequest {
  const init = {
    method,
    headers: { "Content-Type": "application/json" },
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

describe("/api/files/[id]/url", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // Auth
  // --------------------------------------------------------------------------
  describe("GET - Auth", () => {
    it("should return 401 if not authenticated", async () => {
      mockUnauthorized();

      const req = createRequest("GET", `/api/files/${VALID_FILE_ID}/url`);
      const res = await GET(req, { params: Promise.resolve({ id: VALID_FILE_ID }) });
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Validation
  // --------------------------------------------------------------------------
  describe("GET - Validation", () => {
    it("should return 400 when file id is empty", async () => {
      mockAuthorized();

      const req = createRequest("GET", "/api/files//url");
      const res = await GET(req, { params: Promise.resolve({ id: "" }) });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });
  });

  // --------------------------------------------------------------------------
  // Happy path
  // --------------------------------------------------------------------------
  describe("GET - Happy path", () => {
    it("should return signed URL on success", async () => {
      mockAuthorized();

      const signedUrlData = {
        url: "https://storage.example.com/signed/test-file?token=abc123",
        expiresAt: "2026-01-01T01:00:00Z",
      };
      vi.mocked(createSignedUrl).mockResolvedValue(
        signedUrlData as unknown as Awaited<ReturnType<typeof createSignedUrl>>
      );

      const req = createRequest("GET", `/api/files/${VALID_FILE_ID}/url`);
      const res = await GET(req, { params: Promise.resolve({ id: VALID_FILE_ID }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.url).toBe(signedUrlData.url);
      expect(json.data.expiresAt).toBe(signedUrlData.expiresAt);

      expect(createSignedUrl).toHaveBeenCalledWith({
        userId: "test@test.com",
        id: VALID_FILE_ID,
      });
    });
  });

  // --------------------------------------------------------------------------
  // Error handling
  // --------------------------------------------------------------------------
  describe("GET - Error handling", () => {
    it("should return 500 when createSignedUrl throws unexpected error", async () => {
      mockAuthorized();
      vi.mocked(createSignedUrl).mockRejectedValue(new Error("Storage down"));

      const req = createRequest("GET", `/api/files/${VALID_FILE_ID}/url`);
      const res = await GET(req, { params: Promise.resolve({ id: VALID_FILE_ID }) });
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
    });

    it("should propagate AppError with correct status code", async () => {
      mockAuthorized();

      // Simulate a NotFoundError thrown by createSignedUrl
      const { NotFoundError } = await import("@/lib/utils/errors");
      vi.mocked(createSignedUrl).mockRejectedValue(new NotFoundError("File"));

      const req = createRequest("GET", `/api/files/${VALID_FILE_ID}/url`);
      const res = await GET(req, { params: Promise.resolve({ id: VALID_FILE_ID }) });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("NOT_FOUND");
    });
  });
});
