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
              eq: (_col2: string, _typeVal: string) => ({
                order: () =>
                  Promise.resolve({
                    data: hoisted.storedMessages.filter(
                      (m) =>
                        m.conversation_id === convId && m.meta?.novelcrafterType === "story_state"
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
import { NotFoundError, ValidationError } from "@/lib/utils/errors";
import { createDefaultStoryState } from "./types";
import {
  getStoryState,
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
});
