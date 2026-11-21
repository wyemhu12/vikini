import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/features/auth/requireApprovedUser", () => ({
  requireAdminUser: vi.fn(),
}));

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
  },
}));

import { GET, POST, PUT, DELETE } from "./route";
import { requireAdminUser } from "@/lib/features/auth/requireApprovedUser";
import { ForbiddenError, ServiceUnavailableError, UnauthorizedError } from "@/lib/utils/errors";

function createRequest(method: string, url: string, body?: unknown): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

describe("/api/admin/personas (TC-W1-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdminUser).mockResolvedValue({ userId: "admin@test.com", rank: "admin" });
  });

  describe("Auth & DB-backed RBAC", () => {
    it("returns 401 when unauthenticated", async () => {
      vi.mocked(requireAdminUser).mockRejectedValueOnce(new UnauthorizedError());
      const res = await GET();
      expect(res.status).toBe(401);
    });

    it("returns 403 when non-admin", async () => {
      vi.mocked(requireAdminUser).mockRejectedValueOnce(
        new ForbiddenError("Admin access required")
      );
      const res = await POST(createRequest("POST", "/api/admin/personas", { name: "P" }));
      expect(res.status).toBe(403);
    });

    it("returns 503 when DB profile verification fails", async () => {
      vi.mocked(requireAdminUser).mockRejectedValueOnce(new ServiceUnavailableError());
      const res = await DELETE(createRequest("DELETE", "/api/admin/personas?id=p-1"));
      expect(res.status).toBe(503);
    });
  });

  describe("GET / POST / PUT / DELETE", () => {
    it("GET returns premade personas", async () => {
      const personas = [{ id: "p-1", name: "Coach", is_premade: true }];
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: personas, error: null }),
          }),
        }),
      });

      const res = await GET();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.personas).toEqual(personas);
    });

    it("POST validates name and creates premade persona", async () => {
      const badRes = await POST(createRequest("POST", "/api/admin/personas", {}));
      expect(badRes.status).toBe(400);

      mockFrom.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "p-new", name: "Mentor", is_premade: true },
              error: null,
            }),
          }),
        }),
      });

      const okRes = await POST(createRequest("POST", "/api/admin/personas", { name: "Mentor" }));
      expect(okRes.status).toBe(200);
      const json = await okRes.json();
      expect(json.data.persona.id).toBe("p-new");
    });

    it("PUT validates id & name and updates premade persona", async () => {
      const badRes = await PUT(createRequest("PUT", "/api/admin/personas", { id: "p-1" }));
      expect(badRes.status).toBe(400);

      mockFrom.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: "p-1", name: "Updated", is_premade: true },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      const okRes = await PUT(
        createRequest("PUT", "/api/admin/personas", { id: "p-1", name: "Updated" })
      );
      expect(okRes.status).toBe(200);
    });

    it("DELETE validates id and removes premade persona", async () => {
      const badRes = await DELETE(createRequest("DELETE", "/api/admin/personas"));
      expect(badRes.status).toBe(400);

      mockFrom.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      });

      const okRes = await DELETE(createRequest("DELETE", "/api/admin/personas?id=p-1"));
      expect(okRes.status).toBe(200);
    });
  });
});
