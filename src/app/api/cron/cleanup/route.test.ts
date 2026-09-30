// Tests for /api/cron/cleanup route
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mock dependencies BEFORE importing the route ──────────────────────
vi.mock("@/lib/features/files/fileService.server", () => ({
  cleanupExpiredFiles: vi.fn(),
}));

vi.mock("@/lib/features/projects/knowledge.server", () => ({
  cleanupStuckProcessingDocuments: vi.fn().mockResolvedValue(0),
}));

const { mockRouteLogger } = vi.hoisted(() => ({
  mockRouteLogger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/utils/logger", () => ({
  logger: {
    withContext: () => mockRouteLogger,
  },
}));

// ── Import route handlers AFTER mocks ─────────────────────────────────
import { GET, POST } from "./route";
import { cleanupExpiredFiles } from "@/lib/features/files/fileService.server";
import { cleanupStuckProcessingDocuments } from "@/lib/features/projects/knowledge.server";

// ── Helpers ───────────────────────────────────────────────────────────
const CRON_SECRET = "test-cron-secret-123";

function createRequest(method: string, url: string, headers?: Record<string, string>): NextRequest {
  const init = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
    },
  };
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

// ── Tests ─────────────────────────────────────────────────────────────
describe("/api/cron/cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;
    vi.mocked(cleanupStuckProcessingDocuments).mockResolvedValue(0);
  });

  // ────────────────────────────────────────────────────────────────────
  // GET - Auth / Secret Verification
  // ────────────────────────────────────────────────────────────────────
  describe("GET", () => {
    it("should return 401 when no secret header is provided", async () => {
      const req = createRequest("GET", "/api/cron/cleanup");
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe("Unauthorized");
    });

    it("should return 401 when wrong secret is provided", async () => {
      const req = createRequest("GET", "/api/cron/cleanup", {
        "x-cron-secret": "wrong-secret",
      });
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe("Unauthorized");
    });

    it("should return 401 when no CRON_SECRET env var is set", async () => {
      delete process.env.CRON_SECRET;
      delete process.env.ATTACHMENTS_CRON_SECRET;

      const req = createRequest("GET", "/api/cron/cleanup", {
        "x-cron-secret": CRON_SECRET,
      });
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe("Unauthorized");
    });

    it("should accept x-cron-secret header", async () => {
      vi.mocked(cleanupExpiredFiles).mockResolvedValue({
        deleted: 5,
        errors: 0,
      });

      const req = createRequest("GET", "/api/cron/cleanup", {
        "x-cron-secret": CRON_SECRET,
      });
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(cleanupExpiredFiles).toHaveBeenCalledTimes(1);
    });

    it("should accept authorization header with raw secret", async () => {
      vi.mocked(cleanupExpiredFiles).mockResolvedValue({
        deleted: 3,
        errors: 0,
      });

      const req = createRequest("GET", "/api/cron/cleanup", {
        authorization: CRON_SECRET,
      });
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(cleanupExpiredFiles).toHaveBeenCalledTimes(1);
    });

    it("should accept authorization header with Bearer prefix", async () => {
      vi.mocked(cleanupExpiredFiles).mockResolvedValue({
        deleted: 3,
        errors: 0,
      });

      const req = createRequest("GET", "/api/cron/cleanup", {
        authorization: `Bearer ${CRON_SECRET}`,
      });
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(cleanupExpiredFiles).toHaveBeenCalledTimes(1);
    });

    it("should accept ATTACHMENTS_CRON_SECRET as fallback", async () => {
      delete process.env.CRON_SECRET;
      process.env.ATTACHMENTS_CRON_SECRET = "fallback-secret";

      vi.mocked(cleanupExpiredFiles).mockResolvedValue({
        deleted: 1,
        errors: 0,
      });

      const req = createRequest("GET", "/api/cron/cleanup", {
        "x-cron-secret": "fallback-secret",
      });
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(cleanupExpiredFiles).toHaveBeenCalledTimes(1);
    });

    // ──────────────────────────────────────────────────────────────────
    // Cleanup Execution with Promise.allSettled
    // ──────────────────────────────────────────────────────────────────
    it("should return cleanup result on success and clean stuck documents", async () => {
      vi.mocked(cleanupExpiredFiles).mockResolvedValue({
        deleted: 10,
        errors: 2,
      });
      vi.mocked(cleanupStuckProcessingDocuments).mockResolvedValue(3);

      const req = createRequest("GET", "/api/cron/cleanup", {
        "x-cron-secret": CRON_SECRET,
      });
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.deleted).toBe(10);
      expect(json.errors).toBe(2);
      expect(json.stuckDocsCleaned).toBe(3);
      expect(cleanupExpiredFiles).toHaveBeenCalledTimes(1);
      expect(cleanupStuckProcessingDocuments).toHaveBeenCalledTimes(1);
    });

    it("should return cleanup result when nothing to clean", async () => {
      vi.mocked(cleanupExpiredFiles).mockResolvedValue({
        deleted: 0,
        errors: 0,
      });
      vi.mocked(cleanupStuckProcessingDocuments).mockResolvedValue(0);

      const req = createRequest("GET", "/api/cron/cleanup", {
        "x-cron-secret": CRON_SECRET,
      });
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.deleted).toBe(0);
      expect(json.errors).toBe(0);
      expect(json.stuckDocsCleaned).toBe(0);
    });

    // ──────────────────────────────────────────────────────────────────
    // Resilience & Error Handling with Promise.allSettled
    // ──────────────────────────────────────────────────────────────────
    it("should handle cleanupExpiredFiles rejection gracefully with errors: 1 and log error", async () => {
      vi.mocked(cleanupExpiredFiles).mockRejectedValue(new Error("Storage unreachable"));
      vi.mocked(cleanupStuckProcessingDocuments).mockResolvedValue(2);

      const req = createRequest("GET", "/api/cron/cleanup", {
        "x-cron-secret": CRON_SECRET,
      });
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.deleted).toBe(0);
      expect(json.errors).toBe(1);
      expect(json.stuckDocsCleaned).toBe(2);
      expect(mockRouteLogger.error).toHaveBeenCalledWith(
        "cleanupExpiredFiles failed",
        expect.any(Error)
      );
    });

    it("should handle cleanupStuckProcessingDocuments rejection gracefully and log error", async () => {
      vi.mocked(cleanupExpiredFiles).mockResolvedValue({ deleted: 4, errors: 0 });
      vi.mocked(cleanupStuckProcessingDocuments).mockRejectedValue(new Error("DB timeout"));

      const req = createRequest("GET", "/api/cron/cleanup", {
        "x-cron-secret": CRON_SECRET,
      });
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.deleted).toBe(4);
      expect(json.errors).toBe(0);
      expect(json.stuckDocsCleaned).toBe(0);
      expect(mockRouteLogger.error).toHaveBeenCalledWith(
        "cleanupStuckProcessingDocuments failed",
        expect.any(Error)
      );
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // POST - Alias for GET
  // ────────────────────────────────────────────────────────────────────
  describe("POST", () => {
    it("should be the same handler as GET", () => {
      expect(POST).toBe(GET);
    });

    it("should work with POST method and return 401 without secret", async () => {
      const req = createRequest("POST", "/api/cron/cleanup");
      const res = await POST(req);

      expect(res.status).toBe(401);
    });

    it("should work with POST method and valid secret", async () => {
      vi.mocked(cleanupExpiredFiles).mockResolvedValue({
        deleted: 1,
        errors: 0,
      });

      const req = createRequest("POST", "/api/cron/cleanup", {
        "x-cron-secret": CRON_SECRET,
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.deleted).toBe(1);
    });
  });
});
