// Tests for /api/edit-image route
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mock dependencies BEFORE importing the route ──────────────────────
vi.mock("@/lib/features/auth/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/core/rateLimit", () => ({
  consumeRateLimit: vi.fn(),
}));

const mockSupabaseFrom = vi.fn();
const mockStorageUpload = vi.fn();
const mockStorageRemove = vi.fn();
const mockStorageCreateSignedUrl = vi.fn();
const mockStorageGetPublicUrl = vi.fn();

vi.mock("@/lib/core/supabase.server", () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: mockSupabaseFrom,
    storage: {
      from: () => ({
        upload: mockStorageUpload,
        remove: mockStorageRemove,
        createSignedUrl: mockStorageCreateSignedUrl,
        getPublicUrl: mockStorageGetPublicUrl,
      }),
    },
  })),
}));

const mockEditGenerateContent = vi.fn();
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = {
      generateContent: mockEditGenerateContent,
    };
  },
}));

vi.mock("@/lib/features/chat/messages", () => ({
  saveMessage: vi.fn(),
}));

vi.mock("@/lib/core/limits", () => ({
  getUserProfile: vi.fn(),
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
import { POST } from "./route";
import { auth } from "@/lib/features/auth/auth";
import { consumeRateLimit } from "@/lib/core/rateLimit";
import { getUserProfile } from "@/lib/core/limits";
import { saveMessage } from "@/lib/features/chat/messages";

// ── Helpers ───────────────────────────────────────────────────────────
const TEST_EMAIL = "test@example.com";
const TEST_USER_ID = "user-123";
const TEST_CONV_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

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
    user: { email: TEST_EMAIL, id: TEST_USER_ID },
  } as unknown as Awaited<ReturnType<typeof auth>>);
}

function mockUnauthenticated() {
  vi.mocked(auth).mockResolvedValue(null as unknown as Awaited<ReturnType<typeof auth>>);
}

function mockRateLimitAllowed() {
  vi.mocked(consumeRateLimit).mockResolvedValue({
    allowed: true,
    limit: 20,
    remaining: 19,
    resetInMs: 60000,
    retryAfterSeconds: 60,
    backend: "memory",
  });
}

function mockRateLimitExceeded() {
  vi.mocked(consumeRateLimit).mockResolvedValue({
    allowed: false,
    limit: 20,
    remaining: 0,
    resetInMs: 30000,
    retryAfterSeconds: 30,
    backend: "memory",
  });
}

const validBody = {
  sourceImageUrl: "https://example.com/image.png",
  editPrompt: "Make the sky blue",
  conversationId: TEST_CONV_ID,
};

// ── Tests ─────────────────────────────────────────────────────────────
describe("/api/edit-image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserProfile).mockResolvedValue({
      rank: "basic",
      is_blocked: false,
    } as unknown as Awaited<ReturnType<typeof getUserProfile>>);
  });

  // ────────────────────────────────────────────────────────────────────
  // POST - Auth
  // ────────────────────────────────────────────────────────────────────
  describe("POST", () => {
    it("should return 401 if not authenticated", async () => {
      mockUnauthenticated();

      const req = createRequest("POST", "/api/edit-image", validBody);
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
    });

    it("should return 401 if session has no email", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: TEST_USER_ID },
      } as unknown as Awaited<ReturnType<typeof auth>>);

      const req = createRequest("POST", "/api/edit-image", validBody);
      const res = await POST(req);

      expect(res.status).toBe(401);
    });

    it("should return 401 if session has no id", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { email: TEST_EMAIL },
      } as unknown as Awaited<ReturnType<typeof auth>>);

      const req = createRequest("POST", "/api/edit-image", validBody);
      const res = await POST(req);

      expect(res.status).toBe(401);
    });

    // ──────────────────────────────────────────────────────────────────
    // Rate Limiting
    // ──────────────────────────────────────────────────────────────────
    it("should return 429 when rate limit is exceeded", async () => {
      mockAuthenticated();
      mockRateLimitExceeded();

      const req = createRequest("POST", "/api/edit-image", validBody);
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(429);
      expect(json.success).toBe(false);
    });

    // ──────────────────────────────────────────────────────────────────
    // Validation
    // ──────────────────────────────────────────────────────────────────
    it("should return 400 when sourceImageUrl is missing", async () => {
      mockAuthenticated();
      mockRateLimitAllowed();

      const req = createRequest("POST", "/api/edit-image", {
        editPrompt: "Make it blue",
        conversationId: TEST_CONV_ID,
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });

    it("should return 400 when sourceImageUrl is not a valid URL", async () => {
      mockAuthenticated();
      mockRateLimitAllowed();

      const req = createRequest("POST", "/api/edit-image", {
        sourceImageUrl: "not-a-url",
        editPrompt: "Make it blue",
        conversationId: TEST_CONV_ID,
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it("should return 400 when editPrompt is empty", async () => {
      mockAuthenticated();
      mockRateLimitAllowed();

      const req = createRequest("POST", "/api/edit-image", {
        sourceImageUrl: "https://example.com/image.png",
        editPrompt: "",
        conversationId: TEST_CONV_ID,
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it("should return 400 when editPrompt exceeds max length", async () => {
      mockAuthenticated();
      mockRateLimitAllowed();

      const req = createRequest("POST", "/api/edit-image", {
        sourceImageUrl: "https://example.com/image.png",
        editPrompt: "x".repeat(2001),
        conversationId: TEST_CONV_ID,
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it("should return 400 when conversationId is not a valid UUID", async () => {
      mockAuthenticated();
      mockRateLimitAllowed();

      const req = createRequest("POST", "/api/edit-image", {
        sourceImageUrl: "https://example.com/image.png",
        editPrompt: "Make it blue",
        conversationId: "not-a-uuid",
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it("should return 400 when conversationId is missing", async () => {
      mockAuthenticated();
      mockRateLimitAllowed();

      const req = createRequest("POST", "/api/edit-image", {
        sourceImageUrl: "https://example.com/image.png",
        editPrompt: "Make it blue",
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it("should return 400 for invalid aspectRatio option", async () => {
      mockAuthenticated();
      mockRateLimitAllowed();

      const req = createRequest("POST", "/api/edit-image", {
        ...validBody,
        options: { aspectRatio: "2:1" },
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    // ──────────────────────────────────────────────────────────────────
    // Conversation ownership
    // ──────────────────────────────────────────────────────────────────
    it("should return 404 when conversation is not found", async () => {
      mockAuthenticated();
      mockRateLimitAllowed();

      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "Not found" },
            }),
          }),
        }),
      });

      const req = createRequest("POST", "/api/edit-image", validBody);
      const res = await POST(req);

      expect(res.status).toBe(404);
    });

    it("should return 403 when user does not own the conversation", async () => {
      mockAuthenticated();
      mockRateLimitAllowed();

      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: TEST_CONV_ID, user_id: "other-user@example.com" },
              error: null,
            }),
          }),
        }),
      });

      const req = createRequest("POST", "/api/edit-image", validBody);
      const res = await POST(req);

      expect(res.status).toBe(403);
    });

    // ──────────────────────────────────────────────────────────────────
    // Error Handling
    // ──────────────────────────────────────────────────────────────────
    it("should return 500 on unexpected error", async () => {
      mockAuthenticated();
      mockRateLimitAllowed();

      // Make the Supabase from() throw an unexpected error
      mockSupabaseFrom.mockImplementation(() => {
        throw new Error("Unexpected DB error");
      });

      const req = createRequest("POST", "/api/edit-image", validBody);
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
    });

    it("should accept valid optional aspectRatio values", async () => {
      mockAuthenticated();
      mockRateLimitAllowed();

      // This will pass validation but fail at conversation check
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "Not found" },
            }),
          }),
        }),
      });

      const req = createRequest("POST", "/api/edit-image", {
        ...validBody,
        options: { aspectRatio: "16:9" },
      });
      const res = await POST(req);

      // Should pass validation (400) and reach conversation check (404)
      expect(res.status).toBe(404);
    });

    it("should reject sourceImageUrl pointing to private IP with 400 ValidationError (SSRF)", async () => {
      mockAuthenticated();
      mockRateLimitAllowed();

      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: TEST_CONV_ID, user_id: TEST_EMAIL },
              error: null,
            }),
          }),
        }),
      });

      const req = createRequest("POST", "/api/edit-image", {
        ...validBody,
        sourceImageUrl: "http://127.0.0.1/admin.png",
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.message).toContain(
        "Access to private or restricted network addresses is forbidden"
      );
    });

    it("TC-W1-05: rejects disallowed options.model with 400 VALIDATION_ERROR", async () => {
      mockAuthenticated();
      mockRateLimitAllowed();

      const req = createRequest("POST", "/api/edit-image", {
        ...validBody,
        options: { model: "gemini-4-argon" },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    it("TC-W1-05: cleans up uploaded orphan image if saveMessage throws", async () => {
      mockAuthenticated();
      mockRateLimitAllowed();
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: TEST_CONV_ID, user_id: TEST_EMAIL },
              error: null,
            }),
          }),
        }),
      });
      mockEditGenerateContent.mockResolvedValueOnce({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    data: Buffer.from("edited-img").toString("base64"),
                    mimeType: "image/png",
                  },
                },
              ],
            },
          },
        ],
      });
      mockStorageUpload.mockResolvedValueOnce({ error: null });
      mockStorageRemove.mockResolvedValueOnce({ error: null });
      mockStorageCreateSignedUrl.mockResolvedValueOnce({
        data: { signedUrl: "https://storage.supabase.com/signed/edit.png" },
        error: null,
      });
      vi.mocked(saveMessage).mockRejectedValueOnce(new Error("DB error"));

      const req = createRequest("POST", "/api/edit-image", {
        sourceImageUrl: "data:image/png;base64,aGVsbG8=",
        editPrompt: "Make sky blue",
        conversationId: TEST_CONV_ID,
      });
      const res = await POST(req);
      expect(res.status).toBe(500);
      expect(mockStorageRemove).toHaveBeenCalledTimes(1);
    });

    it("TC-W2A-12 & NP-02: rejects SVG/HTML/malformed/oversized data URIs with 400 VALIDATION_ERROR", async () => {
      mockAuthenticated();
      mockRateLimitAllowed();
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: TEST_CONV_ID, user_id: TEST_EMAIL },
              error: null,
            }),
          }),
        }),
      });

      const badDataUrls = [
        "DATA:IMAGE/SVG+XML;base64,PHN2Zy8+",
        "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
        "data:image/png,not-base64",
        `data:image/png;base64,${"A".repeat(14_000_001)}`,
      ];

      for (const badUrl of badDataUrls) {
        const res = await POST(
          createRequest("POST", "/api/edit-image", {
            sourceImageUrl: badUrl,
            editPrompt: "Edit this",
            conversationId: TEST_CONV_ID,
          })
        );
        expect(res.status).toBe(400);
      }
      expect(mockEditGenerateContent).not.toHaveBeenCalled();
    });
  });
});
