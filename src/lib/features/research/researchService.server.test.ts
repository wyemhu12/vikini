// researchService.server.test.ts
// Tests for Deep Research service functions.
//
// These tests use a stateful in-memory Supabase fake (see makeFakeSupabase below)
// instead of hand-ordered `mockReturnValueOnce` chains. Tests seed rows into a
// table store and assert on the resulting state, so adding or reordering a DB call
// inside the service no longer cascades into cryptic failures across unrelated tests.
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Stateful in-memory Supabase fake
// ---------------------------------------------------------------------------

interface Row {
  [key: string]: unknown;
}

/** A tiny query recorder so tests can assert which tables/ops were touched. */
interface OpLog {
  table: string;
  op: "insert" | "update" | "select" | "delete";
}

interface FakeDb {
  tables: Record<string, Row[]>;
  ops: OpLog[];
  /** When set for a table+op, the next matching operation returns this error. */
  failNext: Partial<Record<string, { message: string }>>;
  /** Monotonic id generator for inserted rows lacking an explicit id. */
  autoId: number;
}

function createFakeDb(seed: Record<string, Row[]> = {}): FakeDb {
  return {
    tables: structuredClone(seed),
    ops: [],
    failNext: {},
    autoId: 1,
  };
}

/**
 * Builds a chainable query builder that mimics the subset of the Supabase JS
 * API the research service uses: insert/update/select + eq/order/limit + single.
 *
 * The builder is resolved lazily: filters accumulate, and the terminal call
 * (`single()`, `limit()`, or awaiting the builder directly) materializes the
 * result against the in-memory table.
 */
function makeQueryBuilder(db: FakeDb, table: string) {
  let operation: "insert" | "update" | "select" = "select";
  let insertPayload: Row | null = null;
  let updatePayload: Row | null = null;
  const filters: Array<{ col: string; val: unknown }> = [];
  let orderCol: string | null = null;
  let orderAsc = true;
  let limitN: number | null = null;

  function ensureTable(): Row[] {
    if (!db.tables[table]) db.tables[table] = [];
    return db.tables[table];
  }

  function matches(row: Row): boolean {
    return filters.every((f) => row[f.col] === f.val);
  }

  function failKey(): { message: string } | undefined {
    const key = `${table}:${operation}`;
    const err = db.failNext[key];
    if (err) delete db.failNext[key];
    return err;
  }

  /** Materialize the query into { data, error }. `mode` shapes the return. */
  function run(mode: "single" | "many"): { data: unknown; error: { message: string } | null } {
    db.ops.push({ table, op: operation });
    const forcedErr = failKey();
    if (forcedErr) return { data: null, error: forcedErr };

    const rows = ensureTable();

    if (operation === "insert") {
      const toInsert: Row = { id: `auto-${db.autoId++}`, ...insertPayload };
      rows.push(toInsert);
      return { data: mode === "single" ? toInsert : [toInsert], error: null };
    }

    if (operation === "update") {
      const updated: Row[] = [];
      for (const row of rows) {
        if (matches(row)) {
          Object.assign(row, updatePayload);
          updated.push(row);
        }
      }
      const data = mode === "single" ? (updated[0] ?? null) : updated;
      return { data, error: null };
    }

    // select
    let result = rows.filter(matches);
    if (orderCol) {
      result = [...result].sort((a, b) => {
        const av = String(a[orderCol as string] ?? "");
        const bv = String(b[orderCol as string] ?? "");
        return orderAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    if (limitN != null) result = result.slice(0, limitN);
    if (mode === "single") {
      return { data: result[0] ?? null, error: null };
    }
    return { data: result, error: null };
  }

  const builder: Record<string, unknown> = {
    insert(payload: Row) {
      operation = "insert";
      insertPayload = payload;
      return builder;
    },
    update(payload: Row) {
      operation = "update";
      updatePayload = payload;
      return builder;
    },
    select() {
      // select() may follow insert/update (returning=representation) or stand alone
      if (operation !== "insert" && operation !== "update") operation = "select";
      return builder;
    },
    eq(col: string, val: unknown) {
      filters.push({ col, val });
      return builder;
    },
    order(col: string, opts?: { ascending?: boolean }) {
      orderCol = col;
      orderAsc = opts?.ascending ?? true;
      // order() is terminal-ish for lists but callers chain .limit() after,
      // so return a thenable-ish builder that resolves as many.
      return {
        limit(n: number) {
          limitN = n;
          return run("many");
        },
      };
    },
    single() {
      return run("single");
    },
    // Some update() calls don't chain .select()/.single(); awaiting resolves them.
    then(resolve: (v: unknown) => void) {
      resolve(run("many"));
    },
  };

  return builder;
}

function makeFakeSupabase(db: FakeDb) {
  return {
    from(table: string) {
      return makeQueryBuilder(db, table);
    },
  };
}

// ---------------------------------------------------------------------------
// Module mocks - declared BEFORE importing the service
// ---------------------------------------------------------------------------

// Holds the active fake DB; swapped per test in beforeEach.
let db: FakeDb;

vi.mock("@/lib/core/supabase.server", () => ({
  getSupabaseAdmin: vi.fn(() => makeFakeSupabase(db)),
}));

vi.mock("@/lib/core/genaiClient", () => ({
  createResearchInteraction: vi.fn(),
  getResearchInteraction: vi.fn(),
}));

vi.mock("@/lib/core/limits", () => ({
  tryClaimResearchSlot: vi.fn(),
}));

vi.mock("@/lib/core/encryption", () => ({
  encryptText: vi.fn((text: string) => `encrypted:${text}`),
}));

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
// Imports - AFTER mocks
// ---------------------------------------------------------------------------
import {
  createResearchTask,
  approveResearchPlan,
  checkResearchStatus,
  getResearchTasks,
  finalizeResearch,
  cancelResearchTask,
} from "./researchService.server";
import { tryClaimResearchSlot } from "@/lib/core/limits";
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

/** A valid DB row (snake_case, as stored in Supabase). */
function makeTaskRow(overrides: Record<string, unknown> = {}): Row {
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
    sources: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

/** Convenience: did any op touch this table with this operation? */
function didOp(table: string, op: OpLog["op"]): boolean {
  return db.ops.some((o) => o.table === table && o.op === op);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("researchService.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db = createFakeDb();
  });

  // ======================== createResearchTask ========================
  describe("createResearchTask", () => {
    it("should create a task (happy path)", async () => {
      vi.mocked(tryClaimResearchSlot).mockResolvedValue(true);
      vi.mocked(createResearchInteraction).mockResolvedValue({
        id: "interaction-1",
        status: "in_progress",
      });

      const result = await createResearchTask(USER_ID, {
        query: "Explain quantum computing",
      });

      expect(result.userId).toBe(USER_ID);
      expect(result.query).toBe("Explain quantum computing");
      expect(result.planInteractionId).toBe("interaction-1");
      expect(didOp("research_tasks", "insert")).toBe(true);
      // Row persisted in the store
      expect(db.tables["research_tasks"]).toHaveLength(1);
    });

    it("should save plan text immediately when interaction returns output", async () => {
      vi.mocked(tryClaimResearchSlot).mockResolvedValue(true);
      vi.mocked(createResearchInteraction).mockResolvedValue({
        id: "interaction-1",
        status: "completed",
        outputText: "Instant plan",
      });

      const result = await createResearchTask(USER_ID, { query: "quick topic" });

      expect(result.status).toBe("ready_to_execute");
      expect(result.planText).toBe("Instant plan");
    });

    it("should throw ValidationError when query is empty", async () => {
      vi.mocked(tryClaimResearchSlot).mockResolvedValue(true);
      await expect(createResearchTask(USER_ID, { query: "" })).rejects.toThrow(ValidationError);
      // Must not claim a slot for an invalid request
      expect(tryClaimResearchSlot).not.toHaveBeenCalled();
    });

    it("should throw ValidationError when query exceeds 2000 chars", async () => {
      vi.mocked(tryClaimResearchSlot).mockResolvedValue(true);
      const longQuery = "a".repeat(2001);
      await expect(createResearchTask(USER_ID, { query: longQuery })).rejects.toThrow(
        ValidationError
      );
    });

    it("should throw ForbiddenError when slot claim fails (limit/feature)", async () => {
      vi.mocked(tryClaimResearchSlot).mockResolvedValue(false);
      await expect(createResearchTask(USER_ID, { query: "test query" })).rejects.toThrow(
        ForbiddenError
      );
    });

    it("should throw DatabaseError when insert fails", async () => {
      vi.mocked(tryClaimResearchSlot).mockResolvedValue(true);
      db.failNext["research_tasks:insert"] = { message: "Insert failed" };

      await expect(createResearchTask(USER_ID, { query: "test query" })).rejects.toThrow(
        DatabaseError
      );
    });

    it("should mark task failed and throw ExternalServiceError when Gemini API fails", async () => {
      vi.mocked(tryClaimResearchSlot).mockResolvedValue(true);
      vi.mocked(createResearchInteraction).mockRejectedValue(new Error("Gemini API timeout"));

      await expect(createResearchTask(USER_ID, { query: "test query" })).rejects.toThrow(
        ExternalServiceError
      );
      // The inserted row should have been flipped to failed
      const row = db.tables["research_tasks"][0];
      expect(row.status).toBe("failed");
      expect(row.error_message).toBe("Gemini API timeout");
    });
  });

  // ======================== approveResearchPlan ========================
  describe("approveResearchPlan", () => {
    it("should approve a plan and start execution (happy path)", async () => {
      db.tables["research_tasks"] = [
        makeTaskRow({ status: "ready_to_execute", plan_interaction_id: "plan-1" }),
      ];
      vi.mocked(createResearchInteraction).mockResolvedValue({
        id: "exec-interaction-1",
        status: "in_progress",
      });

      const result = await approveResearchPlan(USER_ID, TASK_ID);

      expect(result.status).toBe("executing");
      expect(result.execInteractionId).toBe("exec-interaction-1");
    });

    it("should wrap feedback in delimiters (prompt-injection guard)", async () => {
      db.tables["research_tasks"] = [
        makeTaskRow({ status: "ready_to_execute", plan_interaction_id: "plan-1" }),
      ];
      vi.mocked(createResearchInteraction).mockResolvedValue({
        id: "exec-1",
        status: "in_progress",
      });

      await approveResearchPlan(USER_ID, TASK_ID, "focus on hardware");

      const call = vi.mocked(createResearchInteraction).mock.calls[0][0];
      expect(call.input).toContain("<user_feedback>");
      expect(call.input).toContain("focus on hardware");
      expect(call.previousInteractionId).toBe("plan-1");
    });

    it("should throw NotFoundError when task does not exist", async () => {
      db.tables["research_tasks"] = [];
      await expect(approveResearchPlan(USER_ID, "non-existent")).rejects.toThrow(NotFoundError);
    });

    it("should throw ForbiddenError when user does not own the task", async () => {
      db.tables["research_tasks"] = [
        makeTaskRow({ user_id: OTHER_USER_ID, status: "ready_to_execute" }),
      ];
      await expect(approveResearchPlan(USER_ID, TASK_ID)).rejects.toThrow(ForbiddenError);
    });

    it("should throw ValidationError when task status is not approvable", async () => {
      db.tables["research_tasks"] = [makeTaskRow({ status: "completed" })];
      await expect(approveResearchPlan(USER_ID, TASK_ID)).rejects.toThrow(ValidationError);
    });

    it("should mark failed and throw ExternalServiceError when execution fails", async () => {
      db.tables["research_tasks"] = [
        makeTaskRow({ status: "ready_to_execute", plan_interaction_id: "plan-1" }),
      ];
      vi.mocked(createResearchInteraction).mockRejectedValue(new Error("Execution API error"));

      await expect(approveResearchPlan(USER_ID, TASK_ID)).rejects.toThrow(ExternalServiceError);
      expect(db.tables["research_tasks"][0].status).toBe("failed");
    });
  });

  // ======================== checkResearchStatus ========================
  describe("checkResearchStatus", () => {
    it("should return current task state (in progress)", async () => {
      db.tables["research_tasks"] = [
        makeTaskRow({ status: "executing", exec_interaction_id: "exec-1" }),
      ];
      vi.mocked(getResearchInteraction).mockResolvedValue({
        id: "exec-1",
        status: "in_progress",
      });

      const result = await checkResearchStatus(USER_ID, TASK_ID);
      expect(result.status).toBe("executing");
    });

    it("should return completed task without polling", async () => {
      db.tables["research_tasks"] = [
        makeTaskRow({ status: "completed", report_text: "Final report" }),
      ];

      const result = await checkResearchStatus(USER_ID, TASK_ID);

      expect(result.status).toBe("completed");
      expect(getResearchInteraction).not.toHaveBeenCalled();
    });

    it("should transition to ready_to_execute when plan completes", async () => {
      db.tables["research_tasks"] = [
        makeTaskRow({ status: "planning", plan_interaction_id: "plan-1" }),
      ];
      vi.mocked(getResearchInteraction).mockResolvedValue({
        id: "plan-1",
        status: "completed",
        outputText: "Research plan: step 1, step 2",
      });

      const result = await checkResearchStatus(USER_ID, TASK_ID);

      expect(result.status).toBe("ready_to_execute");
      expect(result.planText).toBe("Research plan: step 1, step 2");
      // Persisted
      expect(db.tables["research_tasks"][0].status).toBe("ready_to_execute");
    });

    it("should finalize and complete when execution report is ready", async () => {
      db.tables["research_tasks"] = [
        makeTaskRow({ status: "executing", exec_interaction_id: "exec-1" }),
      ];
      vi.mocked(getResearchInteraction).mockResolvedValue({
        id: "exec-1",
        status: "completed",
        outputText: "The final report body.",
        reportSources: [{ url: "https://example.com", title: "Example" }],
      });

      const result = await checkResearchStatus(USER_ID, TASK_ID);

      expect(result.status).toBe("completed");
      expect(result.reportText).toContain("The final report body.");
      // BUG-06: sources are stored separately in the `sources` column, NOT appended
      // to report_text (no hardcoded Vietnamese header). The UI renders them with i18n.
      expect(result.reportText).not.toContain("example.com");
      expect(result.sources).toEqual([{ url: "https://example.com", title: "Example" }]);
      // finalizeResearch created a conversation + messages
      expect(didOp("conversations", "insert")).toBe(true);
      expect(didOp("messages", "insert")).toBe(true);
    });

    it("should set failed status when interaction fails", async () => {
      db.tables["research_tasks"] = [
        makeTaskRow({ status: "executing", exec_interaction_id: "exec-1" }),
      ];
      vi.mocked(getResearchInteraction).mockResolvedValue({
        id: "exec-1",
        status: "failed",
        error: "Gemini internal error",
      });

      const result = await checkResearchStatus(USER_ID, TASK_ID);

      expect(result.status).toBe("failed");
      expect(result.errorMessage).toBe("Gemini internal error");
      expect(db.tables["research_tasks"][0].status).toBe("failed");
    });

    it("should throw NotFoundError when task does not exist", async () => {
      db.tables["research_tasks"] = [];
      await expect(checkResearchStatus(USER_ID, "non-existent")).rejects.toThrow(NotFoundError);
    });

    it("should throw ForbiddenError when user does not own the task", async () => {
      db.tables["research_tasks"] = [makeTaskRow({ user_id: OTHER_USER_ID })];
      await expect(checkResearchStatus(USER_ID, TASK_ID)).rejects.toThrow(ForbiddenError);
    });

    it("should not throw on polling error, return current state", async () => {
      db.tables["research_tasks"] = [
        makeTaskRow({ status: "executing", exec_interaction_id: "exec-1" }),
      ];
      vi.mocked(getResearchInteraction).mockRejectedValue(new Error("Network error"));

      const result = await checkResearchStatus(USER_ID, TASK_ID);
      expect(result.status).toBe("executing");
    });
  });

  // ======================== cancelResearchTask ========================
  describe("cancelResearchTask", () => {
    it("should mark an in-progress task as failed with a cancel message", async () => {
      db.tables["research_tasks"] = [
        makeTaskRow({ status: "executing", exec_interaction_id: "exec-1" }),
      ];

      const result = await cancelResearchTask(USER_ID, TASK_ID);

      expect(result.status).toBe("failed");
      expect(result.errorMessage).toBe("Cancelled by user");
      expect(db.tables["research_tasks"][0].status).toBe("failed");
    });

    it("should be a no-op for already-terminal tasks", async () => {
      db.tables["research_tasks"] = [makeTaskRow({ status: "completed", report_text: "done" })];

      const result = await cancelResearchTask(USER_ID, TASK_ID);

      expect(result.status).toBe("completed");
      // No update op should have run
      expect(didOp("research_tasks", "update")).toBe(false);
    });

    it("should throw NotFoundError when task does not exist", async () => {
      db.tables["research_tasks"] = [];
      await expect(cancelResearchTask(USER_ID, "non-existent")).rejects.toThrow(NotFoundError);
    });

    it("should throw ForbiddenError when user does not own the task", async () => {
      db.tables["research_tasks"] = [makeTaskRow({ user_id: OTHER_USER_ID, status: "executing" })];
      await expect(cancelResearchTask(USER_ID, TASK_ID)).rejects.toThrow(ForbiddenError);
    });
  });

  // ======================== getResearchTasks ========================
  describe("getResearchTasks", () => {
    it("should return list of tasks for the user", async () => {
      db.tables["research_tasks"] = [
        makeTaskRow({ id: "task-1", status: "completed", created_at: "2026-01-02T00:00:00Z" }),
        makeTaskRow({ id: "task-2", status: "planning", created_at: "2026-01-01T00:00:00Z" }),
      ];

      const result = await getResearchTasks(USER_ID);

      expect(result).toHaveLength(2);
      // Ordered by created_at desc
      expect(result[0].id).toBe("task-1");
      expect(result[1].id).toBe("task-2");
    });

    it("should only return the requesting user's tasks", async () => {
      db.tables["research_tasks"] = [
        makeTaskRow({ id: "mine", user_id: USER_ID }),
        makeTaskRow({ id: "theirs", user_id: OTHER_USER_ID }),
      ];

      const result = await getResearchTasks(USER_ID);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("mine");
    });

    it("should return empty array when user has no tasks", async () => {
      db.tables["research_tasks"] = [];
      const result = await getResearchTasks(USER_ID);
      expect(result).toEqual([]);
    });

    it("should throw DatabaseError on query failure", async () => {
      db.failNext["research_tasks:select"] = { message: "Connection timeout" };
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

    it("should create a new conversation and save two messages", async () => {
      await finalizeResearch(baseTask, "Full research report");

      expect(didOp("conversations", "insert")).toBe(true);
      expect(db.tables["conversations"]).toHaveLength(1);
      // user + assistant messages
      expect(db.tables["messages"]).toHaveLength(2);
      const roles = db.tables["messages"].map((m) => m.role);
      expect(roles).toEqual(["user", "assistant"]);
    });

    it("should encrypt message content", async () => {
      await finalizeResearch(baseTask, "Full research report");
      const assistant = db.tables["messages"].find((m) => m.role === "assistant");
      expect(assistant?.content).toBe("encrypted:Full research report");
    });

    it("should use existing conversation when conversationId is set", async () => {
      const taskWithConv: ResearchTask = { ...baseTask, conversationId: "existing-conv-id" };

      await finalizeResearch(taskWithConv, "Report content");

      // No new conversation created
      expect(didOp("conversations", "insert")).toBe(false);
      expect(db.tables["messages"]).toHaveLength(2);
      expect(db.tables["messages"][0].conversation_id).toBe("existing-conv-id");
    });

    it("should silently return when conversation creation fails", async () => {
      db.failNext["conversations:insert"] = { message: "DB insert failed" };
      await expect(finalizeResearch(baseTask, "Report content")).resolves.toBeUndefined();
      // No messages written
      expect(db.tables["messages"] ?? []).toHaveLength(0);
    });

    it("should add to project KB when projectId is set", async () => {
      const taskWithProject: ResearchTask = { ...baseTask, projectId: "project-xyz" };

      await finalizeResearch(taskWithProject, "Report for project");

      expect(didOp("knowledge_documents", "insert")).toBe(true);
      expect(db.tables["knowledge_documents"]).toHaveLength(1);
      expect(db.tables["knowledge_documents"][0].project_id).toBe("project-xyz");
    });
  });
});
