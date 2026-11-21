import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  saveMessage,
  upsertMessage,
  getMessages,
  DEFAULT_GET_MESSAGES_LIMIT,
  MAX_GET_MESSAGES_LIMIT,
  recordTombstone,
  isTombstoned,
  deleteMessage,
  deleteLastAssistantMessage,
  deleteMessageByClientMessageId,
  deleteMessagesIncludingAndAfter,
  encryptMetaReasoning,
  decryptMetaReasoning,
} from "./messages";
import { AppError, DatabaseError, ForbiddenError, NotFoundError } from "@/lib/utils/errors";

// Mock Supabase admin client
const mockFrom = vi.fn();
const mockEncryptText = vi.fn((text: string) => `enc:${text}`);
vi.mock("@/lib/core/supabase.server", () => ({
  getSupabaseAdmin: () => ({
    from: mockFrom,
    storage: {
      from: () => ({
        remove: vi.fn().mockResolvedValue({}),
      }),
    },
  }),
}));

vi.mock("@/lib/core/encryption", () => ({
  encryptText: (text: string) => mockEncryptText(text),
  decryptText: (text: string) => {
    if (text.startsWith("enc:")) return text.replace(/^enc:/, "");
    throw new Error("Invalid ciphertext or decryption failure");
  },
}));

describe("messages - upsert and tombstone logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEncryptText.mockImplementation((text: string) => `enc:${text}`);
  });

  it("records tombstone and recognizes tombstoned clientMessageId", () => {
    const clientId = "tombstone-test-1";
    expect(isTombstoned(clientId)).toBe(false);

    recordTombstone(clientId);
    expect(isTombstoned(clientId)).toBe(true);
  });

  it("rejects upsert when clientMessageId is tombstoned", async () => {
    const clientId = "tombstone-test-reject";
    recordTombstone(clientId);

    const result = await upsertMessage("user-1", "conv-1", "assistant", "Some content", {
      clientMessageId: clientId,
      isPartial: true,
    });

    expect(result.message).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("inserts new message if clientMessageId not found in DB", async () => {
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [] }),
        }),
      }),
    });

    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: "msg-123",
            conversation_id: "conv-1",
            role: "assistant",
            content: "enc:Hello world",
            meta: { clientMessageId: "client-new" },
          },
          error: null,
        }),
      }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "messages") {
        return {
          select: selectMock,
          insert: insertMock,
        };
      }
      return {};
    });

    const result = await upsertMessage(
      "user-1",
      "conv-1",
      "assistant",
      "Hello world",
      { isPartial: false },
      "client-new"
    );

    expect(result.message).not.toBeNull();
    expect(result.message?.id).toBe("msg-123");
    expect(result.message?.content).toBe("Hello world");
  });

  it("does not overwrite complete message with partial message (Complete beats Partial)", async () => {
    const existingRow = {
      id: "msg-complete-1",
      conversation_id: "conv-1",
      role: "assistant",
      content: "enc:Complete answer",
      meta: { clientMessageId: "client-c1", isPartial: false },
    };

    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [existingRow] }),
        }),
      }),
    });

    mockFrom.mockImplementation(() => ({
      select: selectMock,
    }));

    const result = await upsertMessage(
      "user-1",
      "conv-1",
      "assistant",
      "Partial answer truncated",
      { isPartial: true },
      "client-c1"
    );

    expect(result.alreadyComplete).toBe(true);
    expect(result.message?.id).toBe("msg-complete-1");
    expect(result.message?.content).toBe("Complete answer");
  });

  it("updates existing partial message when incoming is also partial or complete", async () => {
    const existingPartialRow = {
      id: "msg-partial-1",
      conversation_id: "conv-1",
      role: "assistant",
      content: "enc:Initial partial",
      meta: { clientMessageId: "client-update-1", isPartial: true },
    };

    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [existingPartialRow] }),
        }),
      }),
    });

    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              ...existingPartialRow,
              content: "enc:Updated full answer",
              meta: { clientMessageId: "client-update-1", isPartial: false },
            },
            error: null,
          }),
        }),
      }),
    });

    mockFrom.mockImplementation(() => ({
      select: selectMock,
      update: updateMock,
    }));

    const result = await upsertMessage(
      "user-1",
      "conv-1",
      "assistant",
      "Updated full answer",
      { isPartial: false },
      "client-update-1"
    );

    expect(result.message?.content).toBe("Updated full answer");
  });

  it("records tombstone and deletes by clientMessageId in deleteMessageByClientMessageId", async () => {
    const deleteMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "msg-to-delete", meta: { clientMessageId: "del-id-1" } },
          }),
        }),
      }),
    });

    mockFrom.mockImplementation(() => ({
      select: selectMock,
      delete: deleteMock,
    }));

    await deleteMessageByClientMessageId("user-1", "conv-1", "del-id-1");

    expect(isTombstoned("del-id-1")).toBe(true);
    expect(deleteMock).toHaveBeenCalled();
  });

  it("deleteMessage throws NotFoundError if message does not exist", async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }));

    await expect(deleteMessage("user-1", "non-existent-msg")).rejects.toThrow(NotFoundError);
  });

  it("deleteMessage throws ForbiddenError if conversation belongs to another user (TC-SEC-01A)", async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: "msg-victim",
              meta: {},
              conversation_id: "conv-victim",
              conversations: { user_id: "victim@example.com" },
            },
            error: null,
          }),
        }),
      }),
    }));

    await expect(deleteMessage("attacker@example.com", "msg-victim")).rejects.toThrow(
      ForbiddenError
    );
  });

  it("deleteMessage deletes message when owned by requesting user (TC-SEC-01B)", async () => {
    const deleteMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: "msg-my",
              meta: { clientMessageId: "my-client-id" },
              conversation_id: "conv-my",
              conversations: { user_id: "my@example.com" },
            },
            error: null,
          }),
        }),
      }),
      delete: deleteMock,
    }));

    await deleteMessage("my@example.com", "msg-my");
    expect(deleteMock).toHaveBeenCalled();
    expect(isTombstoned("my-client-id")).toBe(true);
  });

  it("deleteMessagesIncludingAndAfter aborts deletion if conversation is not owned by user (TC-SEC-01E)", async () => {
    const deleteMock = vi.fn();

    mockFrom.mockImplementation((table: string) => {
      if (table === "conversations") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn(),
        delete: deleteMock,
      };
    });

    await deleteMessagesIncludingAndAfter("attacker@example.com", "conv-victim", "msg-1");
    expect(deleteMock).not.toHaveBeenCalled();
  });

  describe("encryptMetaReasoning & decryptMetaReasoning (TC-THINK-03A..D / m-19, m-38)", () => {
    it("encrypts reasoning when non-empty string is provided (TC-THINK-03A)", () => {
      const meta = { reasoning: "Initial reasoning text", clientMessageId: "c1" };
      const encrypted = encryptMetaReasoning(meta);
      expect(encrypted.reasoning).toBe("enc:Initial reasoning text");
      expect(encrypted.clientMessageId).toBe("c1");
    });

    it("decrypts valid encrypted reasoning (TC-THINK-03B)", () => {
      const meta = { reasoning: "enc:Decrypted thought content", clientMessageId: "c1" };
      const decrypted = decryptMetaReasoning(meta);
      expect(decrypted.reasoning).toBe("Decrypted thought content");
    });

    it("strips corrupted ciphertext hex format so hex garbage is removed (TC-THINK-03C)", () => {
      // 24-hex:32-hex:ciphertext-hex
      const corruptedCiphertext =
        "0123456789abcdef01234567:0123456789abcdef0123456789abcdef:deadbeef1234";
      const meta = { reasoning: corruptedCiphertext, flag: "kept" };
      const result = decryptMetaReasoning(meta);
      expect(result.reasoning).toBeUndefined();
      expect(result.flag).toBe("kept");
    });

    it("preserves legacy plaintext containing colons safely without stripping (TC-THINK-03D / m-38)", () => {
      const legacyPlaintext = "Bước 1: phân tích yêu cầu; Bước 2: xử lý";
      const meta = { reasoning: legacyPlaintext, flag: "kept" };
      const result = decryptMetaReasoning(meta);
      expect(result.reasoning).toBe(legacyPlaintext);
      expect(result.flag).toBe("kept");
    });
  });

  describe("Fail-closed encryption & ownership/error guards (TC-W1-02)", () => {
    it("encryptMetaReasoning throws AppError(ENCRYPTION_ERROR) when encryptText fails", () => {
      mockEncryptText.mockImplementationOnce(() => {
        throw new Error("Key error");
      });

      expect(() => encryptMetaReasoning({ reasoning: "Private thoughts" })).toThrow(AppError);
    });

    it("saveMessage throws AppError(500 ENCRYPTION_ERROR) and never inserts plaintext when encryptText throws", async () => {
      const insertMock = vi.fn();
      mockFrom.mockReturnValue({ insert: insertMock });
      mockEncryptText.mockImplementationOnce(() => {
        throw new Error("Crypto error");
      });

      await expect(saveMessage("user-1", "conv-1", "user", "Secret message")).rejects.toMatchObject(
        {
          statusCode: 500,
          code: "ENCRYPTION_ERROR",
        }
      );
      expect(insertMock).not.toHaveBeenCalled();
    });

    it("upsertMessage throws AppError(500 ENCRYPTION_ERROR) and never updates DB when encryptText throws", async () => {
      const existingPartialRow = {
        id: "msg-partial-err",
        conversation_id: "conv-1",
        role: "assistant",
        content: "enc:Old partial",
        meta: { clientMessageId: "client-enc-fail", isPartial: true },
      };
      const updateMock = vi.fn();
      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [existingPartialRow] }),
          }),
        }),
      });
      mockFrom.mockReturnValue({ select: selectMock, update: updateMock });
      mockEncryptText.mockImplementationOnce(() => {
        throw new Error("Crypto error");
      });

      await expect(
        upsertMessage("user-1", "conv-1", "assistant", "Updated secret", {}, "client-enc-fail")
      ).rejects.toMatchObject({
        statusCode: 500,
        code: "ENCRYPTION_ERROR",
      });
      expect(updateMock).not.toHaveBeenCalled();
    });

    it("deleteLastAssistantMessage throws ForbiddenError for unowned conversation and does not delete", async () => {
      const deleteMock = vi.fn();
      mockFrom.mockImplementation((table: string) => {
        if (table === "conversations") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: "conv-victim", user_id: "victim@example.com" },
                  error: null,
                }),
              }),
            }),
          };
        }
        return { delete: deleteMock };
      });

      await expect(
        deleteLastAssistantMessage("attacker@example.com", "conv-victim")
      ).rejects.toThrow(ForbiddenError);
      expect(deleteMock).not.toHaveBeenCalled();
    });

    it("deleteLastAssistantMessage returns idempotently when conversation does not exist", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "conversations") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          };
        }
        throw new Error("Should not query messages");
      });

      await expect(
        deleteLastAssistantMessage("user@example.com", "conv-missing")
      ).resolves.toBeUndefined();
    });

    it("deleteLastAssistantMessage throws DatabaseError when .delete() returns an error", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "conversations") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: "conv-own", user_id: "user@example.com" },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { id: "msg-last", meta: { clientMessageId: "c-last" } },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: { message: "delete failed" } }),
          }),
        };
      });

      await expect(deleteLastAssistantMessage("user@example.com", "conv-own")).rejects.toThrow(
        DatabaseError
      );
    });

    it("deleteMessage throws DatabaseError when .delete() returns an error", async () => {
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "msg-my",
                meta: {},
                conversation_id: "conv-my",
                conversations: { user_id: "my@example.com" },
              },
              error: null,
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: { message: "FK violation" } }),
        }),
      }));

      await expect(deleteMessage("my@example.com", "msg-my")).rejects.toThrow(DatabaseError);
    });
  });

  describe("getMessages bounded query (TC-W2A-17)", () => {
    it("applies default limit 500 descending, clamps limit to [1, 1000], and reverses to chronological order", async () => {
      const limitMock = vi.fn().mockResolvedValue({
        data: [
          { id: "m2", conversation_id: "c1", role: "assistant", content: "enc:Second" },
          { id: "m1", conversation_id: "c1", role: "user", content: "enc:First" },
        ],
        error: null,
      });
      const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
      const eqMock = vi.fn().mockReturnValue({ order: orderMock });
      mockFrom.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: eqMock }) });

      const msgs = await getMessages("c1");
      expect(orderMock).toHaveBeenCalledWith("created_at", { ascending: false });
      expect(limitMock).toHaveBeenCalledWith(DEFAULT_GET_MESSAGES_LIMIT);
      expect(msgs.map((m) => m.id)).toEqual(["m1", "m2"]);
      expect(msgs.map((m) => m.content)).toEqual(["First", "Second"]);

      await getMessages("c1", 5000);
      expect(limitMock).toHaveBeenLastCalledWith(MAX_GET_MESSAGES_LIMIT);

      await getMessages("c1", -5);
      expect(limitMock).toHaveBeenLastCalledWith(1);
    });
  });
});
