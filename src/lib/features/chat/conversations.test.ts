// Test file for conversations.ts
import { describe, it, expect } from "vitest";
import { mapConversationRow, DEFAULT_MODEL } from "./conversations";

describe("Conversations", () => {
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
          icon: "⭐",
          color: "#FF0000",
        },
      };

      const result = mapConversationRow(row);

      expect(result).not.toBeNull();
      expect(result?.gem).toEqual({
        name: "Test Gem",
        icon: "⭐",
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
  });
});
