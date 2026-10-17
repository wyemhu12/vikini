// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  process.env.DATA_ENCRYPTION_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  return {
    getConversationMock: vi.fn(),
    invalidateConversationsCacheMock: vi.fn(),
    storedMessages: [] as Array<{
      id: string;
      conversation_id: string;
      role: string;
      content: string;
      meta: Record<string, unknown>;
      created_at: string;
    }>,
    deletedIds: [] as string[],
    updatedConversations: [] as Array<{ id: string; updated_at: string }>,
  };
});

vi.mock("@/lib/features/chat/conversations", () => ({
  getConversation: hoisted.getConversationMock,
}));

vi.mock("@/lib/core/cache", () => ({
  invalidateConversationsCache: hoisted.invalidateConversationsCacheMock,
}));

vi.mock("@/lib/core/supabase.server", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      if (table === "messages") {
        return {
          select: () => ({
            eq: (_col1: string, convId: string) => ({
              eq: (_col2: string, typeVal: string) => ({
                order: () =>
                  Promise.resolve({
                    data: hoisted.storedMessages.filter(
                      (m) => m.conversation_id === convId && m.meta?.novelcrafterType === typeVal
                    ),
                    error: null,
                  }),
              }),
            }),
          }),
          insert: (row: {
            conversation_id: string;
            role: string;
            content: string;
            meta: Record<string, unknown>;
          }) => {
            hoisted.storedMessages.unshift({
              id: `msg-${hoisted.storedMessages.length + 1}`,
              conversation_id: row.conversation_id,
              role: row.role,
              content: row.content,
              meta: row.meta,
              created_at: new Date().toISOString(),
            });
            return Promise.resolve({ data: null, error: null });
          },
          update: (patch: { role: string; content: string; meta: Record<string, unknown> }) => ({
            eq: (_col: string, id: string) => {
              const target = hoisted.storedMessages.find((m) => m.id === id);
              if (target) {
                target.role = patch.role;
                target.content = patch.content;
                target.meta = patch.meta;
              }
              return Promise.resolve({ data: null, error: null });
            },
          }),
          delete: () => ({
            in: (_col: string, ids: string[]) => {
              hoisted.deletedIds.push(...ids);
              hoisted.storedMessages = hoisted.storedMessages.filter((m) => !ids.includes(m.id));
              return Promise.resolve({ data: null, error: null });
            },
          }),
        };
      }

      if (table === "conversations") {
        return {
          update: (patch: { updated_at: string }) => ({
            eq: (_col: string, id: string) => {
              hoisted.updatedConversations.push({ id, updated_at: patch.updated_at });
              return Promise.resolve({ data: null, error: null });
            },
          }),
        };
      }

      return {};
    },
  }),
}));

import { MODEL_IDS } from "@/lib/utils/constants";
import { AppError, NotFoundError, ValidationError } from "@/lib/utils/errors";
import { createDefaultStoryState } from "./types";
import {
  getStoryState,
  NOVELCRAFTER_CORRUPTED_BACKUP_META_TYPE,
  saveStoryState,
  verifyNovelcrafterConversationOwnership,
} from "./storyPersistence.server";

const VALID_CONVO_ID = "123e4567-e89b-12d3-a456-426614174000";
const USER_ID = "author@vikini.net";

describe("storyPersistence.server (TC-05)", () => {
  beforeEach(() => {
    hoisted.storedMessages = [];
    hoisted.deletedIds = [];
    hoisted.updatedConversations = [];
    hoisted.getConversationMock.mockReset();
    hoisted.invalidateConversationsCacheMock.mockReset();

    hoisted.getConversationMock.mockResolvedValue({
      id: VALID_CONVO_ID,
      userId: USER_ID,
      model: MODEL_IDS.NOVELCRAFTER,
      title: "My Sci-Fi Novel",
    });
  });

  it("encrypts with real AES-256-GCM (iv:authTag:encryptedData) and preserves unclosed <think> tags & Vietnamese Unicode without corruption", async () => {
    const initial = createDefaultStoryState("Chương 1: Khởi Đầu");
    initial.storyBible.braindump =
      "Ý tưởng tiếng Việt có thẻ <think>suy nghĩ chưa đóng trong kịch bản";
    initial.chapters[0].content =
      "Đoạn văn kịch bản có chứa <think>nội tâm nhân vật chưa đóng thẻ.";
    initial.updatedAt = 5000;

    const saved = await saveStoryState(USER_ID, VALID_CONVO_ID, initial);

    expect(hoisted.storedMessages).toHaveLength(1);
    const rawStored = hoisted.storedMessages[0];
    expect(rawStored.role).toBe("system");
    expect(rawStored.meta).toMatchObject({
      novelcrafterType: "story_state",
      isContextOnly: true,
      version: saved.version,
    });

    // Verify 3-segment hex AES-256-GCM format: iv (24 hex chars) : authTag (32 hex chars) : cipher
    const parts = rawStored.content.split(":");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toHaveLength(24);
    expect(parts[1]).toHaveLength(32);
    expect(rawStored.content).not.toContain("Ý tưởng tiếng Việt");

    // Round-trip decrypt via getStoryState
    const loaded = await getStoryState(USER_ID, VALID_CONVO_ID);
    expect(loaded.storyBible.braindump).toBe(
      "Ý tưởng tiếng Việt có thẻ <think>suy nghĩ chưa đóng trong kịch bản"
    );
    expect(loaded.chapters[0].content).toBe(
      "Đoạn văn kịch bản có chứa <think>nội tâm nhân vật chưa đóng thẻ."
    );
    expect(hoisted.invalidateConversationsCacheMock).toHaveBeenCalledWith(USER_ID);
  });

  it("rejects stale story state overwrite when updatedAt or version is older than existing DB state", async () => {
    const stateV1 = createDefaultStoryState("Chương 1");
    stateV1.updatedAt = 10_000;
    const savedV1 = await saveStoryState(USER_ID, VALID_CONVO_ID, stateV1);

    const staleRequest = {
      ...savedV1,
      updatedAt: savedV1.updatedAt - 500,
    };

    await expect(saveStoryState(USER_ID, VALID_CONVO_ID, staleRequest)).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it("deduplicates redundant story_state rows automatically", async () => {
    const state1 = createDefaultStoryState("Chương 1");
    await saveStoryState(USER_ID, VALID_CONVO_ID, state1);

    // Simulate a duplicate row inserted by a race condition
    hoisted.storedMessages.push({
      ...hoisted.storedMessages[0],
      id: "msg-duplicate-old",
    });
    expect(hoisted.storedMessages).toHaveLength(2);

    await getStoryState(USER_ID, VALID_CONVO_ID);
    expect(hoisted.deletedIds).toContain("msg-duplicate-old");
    expect(hoisted.storedMessages).toHaveLength(1);
  });

  it("enforces strict UUID validation and Novelcrafter conversation ownership", async () => {
    await expect(
      verifyNovelcrafterConversationOwnership(USER_ID, "not-a-uuid")
    ).rejects.toBeInstanceOf(ValidationError);

    // Different user
    hoisted.getConversationMock.mockResolvedValueOnce({
      id: VALID_CONVO_ID,
      userId: "other@vikini.net",
      model: MODEL_IDS.NOVELCRAFTER,
    });
    await expect(
      verifyNovelcrafterConversationOwnership(USER_ID, VALID_CONVO_ID)
    ).rejects.toBeInstanceOf(NotFoundError);

    // Regular chat conversation (not Novelcrafter)
    hoisted.getConversationMock.mockResolvedValueOnce({
      id: VALID_CONVO_ID,
      userId: USER_ID,
      model: "gemini-2.5-flash",
    });
    await expect(
      verifyNovelcrafterConversationOwnership(USER_ID, VALID_CONVO_ID)
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("TC-03A (Cases 3A-1..3A-5): throws STORY_STATE_CORRUPTED on decryption failure, blocks unconfirmed overwrites, and preserves corrupted backup row across subsequent saves", async () => {
    hoisted.storedMessages.push({
      id: "msg-corrupted-1",
      conversation_id: VALID_CONVO_ID,
      role: "system",
      content: "corrupted-ciphertext",
      meta: {
        novelcrafterType: "story_state",
        version: 2,
        updatedAt: 1000,
      },
      created_at: new Date().toISOString(),
    });

    // Case 3A-1: getStoryState throws 500 STORY_STATE_CORRUPTED
    await expect(getStoryState(USER_ID, VALID_CONVO_ID)).rejects.toMatchObject({
      statusCode: 500,
      code: "STORY_STATE_CORRUPTED",
    });

    // Case 3A-2: Unconfirmed save on corrupted row is ALWAYS rejected with 409 DESTRUCTIVE_SAVE_REJECTED even with large nextChars
    const largeIncoming = createDefaultStoryState("Chương 1");
    largeIncoming.version = 2;
    largeIncoming.updatedAt = 2000;
    largeIncoming.chapters[0].content = "A".repeat(5_000);

    await expect(saveStoryState(USER_ID, VALID_CONVO_ID, largeIncoming)).rejects.toMatchObject({
      statusCode: 409,
      code: "DESTRUCTIVE_SAVE_REJECTED",
      reason: "corrupted_remote",
    });

    // Case 3A-3: Confirmed recovery with allowDestructive: true bypasses stale check on corrupted row and inserts backup row
    const recoveryState = createDefaultStoryState("Chương Khôi Phục");
    recoveryState.version = 1;
    recoveryState.updatedAt = 500;
    recoveryState.chapters[0].content = "Nội dung khôi phục";

    const recovered = await saveStoryState(USER_ID, VALID_CONVO_ID, recoveryState, {
      allowDestructive: true,
    });
    expect(recovered.version).toBe(3);

    const backupRowsAfterRecovery = hoisted.storedMessages.filter(
      (m) => m.meta?.novelcrafterType === NOVELCRAFTER_CORRUPTED_BACKUP_META_TYPE
    );
    expect(backupRowsAfterRecovery).toHaveLength(1);
    expect(backupRowsAfterRecovery[0].content).toBe("corrupted-ciphertext");

    // Case 3A-4: Stale save on a healthy row is STILL rejected even if allowDestructive: true
    const staleOnHealthy = {
      ...recovered,
      version: 1,
      updatedAt: 500,
    };
    await expect(
      saveStoryState(USER_ID, VALID_CONVO_ID, staleOnHealthy, { allowDestructive: true })
    ).rejects.toBeInstanceOf(ValidationError);

    // Case 3A-5: Subsequent normal save updates main row to v4 while backup row survives intact
    const nextEdit = {
      ...recovered,
      updatedAt: recovered.updatedAt + 1000,
    };
    nextEdit.chapters[0].content = "Nội dung chương v4";
    const savedV4 = await saveStoryState(USER_ID, VALID_CONVO_ID, nextEdit);
    expect(savedV4.version).toBe(4);

    const loadedV4 = await getStoryState(USER_ID, VALID_CONVO_ID);
    expect(loadedV4.version).toBe(4);
    expect(loadedV4.chapters[0].content).toBe("Nội dung chương v4");

    const backupRowsAfterV4 = hoisted.storedMessages.filter(
      (m) => m.meta?.novelcrafterType === NOVELCRAFTER_CORRUPTED_BACKUP_META_TYPE
    );
    expect(backupRowsAfterV4).toHaveLength(1);
    expect(backupRowsAfterV4[0].content).toBe("corrupted-ciphertext");
    expect(AppError).toBeDefined();
  });
});
