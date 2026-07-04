// Tests for personas.ts - Business logic
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Supabase BEFORE importing the module ─────────────────────────
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDeleteFn = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockSingle = vi.fn();
const mockMaybeSingle = vi.fn();
const mockOr = vi.fn();

// Chain builder: each method returns the chain so calls can be composed
const mockChain = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDeleteFn,
  eq: mockEq,
  or: mockOr,
  order: mockOrder,
  single: mockSingle,
  maybeSingle: mockMaybeSingle,
};

// Every chain method returns the chain itself for fluent API
for (const fn of Object.values(mockChain)) {
  fn.mockReturnValue(mockChain);
}

const mockFrom = vi.fn(() => mockChain);

vi.mock("@/lib/core/supabase.server", () => ({
  getSupabaseAdmin: () => ({ from: mockFrom }),
}));

// ── Import AFTER mocks ───────────────────────────────────────────────
import {
  getPersonasForUser,
  createPersona,
  updatePersona,
  deletePersona,
  getPersonaInstructionsForConversation,
} from "./personas";
import { DatabaseError, NotFoundError, ForbiddenError } from "@/lib/utils/errors";

// ── Helpers ───────────────────────────────────────────────────────────
const TEST_USER_ID = "test@example.com";
const TEST_PERSONA_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const TEST_CONVO_ID = "b2c3d4e5-f6a7-8901-bcde-f12345678901";

const mockPersonaRow = {
  id: TEST_PERSONA_ID,
  user_id: TEST_USER_ID,
  name: "Test Persona",
  description: "A test persona",
  tone: "friendly",
  use_emojis: true,
  use_headers_lists: true,
  user_context: "I am a developer",
  custom_instructions: "Be concise",
  icon: "",
  color: "#FF0000",
  is_premade: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function resetChain() {
  for (const fn of Object.values(mockChain)) {
    fn.mockReset();
    fn.mockReturnValue(mockChain);
  }
  mockFrom.mockReset();
  mockFrom.mockReturnValue(mockChain);
}

// ── Tests ─────────────────────────────────────────────────────────────
describe("Personas Business Logic", () => {
  beforeEach(() => {
    resetChain();
  });

  // ────────────────────────────────────────────────────────────────────
  // getPersonasForUser
  // ────────────────────────────────────────────────────────────────────
  describe("getPersonasForUser", () => {
    it("should return an array of personas", async () => {
      // First .order() returns chain, second .order() resolves with data
      mockOrder
        .mockReturnValueOnce(mockChain)
        .mockResolvedValueOnce({ data: [mockPersonaRow], error: null });

      const result = await getPersonasForUser(TEST_USER_ID);

      expect(result).toEqual([mockPersonaRow]);
      expect(mockFrom).toHaveBeenCalledWith("personas");
      expect(mockSelect).toHaveBeenCalledWith("*");
    });

    it("should return empty array when user has no personas", async () => {
      mockOrder.mockReturnValueOnce(mockChain).mockResolvedValueOnce({ data: [], error: null });

      const result = await getPersonasForUser(TEST_USER_ID);

      expect(result).toEqual([]);
    });

    it("should return empty array when data is null", async () => {
      mockOrder.mockReturnValueOnce(mockChain).mockResolvedValueOnce({ data: null, error: null });

      const result = await getPersonasForUser(TEST_USER_ID);

      expect(result).toEqual([]);
    });

    it("should throw DatabaseError on Supabase error", async () => {
      mockOrder.mockReturnValueOnce(mockChain).mockResolvedValueOnce({
        data: null,
        error: { message: "Connection refused" },
      });

      await expect(getPersonasForUser(TEST_USER_ID)).rejects.toThrow(DatabaseError);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // createPersona
  // ────────────────────────────────────────────────────────────────────
  describe("createPersona", () => {
    it("should create a persona with valid data", async () => {
      mockSingle.mockResolvedValue({ data: mockPersonaRow, error: null });

      const result = await createPersona(TEST_USER_ID, {
        name: "Test Persona",
        description: "A test persona",
        tone: "friendly",
        useEmojis: true,
        userContext: "I am a developer",
        customInstructions: "Be concise",
        icon: "",
        color: "#FF0000",
      });

      expect(result).toEqual(mockPersonaRow);
      expect(mockFrom).toHaveBeenCalledWith("personas");
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: TEST_USER_ID,
          name: "Test Persona",
          tone: "friendly",
        })
      );
    });

    it("should default tone to 'default' for invalid tone", async () => {
      mockSingle.mockResolvedValue({ data: mockPersonaRow, error: null });

      await createPersona(TEST_USER_ID, {
        name: "Test",
        tone: "invalid-tone",
      });

      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ tone: "default" }));
    });

    it("should default optional fields when not provided", async () => {
      mockSingle.mockResolvedValue({ data: mockPersonaRow, error: null });

      await createPersona(TEST_USER_ID, { name: "Minimal" });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: TEST_USER_ID,
          name: "Minimal",
          description: "",
          tone: "default",
          use_emojis: true,
          use_headers_lists: true,
          user_context: "",
          custom_instructions: "",
          icon: "",
          color: "",
        })
      );
    });

    it("should throw DatabaseError on insert failure", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: "Unique constraint violated" },
      });

      await expect(createPersona(TEST_USER_ID, { name: "Fail" })).rejects.toThrow(DatabaseError);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // updatePersona
  // ────────────────────────────────────────────────────────────────────
  describe("updatePersona", () => {
    it("should update a persona with valid data", async () => {
      // First call: maybeSingle for ownership check
      mockMaybeSingle.mockResolvedValueOnce({ data: mockPersonaRow, error: null });
      // Second call: single for the actual update
      mockSingle.mockResolvedValue({
        data: { ...mockPersonaRow, name: "Updated" },
        error: null,
      });

      const result = await updatePersona(TEST_USER_ID, TEST_PERSONA_ID, {
        name: "Updated",
      });

      expect(result.name).toBe("Updated");
    });

    it("should throw NotFoundError when persona does not exist", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      await expect(
        updatePersona(TEST_USER_ID, TEST_PERSONA_ID, { name: "Update" })
      ).rejects.toThrow(NotFoundError);
    });

    it("should throw ForbiddenError when user does not own the persona", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { ...mockPersonaRow, user_id: "other-user@example.com" },
        error: null,
      });

      await expect(updatePersona(TEST_USER_ID, TEST_PERSONA_ID, { name: "Steal" })).rejects.toThrow(
        ForbiddenError
      );
    });

    it("should default invalid tone to 'default' during update", async () => {
      mockMaybeSingle.mockResolvedValueOnce({ data: mockPersonaRow, error: null });
      mockSingle.mockResolvedValue({ data: mockPersonaRow, error: null });

      await updatePersona(TEST_USER_ID, TEST_PERSONA_ID, {
        tone: "nonexistent-tone",
      });

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ tone: "default" }));
    });

    it("should throw DatabaseError on read failure", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: null,
        error: { message: "DB read error" },
      });

      await expect(updatePersona(TEST_USER_ID, TEST_PERSONA_ID, { name: "Fail" })).rejects.toThrow(
        DatabaseError
      );
    });

    it("should throw DatabaseError on update failure", async () => {
      mockMaybeSingle.mockResolvedValueOnce({ data: mockPersonaRow, error: null });
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: "Update constraint error" },
      });

      await expect(updatePersona(TEST_USER_ID, TEST_PERSONA_ID, { name: "Fail" })).rejects.toThrow(
        DatabaseError
      );
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // deletePersona
  // ────────────────────────────────────────────────────────────────────
  describe("deletePersona", () => {
    it("should delete a persona successfully", async () => {
      // Ownership check: .select().eq().maybeSingle()
      mockMaybeSingle.mockResolvedValueOnce({
        data: { id: TEST_PERSONA_ID, user_id: TEST_USER_ID },
        error: null,
      });

      // Delete chain: .delete().eq("id", id).eq("user_id", userId)
      // After the ownership check, eq is called in a new chain for delete.
      // The last .eq() must be awaitable with { error: null }.
      // We track call count to only override on the delete chain calls.
      let eqCallCount = 0;
      mockEq.mockImplementation(() => {
        eqCallCount++;
        // Calls 1-2 are from ownership check (.eq("id", id) in select chain)
        // maybeSingle will resolve those. Calls 3-4 are from delete chain.
        if (eqCallCount >= 4) {
          // Last .eq() in delete chain - must resolve to { error: null }
          return Promise.resolve({ error: null });
        }
        return mockChain;
      });

      await expect(deletePersona(TEST_USER_ID, TEST_PERSONA_ID)).resolves.toBeUndefined();
      expect(mockFrom).toHaveBeenCalledWith("personas");
    });

    it("should silently succeed when persona does not exist (idempotent)", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      await expect(deletePersona(TEST_USER_ID, TEST_PERSONA_ID)).resolves.toBeUndefined();
    });

    it("should throw ForbiddenError when user does not own the persona", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { id: TEST_PERSONA_ID, user_id: "other-user@example.com" },
        error: null,
      });

      await expect(deletePersona(TEST_USER_ID, TEST_PERSONA_ID)).rejects.toThrow(ForbiddenError);
    });

    it("should throw DatabaseError on read failure", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: null,
        error: { message: "Read failed" },
      });

      await expect(deletePersona(TEST_USER_ID, TEST_PERSONA_ID)).rejects.toThrow(DatabaseError);
    });

    it("should throw DatabaseError on delete failure", async () => {
      // Ownership check succeeds
      mockMaybeSingle.mockResolvedValueOnce({
        data: { id: TEST_PERSONA_ID, user_id: TEST_USER_ID },
        error: null,
      });

      let eqCallCount = 0;
      mockEq.mockImplementation(() => {
        eqCallCount++;
        if (eqCallCount >= 3) {
          return Promise.resolve({ error: { message: "Delete failed" } });
        }
        return mockChain;
      });

      await expect(deletePersona(TEST_USER_ID, TEST_PERSONA_ID)).rejects.toThrow(DatabaseError);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // getPersonaInstructionsForConversation
  // ────────────────────────────────────────────────────────────────────
  describe("getPersonaInstructionsForConversation", () => {
    it("should return empty string when conversationId is empty", async () => {
      const result = await getPersonaInstructionsForConversation(TEST_USER_ID, "");

      expect(result).toBe("");
    });

    it("should return empty string when conversation not found", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      const result = await getPersonaInstructionsForConversation(TEST_USER_ID, TEST_CONVO_ID);

      expect(result).toBe("");
    });

    it("should return empty string when conversation has no persona_id", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { user_id: TEST_USER_ID, persona_id: null },
        error: null,
      });

      const result = await getPersonaInstructionsForConversation(TEST_USER_ID, TEST_CONVO_ID);

      expect(result).toBe("");
    });

    it("should return empty string when persona is not found", async () => {
      // First call: conversation lookup
      mockMaybeSingle.mockResolvedValueOnce({
        data: { user_id: TEST_USER_ID, persona_id: TEST_PERSONA_ID },
        error: null,
      });
      // Second call: persona lookup
      mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

      const result = await getPersonaInstructionsForConversation(TEST_USER_ID, TEST_CONVO_ID);

      expect(result).toBe("");
    });

    it("should return built prompt when persona exists", async () => {
      // First call: conversation lookup
      mockMaybeSingle.mockResolvedValueOnce({
        data: { user_id: TEST_USER_ID, persona_id: TEST_PERSONA_ID },
        error: null,
      });
      // Second call: persona lookup
      mockMaybeSingle.mockResolvedValueOnce({
        data: {
          ...mockPersonaRow,
          tone: "professional",
          use_emojis: false,
          use_headers_lists: true,
          user_context: "I work in finance",
          custom_instructions: "Always cite sources",
        },
        error: null,
      });

      const result = await getPersonaInstructionsForConversation(TEST_USER_ID, TEST_CONVO_ID);

      // Should contain tone and format instructions from buildPersonaSystemPrompt
      expect(result).toContain("[Tone]:");
      expect(result).toContain("[Format]:");
      expect(result).toContain("[User Context]: I work in finance");
      expect(result).toContain("[Custom Rules]: Always cite sources");
    });

    it("should return prompt with default tone (empty tone prompt)", async () => {
      mockMaybeSingle.mockResolvedValueOnce({
        data: { user_id: TEST_USER_ID, persona_id: TEST_PERSONA_ID },
        error: null,
      });
      mockMaybeSingle.mockResolvedValueOnce({
        data: {
          ...mockPersonaRow,
          tone: "default",
          use_emojis: true,
          use_headers_lists: true,
          user_context: "",
          custom_instructions: "",
        },
        error: null,
      });

      const result = await getPersonaInstructionsForConversation(TEST_USER_ID, TEST_CONVO_ID);

      // Default tone produces no [Tone] section, and with emojis/headers enabled
      // and no context/instructions, result should be empty
      expect(result).toBe("");
    });

    it("should throw ForbiddenError when conversation belongs to another user", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { user_id: "other-user@example.com", persona_id: TEST_PERSONA_ID },
        error: null,
      });

      await expect(
        getPersonaInstructionsForConversation(TEST_USER_ID, TEST_CONVO_ID)
      ).rejects.toThrow(ForbiddenError);
    });

    it("should throw DatabaseError on conversation lookup failure", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: null,
        error: { message: "Convo table error" },
      });

      await expect(
        getPersonaInstructionsForConversation(TEST_USER_ID, TEST_CONVO_ID)
      ).rejects.toThrow(DatabaseError);
    });

    it("should throw DatabaseError on persona lookup failure", async () => {
      mockMaybeSingle.mockResolvedValueOnce({
        data: { user_id: TEST_USER_ID, persona_id: TEST_PERSONA_ID },
        error: null,
      });
      mockMaybeSingle.mockResolvedValueOnce({
        data: null,
        error: { message: "Persona table error" },
      });

      await expect(
        getPersonaInstructionsForConversation(TEST_USER_ID, TEST_CONVO_ID)
      ).rejects.toThrow(DatabaseError);
    });
  });
});
