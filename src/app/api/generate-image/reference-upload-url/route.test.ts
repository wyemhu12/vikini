import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ForbiddenError, NotFoundError } from "@/lib/utils/errors";
import { MAX_STUDIO_REF_IMAGE_BYTES } from "@/lib/features/image-gen/referenceImageStorage";

const mockAuth = vi.fn();
vi.mock("@/lib/features/auth/auth", () => ({
  auth: () => mockAuth(),
}));

const mockConsumeRateLimit = vi.fn();
vi.mock("@/lib/core/rateLimit", () => ({
  consumeRateLimit: (...args: unknown[]) => mockConsumeRateLimit(...args),
}));

const mockGetUserProfile = vi.fn();
vi.mock("@/lib/core/limits", () => ({
  getUserProfile: (...args: unknown[]) => mockGetUserProfile(...args),
}));

const mockAssertConversationOwner = vi.fn();
vi.mock("@/lib/features/chat/conversations", () => ({
  assertConversationOwner: (...args: unknown[]) => mockAssertConversationOwner(...args),
}));

const mockCreateSignedUploadUrl = vi.fn();
vi.mock("@/lib/core/supabase.server", () => ({
  getSupabaseAdmin: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        createSignedUploadUrl: mockCreateSignedUploadUrl,
      })),
    },
  })),
}));

import { POST } from "./route";

const TEST_EMAIL = "studio.user@example.com";
const TEST_CONV_ID = "550e8400-e29b-41d4-a716-446655440000";

function makeReq(body: unknown): NextRequest {
  return new NextRequest(new URL("/api/generate-image/reference-upload-url", "http://localhost"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/generate-image/reference-upload-url (TC-REF-01..02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({
      user: { id: "google-123", email: TEST_EMAIL },
    });
    mockConsumeRateLimit.mockResolvedValue({ allowed: true });
    mockAssertConversationOwner.mockResolvedValue({ id: TEST_CONV_ID, user_id: TEST_EMAIL });
    mockGetUserProfile.mockResolvedValue({ id: TEST_EMAIL, rank: "pro", is_blocked: false });
  });

  it("TC-REF-01: returns 200 with batch signed upload URLs and consumes 1 rate limit slot", async () => {
    mockCreateSignedUploadUrl
      .mockResolvedValueOnce({
        data: { signedUrl: "https://proj.supabase.co/upload/1", token: "tok-1", path: "p1" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { signedUrl: "https://proj.supabase.co/upload/2", token: "tok-2", path: "p2" },
        error: null,
      });

    const res = await POST(
      makeReq({
        conversationId: TEST_CONV_ID,
        files: [
          {
            filename: "ảnh-40mb-việt-nam.png",
            mimeType: "image/png",
            sizeBytes: MAX_STUDIO_REF_IMAGE_BYTES,
          },
          {
            filename: "style-ref.webp",
            mimeType: "image/webp",
            sizeBytes: 10 * 1024 * 1024,
          },
        ],
      })
    );

    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.uploads).toHaveLength(2);
    expect(mockConsumeRateLimit).toHaveBeenCalledTimes(1);
    expect(mockConsumeRateLimit).toHaveBeenCalledWith(`image-gen-ref-upload:${TEST_EMAIL}`);
    expect(mockCreateSignedUploadUrl).toHaveBeenCalledTimes(2);

    const [first, second] = json.data.uploads as Array<{
      signedUrl: string;
      token: string;
      storagePath: string;
    }>;
    expect(first.signedUrl).toBe("https://proj.supabase.co/upload/1");
    expect(first.token).toBe("tok-1");
    expect(first.storagePath).toMatch(
      new RegExp(`^${TEST_EMAIL.replace(".", "\\.")}/${TEST_CONV_ID}/ref-[0-9a-f-]{36}\\.png$`)
    );
    expect(second.signedUrl).toBe("https://proj.supabase.co/upload/2");
    expect(second.token).toBe("tok-2");
    expect(second.storagePath).toMatch(
      new RegExp(`^${TEST_EMAIL.replace(".", "\\.")}/${TEST_CONV_ID}/ref-[0-9a-f-]{36}\\.webp$`)
    );
  });

  it("TC-REF-02: returns 401 when unauthenticated without calling storage", async () => {
    mockAuth.mockResolvedValueOnce(null);
    const res = await POST(
      makeReq({
        conversationId: TEST_CONV_ID,
        files: [{ filename: "a.png", mimeType: "image/png", sizeBytes: 100 }],
      })
    );
    expect(res.status).toBe(401);
    expect(mockCreateSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("TC-REF-02: returns 429 when rate limited without calling storage", async () => {
    mockConsumeRateLimit.mockResolvedValueOnce({ allowed: false });
    const res = await POST(
      makeReq({
        conversationId: TEST_CONV_ID,
        files: [{ filename: "a.png", mimeType: "image/png", sizeBytes: 100 }],
      })
    );
    expect(res.status).toBe(429);
    expect(mockCreateSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("TC-REF-02: returns 400 on invalid payloads (empty files, >4 files, size 0, >40MB, disallowed MIME)", async () => {
    const invalidPayloads = [
      {
        conversationId: "not-a-uuid",
        files: [{ filename: "a.png", mimeType: "image/png", sizeBytes: 100 }],
      },
      { conversationId: TEST_CONV_ID, files: [] },
      {
        conversationId: TEST_CONV_ID,
        files: Array.from({ length: 5 }, (_, i) => ({
          filename: `img-${i}.png`,
          mimeType: "image/png",
          sizeBytes: 1024,
        })),
      },
      {
        conversationId: TEST_CONV_ID,
        files: [{ filename: "a.png", mimeType: "image/png", sizeBytes: 0 }],
      },
      {
        conversationId: TEST_CONV_ID,
        files: [
          {
            filename: "huge.png",
            mimeType: "image/png",
            sizeBytes: MAX_STUDIO_REF_IMAGE_BYTES + 1,
          },
        ],
      },
      {
        conversationId: TEST_CONV_ID,
        files: [{ filename: "xss.svg", mimeType: "image/svg+xml", sizeBytes: 512 }],
      },
    ];

    for (const payload of invalidPayloads) {
      const res = await POST(makeReq(payload));
      expect(res.status).toBe(400);
    }
    expect(mockCreateSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("TC-REF-02: returns 403/404 when conversation ownership check fails", async () => {
    mockAssertConversationOwner.mockRejectedValueOnce(new ForbiddenError("Not owner"));
    const res403 = await POST(
      makeReq({
        conversationId: TEST_CONV_ID,
        files: [{ filename: "a.png", mimeType: "image/png", sizeBytes: 100 }],
      })
    );
    expect(res403.status).toBe(403);

    mockAssertConversationOwner.mockRejectedValueOnce(new NotFoundError("Conversation"));
    const res404 = await POST(
      makeReq({
        conversationId: TEST_CONV_ID,
        files: [{ filename: "a.png", mimeType: "image/png", sizeBytes: 100 }],
      })
    );
    expect(res404.status).toBe(404);
    expect(mockCreateSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("TC-REF-02: fails closed on null profile (503), blocked user (403), and not_whitelisted (403)", async () => {
    const validPayload = {
      conversationId: TEST_CONV_ID,
      files: [{ filename: "a.png", mimeType: "image/png", sizeBytes: 100 }],
    };

    mockGetUserProfile.mockResolvedValueOnce(null);
    expect((await POST(makeReq(validPayload))).status).toBe(503);

    mockGetUserProfile.mockResolvedValueOnce({ id: TEST_EMAIL, rank: "basic", is_blocked: true });
    expect((await POST(makeReq(validPayload))).status).toBe(403);

    mockGetUserProfile.mockResolvedValueOnce({
      id: TEST_EMAIL,
      rank: "not_whitelisted",
      is_blocked: false,
    });
    expect((await POST(makeReq(validPayload))).status).toBe(403);
    expect(mockCreateSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("returns 500 when Supabase createSignedUploadUrl fails", async () => {
    mockCreateSignedUploadUrl.mockResolvedValueOnce({
      data: null,
      error: { message: "Bucket error" },
    });

    const res = await POST(
      makeReq({
        conversationId: TEST_CONV_ID,
        files: [{ filename: "a.png", mimeType: "image/png", sizeBytes: 100 }],
      })
    );
    expect(res.status).toBe(500);
  });
});
