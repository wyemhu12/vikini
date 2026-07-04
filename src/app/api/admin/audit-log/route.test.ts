// /app/api/admin/audit-log/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks - declared BEFORE importing the route handlers
// ---------------------------------------------------------------------------

vi.mock("@/lib/features/auth/auth", () => ({
  auth: vi.fn(),
}));

const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/core/supabase.server", () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: mockFrom,
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

function setupSupabaseChain(result: { data: unknown; error: unknown }) {
  mockLimit.mockResolvedValue(result);
  mockOrder.mockReturnValue({ limit: mockLimit });
  mockSelect.mockReturnValue({ order: mockOrder });
  mockFrom.mockReturnValue({ select: mockSelect });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("/api/admin/audit-log", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("should return 401 if not authenticated", async () => {
      mockUnauthenticated();

      createRequest("GET", "/api/admin/audit-log");
      const res = await GET();

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return 403 if user is not admin", async () => {
      mockNonAdmin();

      createRequest("GET", "/api/admin/audit-log");
      const res = await GET();

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should return audit logs on success", async () => {
      mockAdmin();
      const mockLogs = [
        { id: "1", action: "BLOCK_USER", created_at: "2026-01-01" },
        { id: "2", action: "UPDATE_USER_RANK", created_at: "2026-01-02" },
      ];
      setupSupabaseChain({ data: mockLogs, error: null });

      const res = await GET();

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.logs).toEqual(mockLogs);
      expect(json.data.tableExists).toBe(true);
    });

    it("should return empty logs when table does not exist", async () => {
      mockAdmin();
      setupSupabaseChain({
        data: null,
        error: { message: 'relation "admin_audit_logs" does not exist', code: "42P01" },
      });

      const res = await GET();

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.logs).toEqual([]);
      expect(json.data.tableExists).toBe(false);
    });

    it("should return 500 on unexpected database error", async () => {
      mockAdmin();
      setupSupabaseChain({
        data: null,
        error: { message: "Connection refused", code: "ECONNREFUSED" },
      });

      const res = await GET();

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });
});
