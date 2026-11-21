// /app/api/admin/users/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks - declared BEFORE importing the route handlers
// ---------------------------------------------------------------------------

vi.mock("@/lib/features/auth/requireApprovedUser", () => ({
  requireAdminUser: vi.fn(),
}));

const mockOrder = vi.fn();
const mockRange = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockFrom = vi.fn();
const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/lib/core/supabase.server", () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: (...args: unknown[]) => {
      mockFrom(...args);
      return {
        select: (...sArgs: unknown[]) => {
          mockSelect(...sArgs);
          return {
            order: (...oArgs: unknown[]) => {
              mockOrder(...oArgs);
              return {
                range: (...rArgs: unknown[]) => {
                  mockRange(...rArgs);
                  return mockRange.mock.results[mockRange.mock.results.length - 1]?.value;
                },
              };
            },
            eq: (...eArgs: unknown[]) => {
              mockEq(...eArgs);
              return {
                single: () => mockSingle(),
                maybeSingle: () => mockSingle(),
              };
            },
          };
        },
        update: (...uArgs: unknown[]) => {
          mockUpdate(...uArgs);
          return {
            eq: (...eArgs: unknown[]) => {
              mockEq(...eArgs);
              return mockUpdateEq(...eArgs);
            },
          };
        },
      };
    },
  })),
}));

vi.mock("@/lib/features/admin/auditLog", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/features/auth/authRevocation", () => ({
  bumpAuthVersion: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/utils/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      audit: vi.fn(),
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

import { GET, PATCH } from "./route";
import { requireAdminUser } from "@/lib/features/auth/requireApprovedUser";
import {
  ForbiddenError,
  ServiceUnavailableError,
  UnauthorizedError,
  UserBlockedError,
} from "@/lib/utils/errors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_UUID = "target@example.com";

function createRequest(method: string, url: string, body?: unknown): NextRequest {
  const init = {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

function mockAdmin() {
  vi.mocked(requireAdminUser).mockResolvedValue({
    userId: "admin@test.com",
    rank: "admin",
  });
}

function mockNonAdmin() {
  vi.mocked(requireAdminUser).mockRejectedValue(new ForbiddenError("Admin access required"));
}

function mockUnauthenticated() {
  vi.mocked(requireAdminUser).mockRejectedValue(new UnauthorizedError());
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("/api/admin/users", () => {
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

    it("should return 403 if user is not admin", async () => {
      mockNonAdmin();
      const res = await GET();
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 503 when admin DB verification fails", async () => {
      vi.mocked(requireAdminUser).mockRejectedValueOnce(new ServiceUnavailableError());
      const res = await GET();
      expect(res.status).toBe(503);
    });

    it("should return users list with explicit columns and default limit=1000 pagination (TC-W2A-02)", async () => {
      mockAdmin();
      const mockUsers = [
        { id: "user-1", email: "a@test.com", rank: "basic", is_blocked: false },
        { id: "user-2", email: "b@test.com", rank: "pro", is_blocked: false },
      ];
      mockRange.mockReturnValueOnce({ data: mockUsers, count: 2, error: null });

      const res = await GET();

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.users).toEqual(mockUsers);
      expect(json.data.pagination).toEqual({
        total: 2,
        limit: 1000,
        offset: 0,
        hasMore: false,
      });
      expect(mockSelect).toHaveBeenCalledWith("id, email, rank, is_blocked, created_at", {
        count: "exact",
      });
      expect(mockRange).toHaveBeenCalledWith(0, 999);
    });

    it("should apply limit, offset, clamp limit > 1000, and reject invalid pagination params (TC-W2A-02)", async () => {
      mockAdmin();
      mockRange.mockReturnValueOnce({
        data: [{ id: "u-51", email: "u51@test.com", rank: "basic", is_blocked: false }],
        count: 250,
        error: null,
      });

      const res = await GET(createRequest("GET", "/api/admin/users?limit=50&offset=100"));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(mockRange).toHaveBeenCalledWith(100, 149);
      expect(json.data.pagination).toEqual({
        total: 250,
        limit: 50,
        offset: 100,
        hasMore: true,
      });

      mockRange.mockReturnValueOnce({ data: [], count: 0, error: null });
      const resClamp = await GET(createRequest("GET", "/api/admin/users?limit=9999&offset=0"));
      expect(resClamp.status).toBe(200);
      expect(mockRange).toHaveBeenLastCalledWith(0, 999);

      const resNeg = await GET(createRequest("GET", "/api/admin/users?limit=-1"));
      expect(resNeg.status).toBe(400);

      const resZero = await GET(createRequest("GET", "/api/admin/users?limit=0"));
      expect(resZero.status).toBe(400);

      const resFloat = await GET(createRequest("GET", "/api/admin/users?limit=10.5"));
      expect(resFloat.status).toBe(400);

      const resBadOffset = await GET(createRequest("GET", "/api/admin/users?offset=abc"));
      expect(resBadOffset.status).toBe(400);
    });

    it("should return 500 on database error", async () => {
      mockAdmin();
      mockRange.mockReturnValueOnce({
        data: null,
        count: null,
        error: { message: "DB error" },
      });

      const res = await GET();
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  // ======================== PATCH ========================
  describe("PATCH", () => {
    it("should return 401 if not authenticated", async () => {
      mockUnauthenticated();
      const req = createRequest("PATCH", "/api/admin/users", {
        userId: TEST_UUID,
        rank: "pro",
      });
      const res = await PATCH(req);
      expect(res.status).toBe(401);
    });

    it("should return 403 if user is not admin or blocked", async () => {
      mockNonAdmin();
      const req = createRequest("PATCH", "/api/admin/users", {
        userId: TEST_UUID,
        rank: "pro",
      });
      const res = await PATCH(req);
      expect(res.status).toBe(403);

      vi.mocked(requireAdminUser).mockRejectedValueOnce(new UserBlockedError());
      const resBlocked = await PATCH(
        createRequest("PATCH", "/api/admin/users", { userId: TEST_UUID, rank: "pro" })
      );
      expect(resBlocked.status).toBe(403);
    });

    it("should return 400 on malformed JSON body", async () => {
      mockAdmin();
      const req = new NextRequest(new URL("/api/admin/users", "http://localhost:3000"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "{invalid-json",
      });
      const res = await PATCH(req);
      expect(res.status).toBe(400);
    });

    it("should return 403 when admin attempts to modify their own account by id or email (TC-W1-04)", async () => {
      mockAdmin();
      mockSingle.mockResolvedValueOnce({
        data: { id: "admin@test.com", email: "admin@test.com" },
        error: null,
      });

      const req = createRequest("PATCH", "/api/admin/users", {
        userId: "admin@test.com",
        is_blocked: true,
      });
      const res = await PATCH(req);
      expect(res.status).toBe(403);
      expect(mockUpdate).not.toHaveBeenCalled();

      // Also test matching via email when id is a UUID
      mockSingle.mockResolvedValueOnce({
        data: { id: "12345678-1234-1234-1234-123456789abc", email: "ADMIN@TEST.COM" },
        error: null,
      });
      const resByUuid = await PATCH(
        createRequest("PATCH", "/api/admin/users", {
          userId: "12345678-1234-1234-1234-123456789abc",
          rank: "basic",
        })
      );
      expect(resByUuid.status).toBe(403);
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("should return 400 when userId is missing", async () => {
      mockAdmin();
      const req = createRequest("PATCH", "/api/admin/users", { rank: "pro" });
      const res = await PATCH(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 400 for invalid userId format", async () => {
      mockAdmin();
      const req = createRequest("PATCH", "/api/admin/users", {
        userId: "not-valid",
        rank: "pro",
      });
      const res = await PATCH(req);
      expect(res.status).toBe(400);
    });

    it("should return 400 for invalid rank value", async () => {
      mockAdmin();
      const req = createRequest("PATCH", "/api/admin/users", {
        userId: TEST_UUID,
        rank: "superadmin",
      });
      const res = await PATCH(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 400 when no valid fields to update", async () => {
      mockAdmin();
      const req = createRequest("PATCH", "/api/admin/users", {
        userId: TEST_UUID,
      });
      const res = await PATCH(req);
      expect(res.status).toBe(400);
    });

    it("should update user rank successfully", async () => {
      mockAdmin();
      // select().eq().maybeSingle() for target profile lookup
      mockSingle.mockResolvedValueOnce({
        data: { id: TEST_UUID, email: "target@test.com" },
        error: null,
      });
      // update().eq() for profiles
      mockEq.mockResolvedValueOnce({ error: null });

      const req = createRequest("PATCH", "/api/admin/users", {
        userId: TEST_UUID,
        rank: "pro",
      });
      const res = await PATCH(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it("should update user blocked status successfully", async () => {
      mockAdmin();
      mockSingle.mockResolvedValueOnce({
        data: { id: TEST_UUID, email: "target@test.com" },
        error: null,
      });
      mockEq.mockResolvedValueOnce({ error: null });

      const req = createRequest("PATCH", "/api/admin/users", {
        userId: TEST_UUID,
        is_blocked: true,
      });
      const res = await PATCH(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it("should return 404 when user is not found by id or email (ADM-01)", async () => {
      mockAdmin();
      mockSingle.mockResolvedValueOnce({ data: null, error: null }); // by id
      mockSingle.mockResolvedValueOnce({ data: null, error: null }); // by email

      const req = createRequest("PATCH", "/api/admin/users", {
        userId: "unknown@example.com",
        rank: "pro",
      });
      const res = await PATCH(req);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toContain("User not found");
    });

    it("should update user successfully when userId is a valid UUID", async () => {
      mockAdmin();
      const testUuid = "12345678-1234-1234-1234-123456789abc";
      mockSingle.mockResolvedValueOnce({
        data: { id: testUuid, email: "uuid-user@example.com" },
        error: null,
      });
      mockEq.mockResolvedValueOnce({ error: null });

      const req = createRequest("PATCH", "/api/admin/users", {
        userId: testUuid,
        rank: "pro",
      });
      const res = await PATCH(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it("should return 500 on database error during update", async () => {
      mockAdmin();
      mockSingle.mockResolvedValueOnce({
        data: { id: TEST_UUID, email: "target@test.com" },
        error: null,
      });
      mockUpdateEq.mockResolvedValueOnce({
        error: { message: "Update failed" },
      });

      const req = createRequest("PATCH", "/api/admin/users", {
        userId: TEST_UUID,
        rank: "basic",
      });
      const res = await PATCH(req);
      expect(res.status).toBe(500);
    });

    it("should return 500 DATABASE_ERROR when target profile lookup fails (TC-W2A-02)", async () => {
      mockAdmin();
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: "profiles lookup failed" },
      });

      const req = createRequest("PATCH", "/api/admin/users", {
        userId: TEST_UUID,
        rank: "pro",
      });
      const res = await PATCH(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error.code).toBe("DATABASE_ERROR");
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });
});
