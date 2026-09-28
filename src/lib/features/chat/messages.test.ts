import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  upsertMessage,
  recordTombstone,
  isTombstoned,
  deleteMessageByClientMessageId,
} from "./messages";

// Mock Supabase admin client
const mockFrom = vi.fn();
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
  encryptText: (text: string) => `enc:${text}`,
  decryptText: (text: string) => text.replace(/^enc:/, ""),
}));

describe("messages - upsert and tombstone logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
