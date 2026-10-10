import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateAndAuthorizeStoragePath } from "./storageValidation";
import { ValidationError, ForbiddenError } from "@/lib/utils/errors";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("storageValidation", () => {
  const mockSupabase = {
    from: vi.fn(),
  };

  const userId = "user-123";
  const conversationId = "conv-abc";
  const filename = "image.png";
  const validPath = `${userId}/${conversationId}/${filename}`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should pass for valid storage path belonging to user and conversation with DB match", async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [{ id: "msg-1" }],
              error: null,
            }),
          }),
        }),
      }),
    });

    await expect(
      validateAndAuthorizeStoragePath(
        mockSupabase as unknown as SupabaseClient,
        userId,
        conversationId,
        validPath
      )
    ).resolves.toBeUndefined();
  });

  it("should reject path exceeding 500 characters", async () => {
    const longPath = `${userId}/${conversationId}/${"a".repeat(500)}.png`;
    await expect(
      validateAndAuthorizeStoragePath(
        mockSupabase as unknown as SupabaseClient,
        userId,
        conversationId,
        longPath
      )
    ).rejects.toThrow(ValidationError);
  });

  it("should reject path with encoded traversal (%2e%2e or %)", async () => {
    const badPath = `${userId}/${conversationId}/%2e%2e/secret.png`;
    await expect(
      validateAndAuthorizeStoragePath(
        mockSupabase as unknown as SupabaseClient,
        userId,
        conversationId,
        badPath
      )
    ).rejects.toThrow(ValidationError);
  });

  it("should reject path with backslashes or special chars (? or #)", async () => {
    const backslashPath = `${userId}\\${conversationId}\\image.png`;
    await expect(
      validateAndAuthorizeStoragePath(
        mockSupabase as unknown as SupabaseClient,
        userId,
        conversationId,
        backslashPath
      )
    ).rejects.toThrow(ValidationError);

    const queryPath = `${userId}/${conversationId}/image.png?evil=1`;
    await expect(
      validateAndAuthorizeStoragePath(
        mockSupabase as unknown as SupabaseClient,
        userId,
        conversationId,
        queryPath
      )
    ).rejects.toThrow(ValidationError);
  });

  it("should reject path with directory traversal ..", async () => {
    const traversalPath = `${userId}/${conversationId}/../other/image.png`;
    await expect(
      validateAndAuthorizeStoragePath(
        mockSupabase as unknown as SupabaseClient,
        userId,
        conversationId,
        traversalPath
      )
    ).rejects.toThrow(ValidationError);
  });

  it("should reject path with wrong number of segments", async () => {
    const twoSegments = `${userId}/${filename}`;
    await expect(
      validateAndAuthorizeStoragePath(
        mockSupabase as unknown as SupabaseClient,
        userId,
        conversationId,
        twoSegments
      )
    ).rejects.toThrow(ValidationError);

    const fourSegments = `${userId}/${conversationId}/sub/${filename}`;
    await expect(
      validateAndAuthorizeStoragePath(
        mockSupabase as unknown as SupabaseClient,
        userId,
        conversationId,
        fourSegments
      )
    ).rejects.toThrow(ValidationError);
  });

  it("should throw ForbiddenError when userId does not match segment[0]", async () => {
    const otherUserPath = `other-user/${conversationId}/${filename}`;
    await expect(
      validateAndAuthorizeStoragePath(
        mockSupabase as unknown as SupabaseClient,
        userId,
        conversationId,
        otherUserPath
      )
    ).rejects.toThrow(ForbiddenError);
  });

  it("should throw ForbiddenError when conversationId does not match segment[1]", async () => {
    const otherConvPath = `${userId}/other-conv/${filename}`;
    await expect(
      validateAndAuthorizeStoragePath(
        mockSupabase as unknown as SupabaseClient,
        userId,
        conversationId,
        otherConvPath
      )
    ).rejects.toThrow(ForbiddenError);
  });

  it("should throw ForbiddenError when DB query finds no matching message", async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      }),
    });

    await expect(
      validateAndAuthorizeStoragePath(
        mockSupabase as unknown as SupabaseClient,
        userId,
        conversationId,
        validPath
      )
    ).rejects.toThrow(ForbiddenError);
  });
});
