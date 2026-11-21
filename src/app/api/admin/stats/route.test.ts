// /app/api/admin/stats/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks - declared BEFORE importing the route handlers
// ---------------------------------------------------------------------------

vi.mock("@/lib/features/auth/requireApprovedUser", () => ({
  requireAdminUser: vi.fn(),
}));

// Build a flexible mock for the chained Supabase calls in stats route
const _mockSupabase = {
  fromResults: new Map<string, unknown>(),
};

const capturedCalls: Array<{ table: string; method: string; args: unknown[] }> = [];

function createChainable(table: string, resolvedValue: unknown) {
  const chainable: Record<string, unknown> = {};
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === "then") {
        // Make it thenable so await works
        const promise = Promise.resolve(resolvedValue);
        return promise.then.bind(promise);
      }
      // Every method returns the same proxy for chaining
      return (...args: unknown[]) => {
        capturedCalls.push({ table, method: String(prop), args });
        return new Proxy({}, handler);
      };
    },
  };
  return new Proxy(chainable, handler);
}

let fromCallIndex = 0;
const fromResults: unknown[] = [];

vi.mock("@/lib/core/supabase.server", () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: (table: string) => {
      const result = fromResults[fromCallIndex] ?? { data: null, count: 0, error: null };
      fromCallIndex++;
      return createChainable(table, result);
    },
  })),
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

import { GET } from "./route";
import { requireAdminUser } from "@/lib/features/auth/requireApprovedUser";
import { ForbiddenError, ServiceUnavailableError, UnauthorizedError } from "@/lib/utils/errors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(method: string, url: string): NextRequest {
  const init = {
    method,
    headers: { "Content-Type": "application/json" },
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

describe("/api/admin/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromCallIndex = 0;
    fromResults.length = 0;
    capturedCalls.length = 0;
  });

  describe("GET", () => {
    it("should return 401 if not authenticated", async () => {
      mockUnauthenticated();
      const req = createRequest("GET", "/api/admin/stats");
      const res = await GET(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 403 if user is not admin", async () => {
      mockNonAdmin();
      const req = createRequest("GET", "/api/admin/stats");
      const res = await GET(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 503 if DB verification fails", async () => {
      vi.mocked(requireAdminUser).mockRejectedValueOnce(new ServiceUnavailableError());
      const req = createRequest("GET", "/api/admin/stats");
      const res = await GET(req);
      expect(res.status).toBe(503);
    });

    it("should return global stats (>1,000 users) using head-only exact counts and UTC day boundary (TC-W2A-01)", async () => {
      mockAdmin();

      // 9 parallel head-only count queries:
      // total, blocked, admin, pro, basic, not_whitelisted, totalConvs, todayConvs, todayMsgs
      fromResults.push(
        { count: 2500, error: null },
        { count: 120, error: null },
        { count: 5, error: null },
        { count: 400, error: null },
        { count: 1900, error: null },
        { count: 195, error: null },
        { count: 4200, error: null },
        { count: 55, error: null },
        { count: 1230, error: null }
      );

      const req = createRequest("GET", "/api/admin/stats");
      const res = await GET(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.users).toEqual({
        total: 2500,
        active: 2380,
        blocked: 120,
        byRank: {
          admin: 5,
          pro: 400,
          basic: 1900,
          not_whitelisted: 195,
        },
      });
      expect(json.data.conversations).toEqual({ total: 4200, today: 55 });
      expect(json.data.messages).toEqual({ today: 1230 });

      const selectCalls = capturedCalls.filter((c) => c.method === "select");
      expect(selectCalls).toHaveLength(9);
      for (const call of selectCalls) {
        expect(call.args[1]).toEqual({ count: "exact", head: true });
      }

      const gteCalls = capturedCalls.filter((c) => c.method === "gte");
      expect(gteCalls).toHaveLength(2);
      for (const call of gteCalls) {
        expect(call.args[0]).toBe("created_at");
        expect(String(call.args[1])).toMatch(/T00:00:00\.000Z$/);
      }
    });

    it("should return user-specific stats when userId is provided", async () => {
      mockAdmin();

      // conversations count for user
      fromResults.push({ count: 10, error: null });
      // messages count via inner join
      fromResults.push({ count: 50, error: null });

      const req = createRequest("GET", "/api/admin/stats?userId=USER@EXAMPLE.COM");
      const res = await GET(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.conversations).toBe(10);
      expect(json.data.messages).toBe(50);
    });

    it("should fail closed with 500 DATABASE_ERROR when any stats query returns an error (TC-W2A-01)", async () => {
      mockAdmin();

      fromResults.push(
        { count: 100, error: null },
        { count: null, error: { message: "Connection failed" } }
      );

      const req = createRequest("GET", "/api/admin/stats");
      const res = await GET(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("DATABASE_ERROR");
    });

    it("should fail closed with 500 DATABASE_ERROR when user-specific stats query fails", async () => {
      mockAdmin();
      fromResults.push({ count: 10, error: null });
      fromResults.push({ count: null, error: { message: "messages join failed" } });

      const req = createRequest("GET", "/api/admin/stats?userId=user@example.com");
      const res = await GET(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error.code).toBe("DATABASE_ERROR");
    });
  });
});
