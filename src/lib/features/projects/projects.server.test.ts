import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks for typed supabase admin
const { mockSupabaseFrom } = vi.hoisted(() => ({
  mockSupabaseFrom: vi.fn(),
}));

vi.mock("@/lib/core/supabase.server", () => ({
  getTypedSupabaseAdmin: vi.fn(() => ({
    from: mockSupabaseFrom,
  })),
}));

import {
  toProject,
  getUserTier,
  getTierLimits,
  getUserProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  canAddStorageToProject,
} from "./projects.server";
import { PROJECT_LIMITS } from "@/types/projects";
import type { Tables } from "@/types/database.types";

describe("projects.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("toProject Mapper", () => {
    it("should normalize DB row into Project domain model with immutable gemini-embedding-2", () => {
      const mockRow: Tables<"projects"> = {
        id: "prj-123",
        user_id: "user-456",
        name: "Test Project",
        description: "A test project",
        icon: null,
        color: null,
        embedding_model: null, // Even if DB returns null or other string
        created_at: null,
        updated_at: null,
      };

      const project = toProject(mockRow);

      expect(project).toEqual({
        id: "prj-123",
        user_id: "user-456",
        name: "Test Project",
        description: "A test project",
        icon: "📁",
        color: "#6366f1",
        embedding_model: "gemini-embedding-2",
        created_at: "",
        updated_at: "",
      });
    });

    it("should preserve provided icon, color, and timestamps", () => {
      const mockRow: Tables<"projects"> = {
        id: "prj-123",
        user_id: "user-456",
        name: "Custom Project",
        description: null,
        icon: "🚀",
        color: "#ff0000",
        embedding_model: "gemini-embedding-2",
        created_at: "2026-09-28T00:00:00Z",
        updated_at: "2026-09-28T12:00:00Z",
      };

      const project = toProject(mockRow);

      expect(project.icon).toBe("🚀");
      expect(project.color).toBe("#ff0000");
      expect(project.created_at).toBe("2026-09-28T00:00:00Z");
      expect(project.updated_at).toBe("2026-09-28T12:00:00Z");
      expect(project.embedding_model).toBe("gemini-embedding-2");
    });
  });

  describe("getUserTier & getTierLimits", () => {
    it("should detect admin, pro, and basic tiers correctly", async () => {
      const singleMock = vi.fn();
      const eqMock = vi.fn().mockReturnValue({ single: singleMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
      mockSupabaseFrom.mockReturnValue({ select: selectMock });

      singleMock.mockResolvedValueOnce({ data: { rank: "admin" } });
      expect(await getUserTier("admin@test.com")).toBe("admin");

      singleMock.mockResolvedValueOnce({ data: { rank: "PRO" } });
      expect(await getUserTier("pro@test.com")).toBe("pro");

      singleMock.mockResolvedValueOnce({ data: { rank: "free" } });
      expect(await getUserTier("free@test.com")).toBe("basic");

      singleMock.mockResolvedValueOnce({ data: null });
      expect(await getUserTier("none@test.com")).toBe("basic");
    });

    it("should return correct limits for tier", () => {
      expect(getTierLimits("basic")).toEqual(PROJECT_LIMITS.basic);
      expect(getTierLimits("pro")).toEqual(PROJECT_LIMITS.pro);
      expect(getTierLimits("admin")).toEqual(PROJECT_LIMITS.admin);
    });
  });

  describe("getUserProjects & getProject", () => {
    it("should fetch user projects with stats and map through toProject", async () => {
      const mockProjects: Tables<"projects">[] = [
        {
          id: "p1",
          user_id: "u1",
          name: "Project 1",
          description: null,
          icon: null,
          color: null,
          embedding_model: "gemini-embedding-2",
          created_at: "2026-01-01",
          updated_at: "2026-01-02",
        },
      ];

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "projects") {
          const orderMock = vi.fn().mockResolvedValue({ data: mockProjects, error: null });
          const eqMock = vi.fn().mockReturnValue({ order: orderMock });
          return { select: vi.fn().mockReturnValue({ eq: eqMock }) };
        }
        if (table === "conversations") {
          const eqMock = vi.fn().mockResolvedValue({ count: 3, error: null });
          return { select: vi.fn().mockReturnValue({ eq: eqMock }) };
        }
        if (table === "knowledge_documents") {
          const eqMock = vi.fn().mockResolvedValue({
            data: [{ size_bytes: 100 }, { size_bytes: 200 }],
            error: null,
          });
          return { select: vi.fn().mockReturnValue({ eq: eqMock }) };
        }
        return {};
      });

      const result = await getUserProjects("u1");

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        ...toProject(mockProjects[0]),
        conversation_count: 3,
        document_count: 2,
        storage_bytes: 300,
      });
    });

    it("should get a single project by id and return ProjectWithStats", async () => {
      const mockProject: Tables<"projects"> = {
        id: "p1",
        user_id: "u1",
        name: "Project 1",
        description: "Desc",
        icon: "🌟",
        color: "#123456",
        embedding_model: "gemini-embedding-2",
        created_at: "2026-01-01",
        updated_at: "2026-01-02",
      };

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "projects") {
          const singleMock = vi.fn().mockResolvedValue({ data: mockProject, error: null });
          const eqUserMock = vi.fn().mockReturnValue({ single: singleMock });
          const eqIdMock = vi.fn().mockReturnValue({ eq: eqUserMock });
          return { select: vi.fn().mockReturnValue({ eq: eqIdMock }) };
        }
        if (table === "conversations") {
          const eqMock = vi.fn().mockResolvedValue({ count: 5, error: null });
          return { select: vi.fn().mockReturnValue({ eq: eqMock }) };
        }
        if (table === "knowledge_documents") {
          const eqMock = vi.fn().mockResolvedValue({
            data: [{ size_bytes: 500 }],
            error: null,
          });
          return { select: vi.fn().mockReturnValue({ eq: eqMock }) };
        }
        return {};
      });

      const result = await getProject("p1", "u1");

      expect(result).toEqual({
        ...toProject(mockProject),
        conversation_count: 5,
        document_count: 1,
        storage_bytes: 500,
      });
    });

    it("should return null if project not found", async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "projects") {
          const singleMock = vi
            .fn()
            .mockResolvedValue({ data: null, error: new Error("Not found") });
          const eqUserMock = vi.fn().mockReturnValue({ single: singleMock });
          const eqIdMock = vi.fn().mockReturnValue({ eq: eqUserMock });
          return { select: vi.fn().mockReturnValue({ eq: eqIdMock }) };
        }
        return {};
      });

      const result = await getProject("not-exist", "u1");
      expect(result).toBeNull();
    });
  });

  describe("createProject (TC-EMB-04)", () => {
    it("should insert project with immutable embedding_model: 'gemini-embedding-2'", async () => {
      const mockCreatedRow: Tables<"projects"> = {
        id: "p-new",
        user_id: "u1",
        name: "New AI Project",
        description: "Description",
        icon: "📁",
        color: "#6366f1",
        embedding_model: "gemini-embedding-2",
        created_at: "2026-09-28T12:00:00Z",
        updated_at: "2026-09-28T12:00:00Z",
      };

      const singleMock = vi.fn().mockResolvedValue({ data: mockCreatedRow, error: null });
      const selectMock = vi.fn().mockReturnValue({ single: singleMock });
      const insertMock = vi.fn().mockReturnValue({ select: selectMock });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { rank: "basic" } }),
              }),
            }),
          };
        }
        if (table === "projects") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
            }),
            insert: insertMock,
          };
        }
        return {};
      });

      const project = await createProject("u1", {
        name: "  New AI Project  ",
        description: "  Description  ",
      });

      expect(insertMock).toHaveBeenCalledWith({
        user_id: "u1",
        name: "New AI Project",
        description: "Description",
        icon: "📁",
        color: "#6366f1",
        embedding_model: "gemini-embedding-2",
      });

      expect(project.embedding_model).toBe("gemini-embedding-2");
      expect(project.name).toBe("New AI Project");
    });

    it("should reject project creation if limit reached", async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { rank: "basic" } }),
              }),
            }),
          };
        }
        if (table === "projects") {
          // basic allows max 5
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 5, error: null }),
            }),
          };
        }
        return {};
      });

      await expect(createProject("u1", { name: "Excess Project" })).rejects.toThrow(
        "Project limit reached"
      );
    });

    it("should handle duplicate project name error 23505", async () => {
      const singleMock = vi.fn().mockResolvedValue({
        data: null,
        error: { code: "23505", message: "duplicate key" },
      });
      const selectMock = vi.fn().mockReturnValue({ single: singleMock });
      const insertMock = vi.fn().mockReturnValue({ select: selectMock });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { rank: "admin" } }),
              }),
            }),
          };
        }
        if (table === "projects") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
            }),
            insert: insertMock,
          };
        }
        return {};
      });

      await expect(createProject("u1", { name: "Duplicate Name" })).rejects.toThrow(
        "A project with this name already exists"
      );
    });
  });

  describe("updateProject", () => {
    it("should update project fields WITHOUT embedding_model in the payload", async () => {
      const mockUpdatedRow: Tables<"projects"> = {
        id: "p1",
        user_id: "u1",
        name: "Updated Project",
        description: "New description",
        icon: "⚡",
        color: "#10b981",
        embedding_model: "gemini-embedding-2",
        created_at: "2026-01-01",
        updated_at: "2026-09-28T12:00:00Z",
      };

      const singleMock = vi.fn().mockResolvedValue({ data: mockUpdatedRow, error: null });
      const selectMock = vi.fn().mockReturnValue({ single: singleMock });
      const eqUserMock = vi.fn().mockReturnValue({ select: selectMock });
      const eqIdMock = vi.fn().mockReturnValue({ eq: eqUserMock });
      const updateMock = vi.fn().mockReturnValue({ eq: eqIdMock });
      mockSupabaseFrom.mockReturnValue({ update: updateMock });

      const result = await updateProject("p1", "u1", {
        name: "  Updated Project  ",
        description: "  New description  ",
        icon: "⚡",
        color: "#10b981",
      });

      // Assert payload passed to update
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Updated Project",
          description: "New description",
          icon: "⚡",
          color: "#10b981",
          updated_at: expect.any(String),
        })
      );

      // Verify embedding_model was NOT included in updates payload
      const payload = updateMock.mock.calls[0][0];
      expect(payload).not.toHaveProperty("embedding_model");

      expect(result.name).toBe("Updated Project");
      expect(result.embedding_model).toBe("gemini-embedding-2");
    });
  });

  describe("deleteProject", () => {
    it("should unlink conversations and delete project", async () => {
      const convEqMock = vi.fn().mockResolvedValue({ error: null });
      const convUpdateMock = vi.fn().mockReturnValue({ eq: convEqMock });

      const prjEqUserMock = vi.fn().mockResolvedValue({ error: null });
      const prjEqIdMock = vi.fn().mockReturnValue({ eq: prjEqUserMock });
      const prjDeleteMock = vi.fn().mockReturnValue({ eq: prjEqIdMock });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "conversations") {
          return { update: convUpdateMock };
        }
        if (table === "projects") {
          return { delete: prjDeleteMock };
        }
        return {};
      });

      await deleteProject("prj-del", "user-del");

      // Verify conversation unlinked
      expect(convUpdateMock).toHaveBeenCalledWith({ project_id: null });
      expect(convEqMock).toHaveBeenCalledWith("project_id", "prj-del");

      // Verify project deleted
      expect(prjDeleteMock).toHaveBeenCalled();
      expect(prjEqIdMock).toHaveBeenCalledWith("id", "prj-del");
      expect(prjEqUserMock).toHaveBeenCalledWith("user_id", "user-del");
    });
  });

  describe("canAddStorageToProject", () => {
    it("should calculate remaining storage accurately against tier limit", async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { rank: "basic" } }),
              }),
            }),
          };
        }
        if (table === "knowledge_documents") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ size_bytes: 1 * 1024 * 1024 }], // 1MB used
                error: null,
              }),
            }),
          };
        }
        return {};
      });

      // Basic tier limit is 5MB
      const checkAllowed = await canAddStorageToProject("p1", "u1", 3 * 1024 * 1024); // +3MB = 4MB <= 5MB
      expect(checkAllowed.allowed).toBe(true);
      expect(checkAllowed.currentBytes).toBe(1 * 1024 * 1024);

      const checkExceeded = await canAddStorageToProject("p1", "u1", 5 * 1024 * 1024); // +5MB = 6MB > 5MB
      expect(checkExceeded.allowed).toBe(false);
    });
  });
});
