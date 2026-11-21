// Tests for /api/edit-image-multi route
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mock dependencies BEFORE importing the route ──────────────────────
vi.mock("@/lib/features/auth/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/core/rateLimit", () => ({
  consumeRateLimit: vi.fn(),
}));

vi.mock("@/lib/core/limits", () => ({
  getUserProfile: vi.fn(),
}));

const mockSupabaseFrom = vi.fn();
const mockStorageUpload = vi.fn();
const mockStorageRemove = vi.fn();
const mockStorageDownload = vi.fn();
const mockStorageCreateSignedUrl = vi.fn();
const mockStorageGetPublicUrl = vi.fn();

vi.mock("@/lib/core/supabase.server", () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: mockSupabaseFrom,
    storage: {
      from: () => ({
        upload: mockStorageUpload,
        remove: mockStorageRemove,
        download: mockStorageDownload,
        createSignedUrl: mockStorageCreateSignedUrl,
        getPublicUrl: mockStorageGetPublicUrl,
      }),
    },
  })),
}));

const mockGenerateContent = vi.fn();
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = {
      generateContent: mockGenerateContent,
    };
  },
}));

vi.mock("@/lib/features/chat/messages", () => ({
  saveMessage: vi.fn(),
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
import { POST, maxDuration } from "./route";
import { auth } from "@/lib/features/auth/auth";
import { consumeRateLimit } from "@/lib/core/rateLimit";
import { getUserProfile } from "@/lib/core/limits";
import { saveMessage } from "@/lib/features/chat/messages";

// ── Helpers ───────────────────────────────────────────────────────────
const TEST_EMAIL = "test@example.com";
const TEST_USER_ID = "user-123";
const TEST_CONV_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const VALID_STORAGE_PATH = `${TEST_EMAIL}/${TEST_CONV_ID}/orig-image.png`;

function createRequest(body?: unknown): NextRequest {
  const init = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
  return new NextRequest(new URL("/api/edit-image-multi", "http://localhost:3000"), init);
}

function mockAuthenticated() {
  vi.mocked(auth).mockResolvedValue({
    user: { email: TEST_EMAIL, id: TEST_USER_ID },
  } as unknown as Awaited<ReturnType<typeof auth>>);
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

describe("/api/edit-image-multi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticated();
    mockRateLimitAllowed();
    vi.mocked(getUserProfile).mockResolvedValue({
      rank: "basic",
      is_blocked: false,
    } as unknown as Awaited<ReturnType<typeof getUserProfile>>);

    // Default Supabase mock handlers
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "conversations") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: TEST_CONV_ID, user_id: TEST_EMAIL },
            error: null,
          }),
        };
      }
      if (table === "messages") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [{ id: "msg-1" }],
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };
    });

    // Storage mock defaults
    mockStorageDownload.mockResolvedValue({
      data: new Blob([Buffer.from("fake-image-bytes")]),
      error: null,
    });
    mockStorageUpload.mockResolvedValue({ error: null });
    mockStorageRemove.mockResolvedValue({ error: null });
    mockStorageCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://storage.supabase.com/signed/edited.png" },
      error: null,
    });

    // Gemini mock default
    mockGenerateContent.mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [
              {
                inlineData: {
                  data: Buffer.from("edited-bytes").toString("base64"),
                  mimeType: "image/png",
                },
                thought_signature: "sig-gemini-123",
              },
            ],
          },
        },
      ],
    });

    vi.mocked(saveMessage).mockResolvedValue({
      id: "msg-edited-1",
      conversation_id: TEST_CONV_ID,
      role: "assistant",
      content: "Edited Image: add sunglasses",
      created_at: new Date().toISOString(),
    } as unknown as Awaited<ReturnType<typeof saveMessage>>);
  });

  // ── Auth & Rate Limit ────────────────────────────────────────────────
  it("should return 401 if unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as unknown as Awaited<ReturnType<typeof auth>>);
    const req = createRequest({ conversationId: TEST_CONV_ID, editHistory: [] });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("should return 429 when rate limited", async () => {
    vi.mocked(consumeRateLimit).mockResolvedValue({
      allowed: false,
      limit: 20,
      remaining: 0,
      resetInMs: 30000,
      retryAfterSeconds: 30,
      backend: "memory",
    });
    const req = createRequest({ conversationId: TEST_CONV_ID, editHistory: [] });
    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  // ── Gatekeeper ───────────────────────────────────────────────────────
  it("should return 503 if user profile is unavailable", async () => {
    vi.mocked(getUserProfile).mockResolvedValue(null);
    const req = createRequest({
      conversationId: TEST_CONV_ID,
      editHistory: [{ role: "user", text: "hello" }],
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(503);
    expect(json.error.code).toBe("SERVICE_UNAVAILABLE");
  });

  it("should return 403 if user is blocked", async () => {
    vi.mocked(getUserProfile).mockResolvedValue({
      rank: "basic",
      is_blocked: true,
    } as unknown as Awaited<ReturnType<typeof getUserProfile>>);
    const req = createRequest({
      conversationId: TEST_CONV_ID,
      editHistory: [{ role: "user", text: "hello" }],
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(403);
    expect(json.error.code).toBe("USER_BLOCKED");
  });

  it("should return 403 if user rank is not_whitelisted", async () => {
    vi.mocked(getUserProfile).mockResolvedValue({
      rank: "not_whitelisted",
      is_blocked: false,
    } as unknown as Awaited<ReturnType<typeof getUserProfile>>);
    const req = createRequest({
      conversationId: TEST_CONV_ID,
      editHistory: [{ role: "user", text: "hello" }],
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(403);
    expect(json.error.code).toBe("ACCESS_PENDING");
  });

  // ── Storage Path Validation & Traversal ───────────────────────────────
  it("should reject path traversal variants with %2e%2e, backslash or control characters", async () => {
    const maliciousPaths = [
      `${TEST_EMAIL}/${TEST_CONV_ID}/..%2fsecret.png`,
      `${TEST_EMAIL}/${TEST_CONV_ID}/%2e%2e/secret.png`,
      `${TEST_EMAIL}/${TEST_CONV_ID}/..\\secret.png`,
      `${TEST_EMAIL}/${TEST_CONV_ID}/\tsecret.png`,
      `${TEST_EMAIL}/${TEST_CONV_ID}/secret.png?token=123`,
    ];

    for (const badPath of maliciousPaths) {
      const req = createRequest({
        conversationId: TEST_CONV_ID,
        editHistory: [
          { role: "user", storagePath: badPath, text: "turn 0" },
          { role: "user", text: "make it sunset" },
        ],
      });
      const res = await POST(req);
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    }
  });

  it("should reject storagePath not belonging to user's conversation messages in DB (403)", async () => {
    // Mock DB message check returning empty array
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "conversations") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: TEST_CONV_ID, user_id: TEST_EMAIL },
            error: null,
          }),
        };
      }
      if (table === "messages") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [], // Not found in user's messages
            error: null,
          }),
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    });

    const req = createRequest({
      conversationId: TEST_CONV_ID,
      editHistory: [
        { role: "user", storagePath: VALID_STORAGE_PATH, text: "turn 0" },
        { role: "user", text: "make it sunset" },
      ],
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.message).toContain("Access denied");
  });

  it("should return 422 if storage file download fails and no base64 fallback", async () => {
    mockStorageDownload.mockResolvedValue({
      data: null,
      error: { message: "File not found in bucket" },
    });

    const req = createRequest({
      conversationId: TEST_CONV_ID,
      editHistory: [
        { role: "user", storagePath: VALID_STORAGE_PATH, text: "turn 0" },
        { role: "user", text: "make it sunset" },
      ],
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  // ── Success Flow & Lean Response ────────────────────────────────────
  it("should succeed with lean body without returning imageBase64 (API-04 / B-2, M-4, m-7)", async () => {
    const req = createRequest({
      conversationId: TEST_CONV_ID,
      editHistory: [
        { role: "user", storagePath: VALID_STORAGE_PATH, text: "Original" },
        { role: "user", text: "Add red sunglasses" },
      ],
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.imageUrl).toBe("https://storage.supabase.com/signed/edited.png");
    expect(json.data.storagePath).toContain(`${TEST_EMAIL}/${TEST_CONV_ID}/`);
    expect(json.data.thoughtSignature).toBe("sig-gemini-123");
    // CRITICAL: imageBase64 must NOT be returned in response!
    expect(json.data.imageBase64).toBeUndefined();

    // Verify storage.download was called with VALID_STORAGE_PATH
    expect(mockStorageDownload).toHaveBeenCalledWith(VALID_STORAGE_PATH);
  });

  // ── Sliding Window ──────────────────────────────────────────────────
  it("should apply sliding window on image turns when multi-turn > 3 image turns", async () => {
    const longHistory = [
      { role: "user", storagePath: VALID_STORAGE_PATH, text: "turn 0" },
      {
        role: "model",
        storagePath: `${TEST_EMAIL}/${TEST_CONV_ID}/img-1.png`,
        thoughtSignature: "sig1",
      },
      { role: "user", text: "edit 1" },
      {
        role: "model",
        storagePath: `${TEST_EMAIL}/${TEST_CONV_ID}/img-2.png`,
        thoughtSignature: "sig2",
      },
      { role: "user", text: "edit 2" },
      {
        role: "model",
        storagePath: `${TEST_EMAIL}/${TEST_CONV_ID}/img-3.png`,
        thoughtSignature: "sig3",
      },
      { role: "user", text: "edit 3" },
      {
        role: "model",
        storagePath: `${TEST_EMAIL}/${TEST_CONV_ID}/img-4.png`,
        thoughtSignature: "sig4",
      },
      { role: "user", text: "edit 4" },
    ];

    const req = createRequest({
      conversationId: TEST_CONV_ID,
      editHistory: longHistory,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    // Check generateContent call: should only include first user turn + last 6 turns (sliding window 3*2)
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    const callArgs = mockGenerateContent.mock.calls[0][0];
    // Original turn 0 + recent 6 turns = 7 turns total sent to Gemini
    expect(callArgs.contents.length).toBe(7);
    // Outgoing model image part must use camelCase thoughtSignature
    const modelTurn = callArgs.contents.find((c: { role: string }) => c.role === "model");
    expect(modelTurn.parts[0].thoughtSignature).toBeDefined();
    expect(modelTurn.parts[0].thought_signature).toBeUndefined();
  });

  it("TC-W1-05: rejects disallowed options.model with 400 VALIDATION_ERROR", async () => {
    const req = createRequest({
      conversationId: TEST_CONV_ID,
      editHistory: [{ role: "user", storagePath: VALID_STORAGE_PATH, text: "Edit" }],
      options: { model: "evil-model" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("TC-W1-05: returns 400 VALIDATION_ERROR when candidates is empty and promptFeedback.blockReason is SAFETY", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      candidates: [],
      promptFeedback: { blockReason: "SAFETY" },
    });

    const req = createRequest({
      conversationId: TEST_CONV_ID,
      editHistory: [
        { role: "user", storagePath: VALID_STORAGE_PATH, text: "Original" },
        { role: "user", text: "Blocked edit" },
      ],
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("TC-W1-05: reads camelCase thoughtSignature from Gemini response and cleans up storage on saveMessage failure", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      candidates: [
        {
          content: {
            parts: [
              {
                inlineData: {
                  data: Buffer.from("edited-bytes").toString("base64"),
                  mimeType: "image/png",
                },
                thoughtSignature: "camel-sig-999",
              },
            ],
          },
        },
      ],
    });

    const res = await POST(
      createRequest({
        conversationId: TEST_CONV_ID,
        editHistory: [
          { role: "user", storagePath: VALID_STORAGE_PATH, text: "Original" },
          { role: "user", text: "Make it night" },
        ],
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.thoughtSignature).toBe("camel-sig-999");

    // Orphan cleanup on saveMessage failure
    vi.mocked(saveMessage).mockRejectedValueOnce(new Error("DB write failed"));
    const failRes = await POST(
      createRequest({
        conversationId: TEST_CONV_ID,
        editHistory: [
          { role: "user", storagePath: VALID_STORAGE_PATH, text: "Original" },
          { role: "user", text: "Make it night" },
        ],
      })
    );
    expect(failRes.status).toBe(500);
    expect(mockStorageRemove).toHaveBeenCalledTimes(1);
  });

  it("TC-W2A-12: even-length sliding window never emits adjacent user turns and downloads storage images in parallel", async () => {
    let activeDownloads = 0;
    let maxConcurrentDownloads = 0;
    mockStorageDownload.mockImplementation(async () => {
      activeDownloads += 1;
      maxConcurrentDownloads = Math.max(maxConcurrentDownloads, activeDownloads);
      await new Promise((r) => setTimeout(r, 15));
      activeDownloads -= 1;
      return { data: new Blob([Buffer.from("img-bytes")]), error: null };
    });

    // 8 turns (even): u0, m1, u2, m3, u4, m5, u6, m7 (4 model turns > 3)
    const evenHistory = [
      { role: "user", storagePath: VALID_STORAGE_PATH, text: "u0" },
      {
        role: "model",
        storagePath: `${TEST_EMAIL}/${TEST_CONV_ID}/m1.png`,
        thoughtSignature: "s1",
      },
      { role: "user", text: "u2" },
      {
        role: "model",
        storagePath: `${TEST_EMAIL}/${TEST_CONV_ID}/m3.png`,
        thoughtSignature: "s2",
      },
      { role: "user", text: "u4" },
      {
        role: "model",
        storagePath: `${TEST_EMAIL}/${TEST_CONV_ID}/m5.png`,
        thoughtSignature: "s3",
      },
      { role: "user", text: "u6" },
      {
        role: "model",
        storagePath: `${TEST_EMAIL}/${TEST_CONV_ID}/m7.png`,
        thoughtSignature: "s4",
      },
    ];

    const res = await POST(
      createRequest({ conversationId: TEST_CONV_ID, editHistory: evenHistory })
    );
    expect(res.status).toBe(200);

    const contents = mockGenerateContent.mock.calls[0][0].contents as Array<{ role: string }>;
    // Expected: [u0, m3, u4, m5, u6, m7] (6 alternating turns)
    expect(contents.map((c) => c.role)).toEqual([
      "user",
      "model",
      "user",
      "model",
      "user",
      "model",
    ]);
    expect(maxConcurrentDownloads).toBeGreaterThanOrEqual(2);
  });

  it("TC-W2A-12 & NP-02: rejects SVG/non-raster MIME via data URI (case-insensitive) or imageMimeType, and oversized base64", async () => {
    const svgDataRes = await POST(
      createRequest({
        conversationId: TEST_CONV_ID,
        editHistory: [
          {
            role: "user",
            imageBase64: "DATA:IMAGE/SVG+XML;base64,PHN2Zy8+",
            text: "edit",
          },
        ],
      })
    );
    expect(svgDataRes.status).toBe(400);

    const svgMimeRes = await POST(
      createRequest({
        conversationId: TEST_CONV_ID,
        editHistory: [
          {
            role: "user",
            imageBase64: "aGVsbG8=",
            imageMimeType: " Image/SVG+XML ",
            text: "edit",
          },
        ],
      })
    );
    expect(svgMimeRes.status).toBe(400);

    const hugeBase64 = "A".repeat(14_000_001);
    const hugeRes = await POST(
      createRequest({
        conversationId: TEST_CONV_ID,
        editHistory: [{ role: "user", imageBase64: hugeBase64, text: "edit" }],
      })
    );
    expect(hugeRes.status).toBe(400);
  });

  it("TC-IMG-09: exports maxDuration = 300 for Vercel Fluid Compute", () => {
    expect(maxDuration).toBe(300);
  });
});
