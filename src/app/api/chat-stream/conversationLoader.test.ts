import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadOrCreateConversation } from "./conversationLoader";
import * as conversations from "@/lib/features/chat/conversations";
import type { Conversation } from "@/lib/features/chat/conversations";
import { NotFoundError } from "@/lib/utils/errors";

vi.mock("@/lib/features/chat/conversations", () => ({
  getConversation: vi.fn(),
  saveConversation: vi.fn(),
}));

function createMockConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: "conv-1",
    userId: "user@example.com",
    title: "Chat",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastMessagePreview: null,
    gemId: null,
    projectId: null,
    gem: null,
    persona: null,
    model: "gemini-3.8-flash",
    ...overrides,
  };
}

describe("conversationLoader - loadOrCreateConversation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws NotFoundError when requested conversation belongs to another user (SEC-01 / TC-SEC-01D)", async () => {
    const userId = "victim@example.com";
    const attackerId = "attacker@example.com";

    vi.mocked(conversations.getConversation).mockResolvedValueOnce(
      createMockConversation({
        id: "conv-victim-1",
        userId: userId,
        title: "Secret Strategy",
      })
    );

    await expect(loadOrCreateConversation(attackerId, "conv-victim-1")).rejects.toThrow(
      NotFoundError
    );
  });

  it("loads conversation successfully when owned by requesting user", async () => {
    const userId = "user@example.com";

    vi.mocked(conversations.getConversation).mockResolvedValueOnce(
      createMockConversation({
        id: "conv-1",
        userId: userId,
        title: "My Chat",
      })
    );

    const result = await loadOrCreateConversation(userId, "conv-1");
    expect(result.conversationId).toBe("conv-1");
    expect(result.isNew).toBe(false);
  });

  it("creates a new conversation when requested ID is omitted", async () => {
    const userId = "user@example.com";

    vi.mocked(conversations.saveConversation).mockResolvedValueOnce(
      createMockConversation({
        id: "conv-new-1",
        userId: userId,
        title: "Cuộc trò chuyện mới",
      })
    );

    const result = await loadOrCreateConversation(userId, null);
    expect(result.conversationId).toBe("conv-new-1");
    expect(result.isNew).toBe(true);
  });
});
