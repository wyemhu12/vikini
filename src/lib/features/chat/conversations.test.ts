// Test file for conversations.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mapConversationRow,
  DEFAULT_MODEL,
  assertConversationOwner,
  setConversationModel,
} from "./conversations";
import { NotFoundError, ForbiddenError } from "@/lib/utils/errors";

const mockSingle = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn();
const mockAssertModelAllowedForUser = vi.fn();

vi.mock("@/lib/core/supabase.server", () => ({
  getSupabaseAdmin: () => ({
    from: mockFrom,
  }),
}));

vi.mock("@/lib/core/limits", () => ({
  assertModelAllowedForUser: (...args: unknown[]) => mockAssertModelAllowedForUser(...args),
}));

vi.mock("@/lib/core/cache", () => ({
  getCachedConversations: vi.fn(),
  setCachedConversations: vi.fn(),
  invalidateConversationsCache: vi.fn().mockResolvedValue(undefined),
}));

describe("Conversations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate });
    mockSelect.mockReturnValue({ eq: mockEq, single: mockSingle, maybeSingle: mockSingle });
    mockEq.mockReturnValue({ single: mockSingle, maybeSingle: mockSingle, select: mockSelect });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockAssertModelAllowedForUser.mockResolvedValue(undefined);
  });

  describe("mapConversationRow", () => {
    it("should map snake_case row correctly", () => {
      const row = {
        id: "123",
        user_id: "user@example.com",
        title: "Test Conversation",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
        last_message_preview: "Hello world",
        gem_id: "gem-123",
        model: "gemini-pro",
      };

      const result = mapConversationRow(row);

      expect(result).not.toBeNull();
      expect(result?.id).toBe("123");
      expect(result?.userId).toBe("user@example.com");
      expect(result?.title).toBe("Test Conversation");
      expect(result?.createdAt).toBe("2024-01-01T00:00:00Z");
      expect(result?.updatedAt).toBe("2024-01-02T00:00:00Z");
      expect(result?.lastMessagePreview).toBe("Hello world");
      expect(result?.gemId).toBe("gem-123");
      // Model should be coerced to a valid model (gemini-pro -> gemini-2.5-flash via alias)
      expect(result?.model).toBe("gemini-2.5-flash");
    });

    it("should map camelCase row correctly", () => {
      const row = {
        id: "456",
        userId: "user2@example.com",
        title: "Another Test",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-02T00:00:00Z",
        lastMessagePreview: "Test message",
        gemId: null,
        model: "gemini-1.5-pro",
      };

      const result = mapConversationRow(row);

      expect(result).not.toBeNull();
      expect(result?.userId).toBe("user2@example.com");
      expect(result?.title).toBe("Another Test");
      expect(result?.gemId).toBeNull();
      // Model should be coerced to a valid model (gemini-1.5-pro -> gemini-2.5-flash via alias)
      expect(result?.model).toBe("gemini-2.5-flash");
    });

    it("should return null for null input", () => {
      expect(mapConversationRow(null)).toBeNull();
    });

    it("should use default title when title is missing", () => {
      const row = {
        id: "789",
        user_id: "user@example.com",
      };

      const result = mapConversationRow(row);

      expect(result).not.toBeNull();
      expect(result?.title).toBe("New Chat"); // CONVERSATION_DEFAULTS.TITLE
    });

    it("should use default model when model is missing", () => {
      const row = {
        id: "999",
        user_id: "user@example.com",
        title: "Test",
      };

      const result = mapConversationRow(row);

      expect(result).not.toBeNull();
      expect(result?.model).toBe(DEFAULT_MODEL);
    });

    it("should handle gem relationship correctly", () => {
      const row = {
        id: "111",
        user_id: "user@example.com",
        title: "Test",
        gems: {
          name: "Test Gem",
          icon: "",
          color: "#FF0000",
        },
      };

      const result = mapConversationRow(row);

      expect(result).not.toBeNull();
      expect(result?.gem).toEqual({
        name: "Test Gem",
        icon: "",
        color: "#FF0000",
      });
    });

    it("should handle missing gem relationship", () => {
      const row = {
        id: "222",
        user_id: "user@example.com",
        title: "Test",
      };

      const result = mapConversationRow(row);

      expect(result).not.toBeNull();
      expect(result?.gem).toBeNull();
    });

    it("should map parent_conversation_id and forked_from_message_id correctly", () => {
      const row = {
        id: "branch-1",
        user_id: "user@example.com",
        title: "[Nhánh] Test",
        parent_conversation_id: "parent-convo-123",
        forked_from_message_id: "msg-456",
      };

      const result = mapConversationRow(row);

      expect(result).not.toBeNull();
      expect(result?.parentConversationId).toBe("parent-convo-123");
      expect(result?.forkedFromMessageId).toBe("msg-456");
    });
  });

  describe("assertConversationOwner (SEC-01 / M-15, m-24, m-30)", () => {
    it("resolves successfully when conversation belongs to user", async () => {
      mockSingle.mockResolvedValue({
        data: { id: "conv-1", user_id: "user-123" },
        error: null,
      });

      await expect(assertConversationOwner("conv-1", "user-123")).resolves.toBeUndefined();
      expect(mockFrom).toHaveBeenCalledWith("conversations");
      expect(mockSelect).toHaveBeenCalledWith("id, user_id");
      expect(mockEq).toHaveBeenCalledWith("id", "conv-1");
    });

    it("throws NotFoundError when conversation does not exist", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: "Row not found" },
      });

      await expect(assertConversationOwner("non-existent", "user-123")).rejects.toThrow(
        NotFoundError
      );
    });

    it("throws ForbiddenError when conversation belongs to someone else (TC-MSG-01A)", async () => {
      mockSingle.mockResolvedValue({
        data: { id: "conv-1", user_id: "other-user" },
        error: null,
      });

      await expect(assertConversationOwner("conv-1", "user-123")).rejects.toThrow(ForbiddenError);
    });
  });

  describe("setConversationModel", () => {
    it("allows updating model to gemini-4-argon when assertModelAllowedForUser resolves", async () => {
      mockSingle
        .mockResolvedValueOnce({
          data: { id: "conv-1", user_id: "user-123", title: "Chat", model: "gemini-2.5-flash" },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: "conv-1", user_id: "user-123", title: "Chat", model: "gemini-4-argon" },
          error: null,
        });

      const updated = await setConversationModel("user-123", "conv-1", "gemini-4-argon");
      expect(mockAssertModelAllowedForUser).toHaveBeenCalledWith("user-123", "gemini-4-argon");
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ model: "gemini-4-argon" }));
      expect(updated?.model).toBe("gemini-4-argon");
    });

    it("throws ForbiddenError and does not update DB when assertModelAllowedForUser rejects", async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: "conv-1", user_id: "user-123", title: "Chat", model: "gemini-2.5-flash" },
        error: null,
      });
      mockAssertModelAllowedForUser.mockRejectedValueOnce(
        new ForbiddenError('Model "gemini-4-argon" is not allowed for rank "basic"')
      );

      await expect(setConversationModel("user-123", "conv-1", "gemini-4-argon")).rejects.toThrow(
        ForbiddenError
      );
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });
});
