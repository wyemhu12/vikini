// researchService.server.test.ts
// Tests for Deep Research service functions
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — declared BEFORE importing the service
// ---------------------------------------------------------------------------

// -- Supabase mock (chainable builder pattern) --
const mockSingle = vi.fn();
const mockLimit = vi.fn();
const mockOrder = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn();

function _resetChain() {
  // Default chaining: every method returns an object with the next link
  mockSingle.mockReturnValue({ data: null, error: null });
  mockLimit.mockReturnValue({ data: [], error: null });
  mockOrder.mockReturnValue({ limit: mockLimit });
  mockSelect.mockReturnValue({ order: mockOrder, eq: mockEq, single: mockSingle });
  mockEq.mockReturnValue({ select: mockSelect, single: mockSingle, data: null, error: null });
  mockInsert.mockReturnValue({ select: mockSelect });
  mockUpdate.mockReturnValue({ eq: mockEq });
  mockFrom.mockImplementation(() => ({
    insert: mockInsert,
    update: mockUpdate,
    select: (...args: unknown[]) => {
      mockSelect(...args);
      return { eq: mockEq, order: mockOrder, single: mockSingle };
    },
  }));
}

vi.mock("@/lib/core/supabase.server", () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: (...args: unknown[]) => {
      mockFrom(...args);
      return {
        insert: (...iArgs: unknown[]) => {
          mockInsert(...iArgs);
          return {
            select: (...sArgs: unknown[]) => {
              mockSelect(...sArgs);
              return {
                single: (...snArgs: unknown[]) => {
                  mockSingle(...snArgs);
                  return mockSingle.mock.results[mockSingle.mock.results.length - 1]?.value;
                },
              };
            },
          };
        },
        update: (...uArgs: unknown[]) => {
          mockUpdate(...uArgs);
          return {
            eq: (...eArgs: unknown[]) => {
              mockEq(...eArgs);
              return {
                select: (...sArgs: unknown[]) => {
                  mockSelect(...sArgs);
                  return {
                    single: (...snArgs: unknown[]) => {
                      mockSingle(...snArgs);
                      return mockSingle.mock.results[mockSingle.mock.results.length - 1]?.value;
                    },
                  };
                },
                // for updates that don't chain .select()
                ...mockEq.mock.results[mockEq.mock.results.length - 1]?.value,
              };
            },
          };
        },
        select: (...sArgs: unknown[]) => {
          mockSelect(...sArgs);
          return {
            eq: (...eArgs: unknown[]) => {
              mockEq(...eArgs);
              return {
                single: (...snArgs: unknown[]) => {
                  mockSingle(...snArgs);
                  return mockSingle.mock.results[mockSingle.mock.results.length - 1]?.value;
                },
                order: (...oArgs: unknown[]) => {
                  mockOrder(...oArgs);
                  return {
                    limit: (...lArgs: unknown[]) => {
                      mockLimit(...lArgs);
                      return mockLimit.mock.results[mockLimit.mock.results.length - 1]?.value;
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  })),
}));

// -- genaiClient mock --
vi.mock("@/lib/core/genaiClient", () => ({
  createResearchInteraction: vi.fn(),
  getResearchInteraction: vi.fn(),
}));

// -- limits mock --
vi.mock("@/lib/core/limits", () => ({
  canDoResearch: vi.fn(),
  incrementResearchCount: vi.fn().mockResolvedValue(undefined),
}));

// -- encryption mock --
vi.mock("@/lib/core/encryption", () => ({
  encryptText: vi.fn((text: string) => `encrypted:${text}`),
}));

// -- logger mock --
vi.mock("@/lib/utils/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports — AFTER mocks
// ---------------------------------------------------------------------------
import {
  createResearchTask,
  approveResearchPlan,
  checkResearchStatus,
  getResearchTasks,
  finalizeResearch,
} from "./researchService.server";
import { canDoResearch } from "@/lib/core/limits";
import { createResearchInteraction, getResearchInteraction } from "@/lib/core/genaiClient";
import {
  ForbiddenError,
  ValidationError,
  NotFoundError,
  DatabaseError,
  ExternalServiceError,
} from "@/lib/utils/errors";
import type { ResearchTask } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USER_ID = "user-123";
const OTHER_USER_ID = "user-other";
const TASK_ID = "task-abc";

/** A valid DB row returned from Supabase */
function makeTaskRow(overrides: Record<string, unknown> = {}) {
  return {
    id: TASK_ID,
    user_id: USER_ID,
    query: "Explain quantum computing",
    agent_model: "deep-research-preview-04-2026",
    plan_text: null,
    report_text: null,
    status: "planning",
    plan_interaction_id: null,
    exec_interaction_id: null,
    conversation_id: null,
    project_id: null,
    gem_id: null,
    error_message: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("researchService.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ======================== createResearchTask ========================
  describe("createResearchTask", () => {
    it("should create a task (happy path)", async () => {
      vi.mocked(canDoResearch).mockResolvedValue(true);

      const row = makeTaskRow();
      // insert -> select -> single (returns created row)
      mockSingle.mockReturnValueOnce({ data: row, error: null });
      // createResearchInteraction
      vi.mocked(createResearchInteraction).mockResolvedValue({
        id: "interaction-1",
        status: "in_progress",
      });
      // update -> eq (no .select chain, returns void-ish)
      mockEq.mockReturnValueOnce({ error: null });
      // refetch -> select -> eq -> single
      const updatedRow = makeTaskRow({ plan_interaction_id: "interaction-1" });
      mockSingle.mockReturnValueOnce({ data: updatedRow, error: null });

      const result = await createResearchTask(USER_ID, {
        query: "Explain quantum computing",
      });

      expect(result.id).toBe(TASK_ID);
      expect(result.userId).toBe(USER_ID);
      expect(result.query).toBe("Explain quantum computing");
      expect(mockFrom).toHaveBeenCalledWith("research_tasks");
    });

    it("should throw ValidationError when query is empty", async () => {
      vi.mocked(canDoResearch).mockResolvedValue(true);

      await expect(createResearchTask(USER_ID, { query: "" })).rejects.toThrow(ValidationError);
    });

    it("should throw ValidationError when query exceeds 2000 chars", async () => {
      vi.mocked(canDoResearch).mockResolvedValue(true);

      const longQuery = "a".repeat(2001);
      await expect(createResearchTask(USER_ID, { query: longQuery })).rejects.toThrow(
        ValidationError
      );
    });

    it("should throw ForbiddenError when user is not allowed", async () => {
      vi.mocked(canDoResearch).mockResolvedValue(false);

      await expect(createResearchTask(USER_ID, { query: "test query" })).rejects.toThrow(
        ForbiddenError
      );
    });

    it("should throw DatabaseError when insert fails", async () => {
      vi.mocked(canDoResearch).mockResolvedValue(true);
      mockSingle.mockReturnValueOnce({
        data: null,
        error: { message: "Insert failed" },
      });

      await expect(createResearchTask(USER_ID, { query: "test query" })).rejects.toThrow(
        DatabaseError
      );
    });

    it("should throw ExternalServiceError when Gemini API fails", async () => {
      vi.mocked(canDoResearch).mockResolvedValue(true);
      const row = makeTaskRow();
      mockSingle.mockReturnValueOnce({ data: row, error: null });
      vi.mocked(createResearchInteraction).mockRejectedValue(new Error("Gemini API timeout"));
      // Mark task as failed update
      mockEq.mockReturnValueOnce({ error: null });

      await expect(createResearchTask(USER_ID, { query: "test query" })).rejects.toThrow(
        ExternalServiceError
      );
    });
  });

  // ======================== approveResearchPlan ========================
  describe("approveResearchPlan", () => {
    it("should approve a plan and start execution (happy path)", async () => {
      const row = makeTaskRow({ status: "ready_to_execute", plan_interaction_id: "plan-1" });
      // fetch task -> select -> eq -> single
      mockSingle.mockReturnValueOnce({ data: row, error: null });
      // createResearchInteraction for execution
      vi.mocked(createResearchInteraction).mockResolvedValue({
        id: "exec-interaction-1",
        status: "in_progress",
      });
      // update -> eq -> select -> single
      const updatedRow = makeTaskRow({
        status: "executing",
        exec_interaction_id: "exec-interaction-1",
        plan_interaction_id: "plan-1",
      });
      mockSingle.mockReturnValueOnce({ data: updatedRow, error: null });

      const result = await approveResearchPlan(USER_ID, TASK_ID);

      expect(result.status).toBe("executing");
      expect(result.execInteractionId).toBe("exec-interaction-1");
    });

    it("should throw NotFoundError when task does not exist", async () => {
      mockSingle.mockReturnValueOnce({
        data: null,
        error: { message: "Not found" },
      });

      await expect(approveResearchPlan(USER_ID, "non-existent")).rejects.toThrow(NotFoundError);
    });

    it("should throw ForbiddenError when user does not own the task", async () => {
      const row = makeTaskRow({ user_id: OTHER_USER_ID, status: "ready_to_execute" });
      mockSingle.mockReturnValueOnce({ data: row, error: null });

      await expect(approveResearchPlan(USER_ID, TASK_ID)).rejects.toThrow(ForbiddenError);
    });

    it("should throw ValidationError when task status is not approvable", async () => {
      const row = makeTaskRow({ status: "completed" });
      mockSingle.mockReturnValueOnce({ data: row, error: null });

      await expect(approveResearchPlan(USER_ID, TASK_ID)).rejects.toThrow(ValidationError);
    });

    it("should throw ExternalServiceError when Gemini execution fails", async () => {
      const row = makeTaskRow({ status: "ready_to_execute", plan_interaction_id: "plan-1" });
      mockSingle.mockReturnValueOnce({ data: row, error: null });
      vi.mocked(createResearchInteraction).mockRejectedValue(new Error("Execution API error"));
      // Mark task as failed
      mockEq.mockReturnValueOnce({ error: null });

      await expect(approveResearchPlan(USER_ID, TASK_ID)).rejects.toThrow(ExternalServiceError);
    });
  });

  // ======================== checkResearchStatus ========================
  describe("checkResearchStatus", () => {
    it("should return current task state (happy path — in progress)", async () => {
      const row = makeTaskRow({
        status: "executing",
        exec_interaction_id: "exec-1",
      });
      mockSingle.mockReturnValueOnce({ data: row, error: null });
      vi.mocked(getResearchInteraction).mockResolvedValue({
        id: "exec-1",
        status: "in_progress",
      });

      const result = await checkResearchStatus(USER_ID, TASK_ID);

      expect(result.id).toBe(TASK_ID);
      expect(result.status).toBe("executing");
    });

    it("should return completed task without polling", async () => {
      const row = makeTaskRow({ status: "completed", report_text: "Final report" });
      mockSingle.mockReturnValueOnce({ data: row, error: null });

      const result = await checkResearchStatus(USER_ID, TASK_ID);

      expect(result.status).toBe("completed");
      expect(getResearchInteraction).not.toHaveBeenCalled();
    });

    it("should update status to ready_to_execute when plan completes", async () => {
      const row = makeTaskRow({
        status: "planning",
        plan_interaction_id: "plan-1",
      });
      mockSingle.mockReturnValueOnce({ data: row, error: null });
      vi.mocked(getResearchInteraction).mockResolvedValue({
        id: "plan-1",
        status: "completed",
        outputText: "Research plan: step 1, step 2",
      });
      const updatedRow = makeTaskRow({
        status: "ready_to_execute",
        plan_text: "Research plan: step 1, step 2",
        plan_interaction_id: "plan-1",
      });
      mockSingle.mockReturnValueOnce({ data: updatedRow, error: null });

      const result = await checkResearchStatus(USER_ID, TASK_ID);

      expect(result.status).toBe("ready_to_execute");
      expect(result.planText).toBe("Research plan: step 1, step 2");
    });

    it("should return failed status when interaction fails", async () => {
      const row = makeTaskRow({
        status: "executing",
        exec_interaction_id: "exec-1",
      });
      mockSingle.mockReturnValueOnce({ data: row, error: null });
      vi.mocked(getResearchInteraction).mockResolvedValue({
        id: "exec-1",
        status: "failed",
        error: "Gemini internal error",
      });
      // update to failed
      mockEq.mockReturnValueOnce({ error: null });

      const result = await checkResearchStatus(USER_ID, TASK_ID);

      expect(result.status).toBe("failed");
      expect(result.errorMessage).toBe("Gemini internal error");
    });

    it("should throw NotFoundError when task does not exist", async () => {
      mockSingle.mockReturnValueOnce({
        data: null,
        error: { message: "Not found" },
      });

      await expect(checkResearchStatus(USER_ID, "non-existent")).rejects.toThrow(NotFoundError);
    });

    it("should throw ForbiddenError when user does not own the task", async () => {
      const row = makeTaskRow({ user_id: OTHER_USER_ID });
      mockSingle.mockReturnValueOnce({ data: row, error: null });

      await expect(checkResearchStatus(USER_ID, TASK_ID)).rejects.toThrow(ForbiddenError);
    });

    it("should not fail on polling error, return current state", async () => {
      const row = makeTaskRow({
        status: "executing",
        exec_interaction_id: "exec-1",
      });
      mockSingle.mockReturnValueOnce({ data: row, error: null });
      vi.mocked(getResearchInteraction).mockRejectedValue(new Error("Network error"));

      const result = await checkResearchStatus(USER_ID, TASK_ID);

      // Should return current state, not throw
      expect(result.status).toBe("executing");
    });
  });

  // ======================== getResearchTasks ========================
  describe("getResearchTasks", () => {
    it("should return list of tasks", async () => {
      const rows = [
        makeTaskRow({ id: "task-1", status: "completed" }),
        makeTaskRow({ id: "task-2", status: "planning" }),
      ];
      mockLimit.mockReturnValueOnce({ data: rows, error: null });

      const result = await getResearchTasks(USER_ID);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("task-1");
      expect(result[1].id).toBe("task-2");
    });

    it("should return empty array when user has no tasks", async () => {
      mockLimit.mockReturnValueOnce({ data: [], error: null });

      const result = await getResearchTasks(USER_ID);

      expect(result).toEqual([]);
    });

    it("should throw DatabaseError on query failure", async () => {
      mockLimit.mockReturnValueOnce({
        data: null,
        error: { message: "Connection timeout" },
      });

      await expect(getResearchTasks(USER_ID)).rejects.toThrow(DatabaseError);
    });
  });

  // ======================== finalizeResearch ========================
  describe("finalizeResearch", () => {
    const baseTask: ResearchTask = {
      id: TASK_ID,
      userId: USER_ID,
      query: "Explain quantum computing",
      agentModel: "deep-research-preview-04-2026",
      planText: "Plan text",
      reportText: "Report text",
      status: "completed",
      planInteractionId: "plan-1",
      execInteractionId: "exec-1",
      conversationId: null,
      projectId: null,
      gemId: null,
      errorMessage: null,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };

    it("should create new conversation and save messages (happy path)", async () => {
      // Create conversation -> insert -> select -> single
      mockSingle.mockReturnValueOnce({
        data: { id: "conv-new" },
        error: null,
      });
      // Update task with conversation_id
      mockEq.mockReturnValueOnce({ error: null });
      // Insert user message
      mockInsert.mockReturnValueOnce({ error: null });
      // Insert assistant message
      mockInsert.mockReturnValueOnce({ error: null });
      // Update conversation preview
      mockEq.mockReturnValueOnce({ error: null });

      await finalizeResearch(baseTask, "Full research report");

      // Should have called from("conversations") for insert
      expect(mockFrom).toHaveBeenCalledWith("conversations");
      // Should have called from("messages") for message inserts
      expect(mockFrom).toHaveBeenCalledWith("messages");
    });

    it("should use existing conversation when conversationId is set", async () => {
      const taskWithConv: ResearchTask = {
        ...baseTask,
        conversationId: "existing-conv-id",
      };

      // Insert user message
      mockInsert.mockReturnValueOnce({ error: null });
      // Insert assistant message
      mockInsert.mockReturnValueOnce({ error: null });
      // Update conversation preview
      mockEq.mockReturnValueOnce({ error: null });

      await finalizeResearch(taskWithConv, "Report content");

      // Should NOT have inserted a new conversation
      // The first from() call should be for messages, not conversations insert
      expect(mockFrom).toHaveBeenCalledWith("messages");
    });

    it("should silently return when conversation creation fails", async () => {
      // Create conversation fails
      mockSingle.mockReturnValueOnce({
        data: null,
        error: { message: "DB insert failed" },
      });

      // Should not throw
      await expect(finalizeResearch(baseTask, "Report content")).resolves.toBeUndefined();
    });

    it("should add to project KB when projectId is set", async () => {
      const taskWithProject: ResearchTask = {
        ...baseTask,
        projectId: "project-xyz",
      };

      // Create conversation
      mockSingle.mockReturnValueOnce({
        data: { id: "conv-new" },
        error: null,
      });
      // Update task with conversation_id
      mockEq.mockReturnValueOnce({ error: null });
      // Insert user message
      mockInsert.mockReturnValueOnce({ error: null });
      // Insert assistant message
      mockInsert.mockReturnValueOnce({ error: null });
      // Update conversation preview
      mockEq.mockReturnValueOnce({ error: null });
      // Insert knowledge document
      mockInsert.mockReturnValueOnce({ error: null });

      await finalizeResearch(taskWithProject, "Report for project");

      expect(mockFrom).toHaveBeenCalledWith("knowledge_documents");
    });
  });
});
