import { describe, it, expect, vi, beforeEach } from "vitest";
import { removeOwnedStoragePaths } from "./storageCleanup";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("storageCleanup - removeOwnedStoragePaths", () => {
  let removeMock: ReturnType<typeof vi.fn>;
  let mockSupabase: unknown;

  beforeEach(() => {
    removeMock = vi.fn().mockResolvedValue({ data: [], error: null });
    mockSupabase = {
      storage: {
        from: vi.fn().mockReturnValue({
          remove: removeMock,
        }),
      },
    };
  });

  it("removes valid paths starting with userId prefix", async () => {
    const userId = "user-123";
    const paths = ["user-123/conv-1/image1.png", "user-123/conv-1/image2.png"];

    await removeOwnedStoragePaths(mockSupabase as SupabaseClient, userId, paths);

    expect(removeMock).toHaveBeenCalledTimes(1);
    expect(removeMock).toHaveBeenCalledWith([
      "user-123/conv-1/image1.png",
      "user-123/conv-1/image2.png",
    ]);
  });

  it("ignores paths belonging to other users", async () => {
    const userId = "user-123";
    const paths = ["other-user/conv-1/secret.png", "user-123/my-file.png"];

    await removeOwnedStoragePaths(mockSupabase as SupabaseClient, userId, paths);

    expect(removeMock).toHaveBeenCalledTimes(1);
    expect(removeMock).toHaveBeenCalledWith(["user-123/my-file.png"]);
  });

  it("rejects paths containing path traversal (..)", async () => {
    const userId = "user-123";
    const paths = [
      "user-123/../other-user/file.png",
      "user-123/normal.png",
      "../user-123/traversal.png",
    ];

    await removeOwnedStoragePaths(mockSupabase as SupabaseClient, userId, paths);

    expect(removeMock).toHaveBeenCalledTimes(1);
    expect(removeMock).toHaveBeenCalledWith(["user-123/normal.png"]);
  });

  it("does not call remove if no paths match the userId prefix", async () => {
    const userId = "user-123";
    const paths = ["attacker/file.png", null, undefined, ""];

    await removeOwnedStoragePaths(mockSupabase as SupabaseClient, userId, paths);

    expect(removeMock).not.toHaveBeenCalled();
  });
});
