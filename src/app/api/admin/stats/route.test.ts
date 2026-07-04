// /app/api/admin/stats/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks - declared BEFORE importing the route handlers
// ---------------------------------------------------------------------------

vi.mock("@/lib/features/auth/auth", () => ({
  auth: vi.fn(),
}));

// Build a flexible mock for the chained Supabase calls in stats route
const _mockSupabase = {
  fromResults: new Map<string, unknown>(),
};

function createChainable(resolvedValue: unknown) {
  const chainable: Record<string, unknown> = {};
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === "then") {
        // Make it thenable so await works
        const promise = Promise.resolve(resolvedValue);
        return promise.then.bind(promise);
      }
      // Every method returns the same proxy for chaining
      return (..._args: unknown[]) => new Proxy({}, handler);
    },
  };
  return new Proxy(chainable, handler);
}

let fromCallIndex = 0;
const fromResults: unknown[] = [];

vi.mock("@/lib/core/supabase.server", () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: (..._args: unknown[]) => {
      const result = fromResults[fromCallIndex] ?? { data: null, count: 0 };
      fromCallIndex++;
      return createChainable(result);
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
import { auth } from "@/lib/features/auth/auth";

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
  vi.mocked(auth).mockResolvedValue({
    user: { email: "admin@test.com", id: "admin-id", rank: "admin" },
  } as unknown as Awaited<ReturnType<typeof auth>>);
}

function mockNonAdmin() {
  vi.mocked(auth).mockResolvedValue({
    user: { email: "user@test.com", id: "user-id", rank: "basic" },
  } as unknown as Awaited<ReturnType<typeof auth>>);
}

function mockUnauthenticated() {
  vi.mocked(auth).mockResolvedValue(null as unknown as Awaited<ReturnType<typeof auth>>);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("/api/admin/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromCallIndex = 0;
    fromResults.length = 0;
  });

  describe("GET", () => {
    it("should return 403 if not authenticated", async () => {
      mockUnauthenticated();
      const req = createRequest("GET", "/api/admin/stats");
      const res = await GET(req);
      expect(res.status).toBe(403);
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

    it("should return global stats on success", async () => {
      mockAdmin();

      // profiles query
      fromResults.push({
        data: [
          { rank: "admin", is_blocked: false },
          { rank: "pro", is_blocked: false },
          { rank: "basic", is_blocked: true },
          { rank: "not_whitelisted", is_blocked: false },
        ],
      });
      // conversations count (total)
      fromResults.push({ count: 42 });
      // conversations count (today)
      fromResults.push({ count: 5 });
      // messages count (today)
      fromResults.push({ count: 123 });

      const req = createRequest("GET", "/api/admin/stats");
      const res = await GET(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.users).toBeDefined();
      expect(json.data.users.total).toBe(4);
      expect(json.data.users.active).toBe(3);
      expect(json.data.users.blocked).toBe(1);
      expect(json.data.conversations).toBeDefined();
      expect(json.data.messages).toBeDefined();
    });

    it("should return user-specific stats when userId is provided", async () => {
      mockAdmin();

      // conversations count for user
      fromResults.push({ count: 10 });
      // conversations ids for user
      fromResults.push({ data: [{ id: "conv-1" }, { id: "conv-2" }] });
      // messages count
      fromResults.push({ count: 50 });

      const req = createRequest("GET", "/api/admin/stats?userId=user-123");
      const res = await GET(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.conversations).toBe(10);
      expect(json.data.messages).toBe(50);
    });

    it("should return 500 on unexpected error", async () => {
      mockAdmin();
      // Force an error by making auth pass but supabase throw
      vi.mocked(auth).mockRejectedValue(
        (() => {
          // Reset to admin first, then set up the actual test
          return undefined;
        })()
      );
      // Re-mock as admin but make the from() call throw
      mockAdmin();

      // We'll make the proxy throw by providing a result that causes an error
      // in the route's processing logic. Use a throwing getter.
      fromResults.push({
        get data() {
          throw new Error("Connection failed");
        },
      });

      const req = createRequest("GET", "/api/admin/stats");
      const res = await GET(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });
});
