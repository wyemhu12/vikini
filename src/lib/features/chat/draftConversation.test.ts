import { describe, it, expect, vi } from "vitest";
import { shouldClearQueue, createDraftCoordinator, DRAFT_PENDING } from "./draftConversation";

describe("draftConversation", () => {
  describe("shouldClearQueue", () => {
    it("returns false when nextId is DRAFT_PENDING", () => {
      expect(shouldClearQueue(null, DRAFT_PENDING, false)).toBe(false);
      expect(shouldClearQueue("conv-1", DRAFT_PENDING, false)).toBe(false);
    });

    it("returns false when prevId is null and isSelfInitiated is true", () => {
      expect(shouldClearQueue(null, "new-conv-id", true)).toBe(false);
      expect(shouldClearQueue(undefined, "new-conv-id", true)).toBe(false);
    });

    it("returns true when switching between different conversations", () => {
      expect(shouldClearQueue("conv-1", "conv-2", false)).toBe(true);
      expect(shouldClearQueue("conv-1", "conv-2", true)).toBe(true);
      expect(shouldClearQueue(null, "conv-1", false)).toBe(true);
    });

    it("returns false when conversationId remains unchanged", () => {
      expect(shouldClearQueue("conv-1", "conv-1", false)).toBe(false);
      expect(shouldClearQueue(null, null, false)).toBe(false);
    });
  });

  describe("createDraftCoordinator", () => {
    it("coordinates single-flight conversation creation across concurrent calls", async () => {
      const mockCreate = vi.fn().mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 10));
        return { id: "created-conv-123" };
      });
      const onCreated = vi.fn();

      const coordinator = createDraftCoordinator({
        createConversation: mockCreate,
        onConversationCreated: onCreated,
      });

      // Call ensureConversationId concurrently 3 times
      const [id1, id2, id3] = await Promise.all([
        coordinator.ensureConversationId(),
        coordinator.ensureConversationId(),
        coordinator.ensureConversationId(),
      ]);

      expect(id1).toBe("created-conv-123");
      expect(id2).toBe("created-conv-123");
      expect(id3).toBe("created-conv-123");
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(onCreated).toHaveBeenCalledWith("created-conv-123");
    });

    it("allows reset to start a new coordinator cycle", async () => {
      const mockCreate = vi
        .fn()
        .mockResolvedValueOnce({ id: "conv-cycle-1" })
        .mockResolvedValueOnce({ id: "conv-cycle-2" });

      const coordinator = createDraftCoordinator({
        createConversation: mockCreate,
      });

      const firstId = await coordinator.ensureConversationId();
      expect(firstId).toBe("conv-cycle-1");

      coordinator.reset();

      const secondId = await coordinator.ensureConversationId();
      expect(secondId).toBe("conv-cycle-2");
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it("throws when createConversation fails to return an id", async () => {
      const mockCreate = vi.fn().mockResolvedValue(null);
      const coordinator = createDraftCoordinator({
        createConversation: mockCreate,
      });

      await expect(coordinator.ensureConversationId()).rejects.toThrow(
        "Failed to create conversation"
      );
    });
  });
});
