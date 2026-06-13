// Tests for /api/gems route
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mock dependencies BEFORE importing the route ──────────────────────
vi.mock("@/lib/features/auth/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/features/gems/gems", () => ({
  getGemsForUser: vi.fn(),
  createGem: vi.fn(),
  updateGem: vi.fn(),
  deleteGem: vi.fn(),
}));

vi.mock("@/lib/utils/logger", () => ({
  logger: {
    withContext: () => ({
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    }),
  },
}));

// ── Import route handlers AFTER mocks ─────────────────────────────────
import { GET, POST, PATCH, DELETE } from "./route";
import { auth } from "@/lib/features/auth/auth";
import { getGemsForUser, createGem, updateGem, deleteGem } from "@/lib/features/gems/gems";

// ── Helpers ───────────────────────────────────────────────────────────
const TEST_EMAIL = "test@example.com";
const TEST_GEM_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

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
    user: { email: TEST_EMAIL, id: "user-123" },
  } as unknown as ReturnType<typeof auth> extends Promise<infer T> ? T : never);
}

function mockUnauthenticated() {
  vi.mocked(auth).mockResolvedValue(
    null as unknown as ReturnType<typeof auth> extends Promise<infer T> ? T : never
  );
}

const mockGemRow = {
  id: TEST_GEM_ID,
  slug: "test-gem",
  name: "Test Gem",
  description: "A test gem",
  icon: "✨",
  color: "#FF0000",
  is_premade: false,
  latestVersion: 1,
  instructions: "Do something helpful",
};

// ── Tests ─────────────────────────────────────────────────────────────
describe("/api/gems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ────────────────────────────────────────────────────────────────────
  // GET
  // ────────────────────────────────────────────────────────────────────
  describe("GET", () => {
    it("should return 401 if not authenticated", async () => {
      mockUnauthenticated();

      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
    });

    it("should return 401 if session has no email", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "123" },
      } as unknown as ReturnType<typeof auth> extends Promise<infer T> ? T : never);

      const res = await GET();

      expect(res.status).toBe(401);
    });

    it("should return gems on success", async () => {
      mockAuthenticated();
      vi.mocked(getGemsForUser).mockResolvedValue([mockGemRow]);

      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.gems).toHaveLength(1);
      expect(json.data.gems[0]).toEqual({
        id: TEST_GEM_ID,
        slug: "test-gem",
        name: "Test Gem",
        description: "A test gem",
        icon: "✨",
        color: "#FF0000",
        isPremade: false,
        latestVersion: 1,
        instructions: "Do something helpful",
      });
    });

    it("should lowercase the email when calling getGemsForUser", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { email: "Test@EXAMPLE.com", id: "user-123" },
      } as unknown as ReturnType<typeof auth> extends Promise<infer T> ? T : never);
      vi.mocked(getGemsForUser).mockResolvedValue([]);

      await GET();

      expect(getGemsForUser).toHaveBeenCalledWith("test@example.com");
    });

    it("should return empty array when user has no gems", async () => {
      mockAuthenticated();
      vi.mocked(getGemsForUser).mockResolvedValue([]);

      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.gems).toEqual([]);
    });

    it("should filter out null gems from mapping", async () => {
      mockAuthenticated();
      // getGemsForUser returns an array that includes an element that
      // mapGemForClient would turn to null (i.e. null itself)
      vi.mocked(getGemsForUser).mockResolvedValue([
        mockGemRow,
        null as unknown as typeof mockGemRow,
      ]);

      const res = await GET();
      const json = await res.json();

      expect(json.data.gems).toHaveLength(1);
    });

    it("should map isPremade correctly for is_premade=true", async () => {
      mockAuthenticated();
      vi.mocked(getGemsForUser).mockResolvedValue([{ ...mockGemRow, is_premade: true }]);

      const res = await GET();
      const json = await res.json();

      expect(json.data.gems[0].isPremade).toBe(true);
    });

    it("should fall back to instruction field when instructions is missing", async () => {
      mockAuthenticated();
      vi.mocked(getGemsForUser).mockResolvedValue([
        {
          ...mockGemRow,
          instructions: undefined,
          instruction: "Fallback instruction",
        },
      ]);

      const res = await GET();
      const json = await res.json();

      expect(json.data.gems[0].instructions).toBe("Fallback instruction");
    });

    it("should return 500 on unexpected error", async () => {
      mockAuthenticated();
      vi.mocked(getGemsForUser).mockRejectedValue(new Error("DB down"));

      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // POST
  // ────────────────────────────────────────────────────────────────────
  describe("POST", () => {
    const validBody = {
      name: "My New Gem",
      description: "Does things",
      instructions: "Be helpful",
      icon: "🚀",
      color: "#00FF00",
    };

    it("should return 401 if not authenticated", async () => {
      mockUnauthenticated();

      const req = createRequest("POST", "/api/gems", validBody);
      const res = await POST(req);

      expect(res.status).toBe(401);
    });

    it("should create a gem on success", async () => {
      mockAuthenticated();
      vi.mocked(createGem).mockResolvedValue({
        id: TEST_GEM_ID,
        name: "My New Gem",
        description: "Does things",
        instructions: "Be helpful",
        icon: "🚀",
        color: "#00FF00",
        is_premade: false,
        latestVersion: 1,
      });

      const req = createRequest("POST", "/api/gems", validBody);
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.gem.name).toBe("My New Gem");
      expect(createGem).toHaveBeenCalledWith(TEST_EMAIL, validBody);
    });

    it("should accept empty body (all fields optional)", async () => {
      mockAuthenticated();
      vi.mocked(createGem).mockResolvedValue({
        id: TEST_GEM_ID,
        name: "",
        description: "",
        instructions: "",
        icon: "",
        color: "",
        is_premade: false,
        latestVersion: 0,
      });

      const req = createRequest("POST", "/api/gems", {});
      const res = await POST(req);

      expect(res.status).toBe(200);
    });

    it("should return 400 for invalid field types", async () => {
      mockAuthenticated();

      // name must be a string, sending a number should fail Zod validation
      const req = createRequest("POST", "/api/gems", { name: 12345 });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });

    it("should return 400 when name exceeds max length", async () => {
      mockAuthenticated();

      const req = createRequest("POST", "/api/gems", {
        name: "x".repeat(201),
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
      expect((await res.json()).success).toBe(false);
    });

    it("should return 400 when description exceeds max length", async () => {
      mockAuthenticated();

      const req = createRequest("POST", "/api/gems", {
        description: "x".repeat(1001),
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it("should return 500 on unexpected error from createGem", async () => {
      mockAuthenticated();
      vi.mocked(createGem).mockRejectedValue(new Error("Insert failed"));

      const req = createRequest("POST", "/api/gems", validBody);
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
    });

    it("should handle invalid JSON body gracefully", async () => {
      mockAuthenticated();
      vi.mocked(createGem).mockResolvedValue({
        id: TEST_GEM_ID,
        name: "",
        latestVersion: 0,
        instructions: "",
      });

      // Create a request with malformed body - req.json() will throw,
      // route catches with .catch(() => ({})) so it becomes {}
      const req = new NextRequest(new URL("/api/gems", "http://localhost:3000"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json{{{",
      });
      const res = await POST(req);

      // Empty body {} passes createGemSchema (all fields optional)
      expect(res.status).toBe(200);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // PATCH
  // ────────────────────────────────────────────────────────────────────
  describe("PATCH", () => {
    const validBody = {
      id: TEST_GEM_ID,
      name: "Updated Gem",
      description: "Updated description",
    };

    it("should return 401 if not authenticated", async () => {
      mockUnauthenticated();

      const req = createRequest("PATCH", "/api/gems", validBody);
      const res = await PATCH(req);

      expect(res.status).toBe(401);
    });

    it("should update a gem on success", async () => {
      mockAuthenticated();
      vi.mocked(updateGem).mockResolvedValue({
        id: TEST_GEM_ID,
        name: "Updated Gem",
        description: "Updated description",
        instructions: "Be helpful",
        icon: "✨",
        color: "#FF0000",
        is_premade: false,
        latestVersion: 2,
      });

      const req = createRequest("PATCH", "/api/gems", validBody);
      const res = await PATCH(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.gem.name).toBe("Updated Gem");
      // updateGem is called with (userId, id, rest)
      expect(updateGem).toHaveBeenCalledWith(TEST_EMAIL, TEST_GEM_ID, {
        name: "Updated Gem",
        description: "Updated description",
      });
    });

    it("should return 400 when id is missing", async () => {
      mockAuthenticated();

      const req = createRequest("PATCH", "/api/gems", { name: "No ID" });
      const res = await PATCH(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });

    it("should return 400 when id is not a valid UUID", async () => {
      mockAuthenticated();

      const req = createRequest("PATCH", "/api/gems", {
        id: "not-a-uuid",
        name: "Test",
      });
      const res = await PATCH(req);

      expect(res.status).toBe(400);
    });

    it("should return 400 when name exceeds max length", async () => {
      mockAuthenticated();

      const req = createRequest("PATCH", "/api/gems", {
        id: TEST_GEM_ID,
        name: "x".repeat(201),
      });
      const res = await PATCH(req);

      expect(res.status).toBe(400);
    });

    it("should return 500 on unexpected error from updateGem", async () => {
      mockAuthenticated();
      vi.mocked(updateGem).mockRejectedValue(new Error("Update failed"));

      const req = createRequest("PATCH", "/api/gems", validBody);
      const res = await PATCH(req);

      expect(res.status).toBe(500);
    });

    it("should forward NotFoundError as proper status from updateGem", async () => {
      mockAuthenticated();
      const { NotFoundError } = await import("@/lib/utils/errors");
      vi.mocked(updateGem).mockRejectedValue(new NotFoundError("Gem"));

      const req = createRequest("PATCH", "/api/gems", validBody);
      const res = await PATCH(req);

      expect(res.status).toBe(404);
    });

    it("should forward ForbiddenError as 403 from updateGem", async () => {
      mockAuthenticated();
      const { ForbiddenError } = await import("@/lib/utils/errors");
      vi.mocked(updateGem).mockRejectedValue(new ForbiddenError("Premade gem is read-only"));

      const req = createRequest("PATCH", "/api/gems", validBody);
      const res = await PATCH(req);

      expect(res.status).toBe(403);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // DELETE
  // ────────────────────────────────────────────────────────────────────
  describe("DELETE", () => {
    const validBody = { id: TEST_GEM_ID };

    it("should return 401 if not authenticated", async () => {
      mockUnauthenticated();

      const req = createRequest("DELETE", "/api/gems", validBody);
      const res = await DELETE(req);

      expect(res.status).toBe(401);
    });

    it("should delete a gem on success", async () => {
      mockAuthenticated();
      vi.mocked(deleteGem).mockResolvedValue({ ok: true });

      const req = createRequest("DELETE", "/api/gems", validBody);
      const res = await DELETE(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.ok).toBe(true);
      expect(deleteGem).toHaveBeenCalledWith(TEST_EMAIL, TEST_GEM_ID);
    });

    it("should return 400 when id is missing", async () => {
      mockAuthenticated();

      const req = createRequest("DELETE", "/api/gems", {});
      const res = await DELETE(req);

      expect(res.status).toBe(400);
    });

    it("should return 400 when id is not a valid UUID", async () => {
      mockAuthenticated();

      const req = createRequest("DELETE", "/api/gems", {
        id: "not-a-valid-uuid",
      });
      const res = await DELETE(req);

      expect(res.status).toBe(400);
    });

    it("should forward ForbiddenError as 403 from deleteGem", async () => {
      mockAuthenticated();
      const { ForbiddenError } = await import("@/lib/utils/errors");
      vi.mocked(deleteGem).mockRejectedValue(new ForbiddenError("Premade gem is read-only"));

      const req = createRequest("DELETE", "/api/gems", validBody);
      const res = await DELETE(req);

      expect(res.status).toBe(403);
    });

    it("should return 500 on unexpected error from deleteGem", async () => {
      mockAuthenticated();
      vi.mocked(deleteGem).mockRejectedValue(new Error("DB crash"));

      const req = createRequest("DELETE", "/api/gems", validBody);
      const res = await DELETE(req);
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
    });
  });
});
