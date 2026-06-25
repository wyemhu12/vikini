// Tests for /api/personas route
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mock dependencies BEFORE importing the route ──────────────────────
vi.mock("@/lib/features/auth/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/features/personas/personas", () => ({
  getPersonasForUser: vi.fn(),
  createPersona: vi.fn(),
  updatePersona: vi.fn(),
  deletePersona: vi.fn(),
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

vi.mock("@/lib/core/rateLimit", () => ({
  consumeRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  rateLimitHeaders: vi.fn().mockReturnValue({}),
}));

// ── Import route handlers AFTER mocks ─────────────────────────────────
import { GET, POST, PATCH, DELETE } from "./route";
import { auth } from "@/lib/features/auth/auth";
import {
  getPersonasForUser,
  createPersona,
  updatePersona,
  deletePersona,
} from "@/lib/features/personas/personas";

// ── Helpers ───────────────────────────────────────────────────────────
const TEST_EMAIL = "test@example.com";
const TEST_PERSONA_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

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

const mockPersonaRow = {
  id: TEST_PERSONA_ID,
  user_id: TEST_EMAIL,
  name: "Test Persona",
  description: "A test persona",
  tone: "friendly",
  use_emojis: true,
  use_headers_lists: true,
  user_context: "I am a developer",
  custom_instructions: "Be concise",
  icon: "🎭",
  color: "#FF0000",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

// ── Tests ─────────────────────────────────────────────────────────────
describe("/api/personas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ────────────────────────────────────────────────────────────────────
  // GET
  // ────────────────────────────────────────────────────────────────────
  describe("GET", () => {
    it("should return 401 if not authenticated", async () => {
      mockUnauthenticated();

      const res = await GET(createRequest("GET", "/api/personas"));
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
    });

    it("should return 401 if session has no email", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "123" },
      } as unknown as ReturnType<typeof auth> extends Promise<infer T> ? T : never);

      const res = await GET(createRequest("GET", "/api/personas"));

      expect(res.status).toBe(401);
    });

    it("should return personas on success", async () => {
      mockAuthenticated();
      vi.mocked(getPersonasForUser).mockResolvedValue([mockPersonaRow]);

      const res = await GET(createRequest("GET", "/api/personas"));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.personas).toHaveLength(1);
      expect(json.data.personas[0]).toEqual({
        id: TEST_PERSONA_ID,
        name: "Test Persona",
        description: "A test persona",
        tone: "friendly",
        useEmojis: true,
        useHeadersLists: true,
        userContext: "I am a developer",
        customInstructions: "Be concise",
        icon: "🎭",
        color: "#FF0000",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      });
    });

    it("should lowercase the email when calling getPersonasForUser", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { email: "Test@EXAMPLE.com", id: "user-123" },
      } as unknown as ReturnType<typeof auth> extends Promise<infer T> ? T : never);
      vi.mocked(getPersonasForUser).mockResolvedValue([]);

      await GET(createRequest("GET", "/api/personas"));

      expect(getPersonasForUser).toHaveBeenCalledWith("test@example.com");
    });

    it("should return empty array when user has no personas", async () => {
      mockAuthenticated();
      vi.mocked(getPersonasForUser).mockResolvedValue([]);

      const res = await GET(createRequest("GET", "/api/personas"));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.personas).toEqual([]);
    });

    it("should filter out null personas from mapping", async () => {
      mockAuthenticated();
      vi.mocked(getPersonasForUser).mockResolvedValue([
        mockPersonaRow,
        null as unknown as typeof mockPersonaRow,
      ]);

      const res = await GET(createRequest("GET", "/api/personas"));
      const json = await res.json();

      expect(json.data.personas).toHaveLength(1);
    });

    it("should return 500 on unexpected error", async () => {
      mockAuthenticated();
      vi.mocked(getPersonasForUser).mockRejectedValue(new Error("DB down"));

      const res = await GET(createRequest("GET", "/api/personas"));
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
      name: "My Persona",
      description: "A helpful persona",
      tone: "professional" as const,
      useEmojis: false,
      useHeadersLists: true,
      userContext: "I am a student",
      customInstructions: "Always use examples",
      icon: "🚀",
      color: "#00FF00",
    };

    it("should return 401 if not authenticated", async () => {
      mockUnauthenticated();

      const req = createRequest("POST", "/api/personas", validBody);
      const res = await POST(req);

      expect(res.status).toBe(401);
    });

    it("should create a persona on success", async () => {
      mockAuthenticated();
      vi.mocked(createPersona).mockResolvedValue({
        id: TEST_PERSONA_ID,
        user_id: TEST_EMAIL,
        name: "My Persona",
        description: "A helpful persona",
        tone: "professional",
        use_emojis: false,
        use_headers_lists: true,
        user_context: "I am a student",
        custom_instructions: "Always use examples",
        icon: "🚀",
        color: "#00FF00",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      });

      const req = createRequest("POST", "/api/personas", validBody);
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.persona.name).toBe("My Persona");
      expect(createPersona).toHaveBeenCalledWith(TEST_EMAIL, validBody);
    });

    it("should return 400 when name is missing", async () => {
      mockAuthenticated();

      const req = createRequest("POST", "/api/personas", {
        description: "No name provided",
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });

    it("should return 400 when name is empty string", async () => {
      mockAuthenticated();

      const req = createRequest("POST", "/api/personas", { name: "" });
      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it("should return 400 for invalid tone value", async () => {
      mockAuthenticated();

      const req = createRequest("POST", "/api/personas", {
        name: "Test",
        tone: "invalid-tone",
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });

    it("should return 400 when name exceeds max length", async () => {
      mockAuthenticated();

      const req = createRequest("POST", "/api/personas", {
        name: "x".repeat(101),
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
      expect((await res.json()).success).toBe(false);
    });

    it("should return 400 when description exceeds max length", async () => {
      mockAuthenticated();

      const req = createRequest("POST", "/api/personas", {
        name: "Valid Name",
        description: "x".repeat(1001),
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it("should return 400 for invalid field types", async () => {
      mockAuthenticated();

      const req = createRequest("POST", "/api/personas", { name: 12345 });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });

    it("should return 500 on unexpected error from createPersona", async () => {
      mockAuthenticated();
      vi.mocked(createPersona).mockRejectedValue(new Error("Insert failed"));

      const req = createRequest("POST", "/api/personas", validBody);
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
    });

    it("should handle invalid JSON body gracefully", async () => {
      mockAuthenticated();

      const req = new NextRequest(new URL("/api/personas", "http://localhost:3000"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json{{{",
      });
      const res = await POST(req);

      // Empty body {} fails createPersonaSchema (name is required)
      expect(res.status).toBe(400);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // PATCH
  // ────────────────────────────────────────────────────────────────────
  describe("PATCH", () => {
    const validBody = {
      id: TEST_PERSONA_ID,
      name: "Updated Persona",
      description: "Updated description",
      tone: "candid" as const,
    };

    it("should return 401 if not authenticated", async () => {
      mockUnauthenticated();

      const req = createRequest("PATCH", "/api/personas", validBody);
      const res = await PATCH(req);

      expect(res.status).toBe(401);
    });

    it("should update a persona on success", async () => {
      mockAuthenticated();
      vi.mocked(updatePersona).mockResolvedValue({
        id: TEST_PERSONA_ID,
        user_id: TEST_EMAIL,
        name: "Updated Persona",
        description: "Updated description",
        tone: "candid",
        use_emojis: true,
        use_headers_lists: true,
        user_context: "",
        custom_instructions: "",
        icon: "🎭",
        color: "#FF0000",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
      });

      const req = createRequest("PATCH", "/api/personas", validBody);
      const res = await PATCH(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.persona.name).toBe("Updated Persona");
      expect(json.data.persona.tone).toBe("candid");
      // updatePersona is called with (userId, id, rest)
      expect(updatePersona).toHaveBeenCalledWith(TEST_EMAIL, TEST_PERSONA_ID, {
        name: "Updated Persona",
        description: "Updated description",
        tone: "candid",
      });
    });

    it("should return 400 when id is missing", async () => {
      mockAuthenticated();

      const req = createRequest("PATCH", "/api/personas", { name: "No ID" });
      const res = await PATCH(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });

    it("should return 400 when id is not a valid UUID", async () => {
      mockAuthenticated();

      const req = createRequest("PATCH", "/api/personas", {
        id: "not-a-uuid",
        name: "Test",
      });
      const res = await PATCH(req);

      expect(res.status).toBe(400);
    });

    it("should return 400 for invalid tone value", async () => {
      mockAuthenticated();

      const req = createRequest("PATCH", "/api/personas", {
        id: TEST_PERSONA_ID,
        tone: "super-angry",
      });
      const res = await PATCH(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });

    it("should return 400 when name exceeds max length", async () => {
      mockAuthenticated();

      const req = createRequest("PATCH", "/api/personas", {
        id: TEST_PERSONA_ID,
        name: "x".repeat(101),
      });
      const res = await PATCH(req);

      expect(res.status).toBe(400);
    });

    it("should return 500 on unexpected error from updatePersona", async () => {
      mockAuthenticated();
      vi.mocked(updatePersona).mockRejectedValue(new Error("Update failed"));

      const req = createRequest("PATCH", "/api/personas", validBody);
      const res = await PATCH(req);

      expect(res.status).toBe(500);
    });

    it("should forward NotFoundError as 404 from updatePersona", async () => {
      mockAuthenticated();
      const { NotFoundError } = await import("@/lib/utils/errors");
      vi.mocked(updatePersona).mockRejectedValue(new NotFoundError("Persona"));

      const req = createRequest("PATCH", "/api/personas", validBody);
      const res = await PATCH(req);

      expect(res.status).toBe(404);
    });

    it("should forward ForbiddenError as 403 from updatePersona", async () => {
      mockAuthenticated();
      const { ForbiddenError } = await import("@/lib/utils/errors");
      vi.mocked(updatePersona).mockRejectedValue(new ForbiddenError("Not your persona"));

      const req = createRequest("PATCH", "/api/personas", validBody);
      const res = await PATCH(req);

      expect(res.status).toBe(403);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // DELETE
  // ────────────────────────────────────────────────────────────────────
  describe("DELETE", () => {
    const validBody = { id: TEST_PERSONA_ID };

    it("should return 401 if not authenticated", async () => {
      mockUnauthenticated();

      const req = createRequest("DELETE", "/api/personas", validBody);
      const res = await DELETE(req);

      expect(res.status).toBe(401);
    });

    it("should delete a persona on success", async () => {
      mockAuthenticated();
      vi.mocked(deletePersona).mockResolvedValue(undefined);

      const req = createRequest("DELETE", "/api/personas", validBody);
      const res = await DELETE(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.ok).toBe(true);
      expect(deletePersona).toHaveBeenCalledWith(TEST_EMAIL, TEST_PERSONA_ID);
    });

    it("should return 400 when id is missing", async () => {
      mockAuthenticated();

      const req = createRequest("DELETE", "/api/personas", {});
      const res = await DELETE(req);

      expect(res.status).toBe(400);
    });

    it("should return 400 when id is not a valid UUID", async () => {
      mockAuthenticated();

      const req = createRequest("DELETE", "/api/personas", {
        id: "not-a-valid-uuid",
      });
      const res = await DELETE(req);

      expect(res.status).toBe(400);
    });

    it("should forward ForbiddenError as 403 from deletePersona", async () => {
      mockAuthenticated();
      const { ForbiddenError } = await import("@/lib/utils/errors");
      vi.mocked(deletePersona).mockRejectedValue(new ForbiddenError("Not your persona"));

      const req = createRequest("DELETE", "/api/personas", validBody);
      const res = await DELETE(req);

      expect(res.status).toBe(403);
    });

    it("should return 500 on unexpected error from deletePersona", async () => {
      mockAuthenticated();
      vi.mocked(deletePersona).mockRejectedValue(new Error("DB crash"));

      const req = createRequest("DELETE", "/api/personas", validBody);
      const res = await DELETE(req);
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
    });
  });
});
