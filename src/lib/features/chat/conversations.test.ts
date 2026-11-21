// Test file for conversations.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mapConversationRow,
  DEFAULT_MODEL,
  assertConversationOwner,
  updateConversation,
  branchConversation,
  setConversationModel,
  setConversationGem,
  setConversationPersona,
  setConversationProject,
  saveConversation,
} from "./conversations";
import { invalidateConversationsCache } from "@/lib/core/cache";
import { NotFoundError, ForbiddenError } from "@/lib/utils/errors";

const mockSingle = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();
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
    mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate, insert: mockInsert });
    mockSelect.mockReturnValue({ eq: mockEq, single: mockSingle, maybeSingle: mockSingle });
    mockEq.mockReturnValue({ single: mockSingle, maybeSingle: mockSingle, select: mockSelect });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockInsert.mockReturnValue({ select: mockSelect });
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
      // Model should be coerced to a valid model (gemini-pro -> DEFAULT_MODEL via fallback)
      expect(result?.model).toBe(DEFAULT_MODEL);
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
      // Model should be coerced to a valid model (gemini-1.5-pro -> DEFAULT_MODEL via alias)
      expect(result?.model).toBe(DEFAULT_MODEL);
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

  describe("Cross-tenant IDOR guards (TC-W1-01)", () => {
    it("setConversationGem rejects foreign private gem with ForbiddenError and does not update", async () => {
      mockSingle
        .mockResolvedValueOnce({
          data: { id: "conv-1", user_id: "attacker@example.com", title: "Chat" },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: "gem-victim", user_id: "victim@example.com", is_premade: false },
          error: null,
        });

      await expect(
        setConversationGem("attacker@example.com", "conv-1", "gem-victim")
      ).rejects.toThrow(ForbiddenError);
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("setConversationGem rejects non-existent gem with NotFoundError", async () => {
      mockSingle
        .mockResolvedValueOnce({
          data: { id: "conv-1", user_id: "attacker@example.com", title: "Chat" },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null });

      await expect(
        setConversationGem("attacker@example.com", "conv-1", "gem-missing")
      ).rejects.toThrow(NotFoundError);
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("setConversationGem allows premade gem", async () => {
      mockSingle
        .mockResolvedValueOnce({
          data: { id: "conv-1", user_id: "user@example.com", title: "Chat" },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: "gem-premade", user_id: "admin@example.com", is_premade: true },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: "conv-1", user_id: "user@example.com", title: "Chat", gem_id: "gem-premade" },
          error: null,
        });

      const updated = await setConversationGem("user@example.com", "conv-1", "gem-premade");
      expect(updated?.gemId).toBe("gem-premade");
      expect(mockUpdate).toHaveBeenCalled();
    });

    it("setConversationPersona rejects foreign private persona with ForbiddenError and does not update", async () => {
      mockSingle
        .mockResolvedValueOnce({
          data: { id: "conv-1", user_id: "attacker@example.com", title: "Chat" },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: "persona-victim", user_id: "victim@example.com", is_premade: false },
          error: null,
        });

      await expect(
        setConversationPersona("attacker@example.com", "conv-1", "persona-victim")
      ).rejects.toThrow(ForbiddenError);
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("setConversationProject rejects foreign project with ForbiddenError and does not update", async () => {
      mockSingle
        .mockResolvedValueOnce({
          data: { id: "conv-1", user_id: "attacker@example.com", title: "Chat" },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: "proj-victim", user_id: "victim@example.com" },
          error: null,
        });

      await expect(
        setConversationProject("attacker@example.com", "conv-1", "proj-victim")
      ).rejects.toThrow(ForbiddenError);
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("saveConversation rejects foreign projectId with ForbiddenError and does not insert", async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: "proj-victim", user_id: "victim@example.com" },
        error: null,
      });

      await expect(
        saveConversation("attacker@example.com", {
          title: "Custom Title",
          projectId: "proj-victim",
        })
      ).rejects.toThrow(ForbiddenError);
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it("saveConversation rejects foreign private gemId with ForbiddenError and does not insert", async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: "gem-victim", user_id: "victim@example.com", is_premade: false },
        error: null,
      });

      await expect(
        saveConversation("attacker@example.com", {
          title: "Custom Title",
          gemId: "gem-victim",
        })
      ).rejects.toThrow(ForbiddenError);
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  describe("updateConversation & bounded branchConversation (TC-W2A-17)", () => {
    it("batches title, gemId, model, projectId, personaId into 1 UPDATE and 1 cache invalidation", async () => {
      mockSingle
        .mockResolvedValueOnce({
          data: { id: "conv-1", user_id: "user@example.com", title: "Old" },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: "gem-1", user_id: "user@example.com", is_premade: false },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: "persona-1", user_id: "user@example.com", is_premade: false },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: "proj-1", user_id: "user@example.com" },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            id: "conv-1",
            user_id: "user@example.com",
            title: "Renamed",
            gem_id: "gem-1",
            persona_id: "persona-1",
            project_id: "proj-1",
            model: "gemini-4-argon",
          },
          error: null,
        });

      const res = await updateConversation("user@example.com", "conv-1", {
        title: "Renamed",
        gemId: "gem-1",
        personaId: "persona-1",
        projectId: "proj-1",
        model: "gemini-4-argon",
      });

      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Renamed",
          gem_id: "gem-1",
          persona_id: "persona-1",
          project_id: "proj-1",
          model: "gemini-4-argon",
        })
      );
      expect(invalidateConversationsCache).toHaveBeenCalledTimes(1);
      expect(res?.personaId).toBe("persona-1");
    });

    it("returns current conversation with 0 DB updates on empty patch and rejects foreign gemId with 0 DB updates", async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: "conv-1", user_id: "user@example.com", title: "Unchanged" },
        error: null,
      });

      const noop = await updateConversation("user@example.com", "conv-1", {});
      expect(noop?.title).toBe("Unchanged");
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(invalidateConversationsCache).not.toHaveBeenCalled();

      mockSingle
        .mockResolvedValueOnce({
          data: { id: "conv-1", user_id: "attacker@example.com", title: "Mine" },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: "gem-victim", user_id: "victim@example.com", is_premade: false },
          error: null,
        });

      await expect(
        updateConversation("attacker@example.com", "conv-1", {
          title: "ShouldNotWrite",
          gemId: "gem-victim",
        })
      ).rejects.toThrow(ForbiddenError);
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("bounds branchConversation source messages to 500 DESC (reversed) and inserts cloned rows in batches of 100", async () => {
      const limitSpy = vi.fn();
      const orderSpy = vi.fn();
      const insertBatches: unknown[][] = [];

      // 250 source messages returned in descending order
      const descMessages = Array.from({ length: 250 }, (_, i) => ({
        role: i % 2 === 0 ? "assistant" : "user",
        content: `enc-${249 - i}`,
        meta: {},
        created_at: `2026-11-21T00:${String(Math.floor((249 - i) / 60)).padStart(2, "0")}:${String((249 - i) % 60).padStart(2, "0")}Z`,
      }));

      let msgSelectCall = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === "conversations") {
          const convoResult = {
            data: {
              id: "conv-src",
              user_id: "user@example.com",
              title: "Source",
              model: DEFAULT_MODEL,
            },
            error: null,
          };
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue(convoResult),
                maybeSingle: vi.fn().mockResolvedValue(convoResult),
              }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: "conv-branch", user_id: "user@example.com", title: "[Nhánh] Source" },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "messages") {
          return {
            select: vi.fn().mockImplementation(() => {
              msgSelectCall += 1;
              if (msgSelectCall === 1) {
                // target message lookup
                return {
                  eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: {
                          id: "msg-target",
                          role: "assistant",
                          content: "ans",
                          meta: {},
                          created_at: descMessages[0].created_at,
                        },
                        error: null,
                      }),
                    }),
                  }),
                };
              }
              if (msgSelectCall === 2) {
                // preceding user message lookup
                return {
                  eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      lte: vi.fn().mockReturnValue({
                        order: vi.fn().mockReturnValue({
                          limit: vi.fn().mockReturnValue({
                            maybeSingle: vi.fn().mockResolvedValue({
                              data: {
                                id: "msg-user",
                                role: "user",
                                created_at: descMessages[1].created_at,
                              },
                              error: null,
                            }),
                          }),
                        }),
                      }),
                    }),
                  }),
                };
              }
              // source messages bounded fetch
              return {
                eq: vi.fn().mockReturnValue({
                  lte: vi.fn().mockReturnValue({
                    order: (...oArgs: unknown[]) => {
                      orderSpy(...oArgs);
                      return {
                        limit: (n: number) => {
                          limitSpy(n);
                          return Promise.resolve({ data: descMessages, error: null });
                        },
                      };
                    },
                  }),
                }),
              };
            }),
            insert: vi.fn().mockImplementation(async (batch: unknown[]) => {
              insertBatches.push(batch);
              return { error: null };
            }),
          };
        }
        return {};
      });

      const branched = await branchConversation("user@example.com", "conv-src", "msg-target");
      expect(branched.id).toBe("conv-branch");
      expect(orderSpy).toHaveBeenCalledWith("created_at", { ascending: false });
      expect(limitSpy).toHaveBeenCalledWith(500);
      expect(insertBatches.map((b) => b.length)).toEqual([100, 100, 50]);
    });
  });
});
