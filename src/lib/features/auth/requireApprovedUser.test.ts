import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireApprovedUser } from "./requireApprovedUser";
import { getUserId } from "./getUserId";
import { getUserProfileStrict } from "@/lib/core/limits";
import {
  AccessPendingError,
  ServiceUnavailableError,
  UnauthorizedError,
  UserBlockedError,
} from "@/lib/utils/errors";

vi.mock("./getUserId", () => ({ getUserId: vi.fn() }));
vi.mock("@/lib/core/limits", () => ({ getUserProfileStrict: vi.fn() }));

const profile = (rank: string, is_blocked = false) => ({
  id: "a@b.com",
  email: "a@b.com",
  rank,
  is_blocked,
});

describe("requireApprovedUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserId).mockResolvedValue("a@b.com");
  });

  it("propagates 401 when there is no session", async () => {
    vi.mocked(getUserId).mockRejectedValue(new UnauthorizedError());
    await expect(requireApprovedUser()).rejects.toBeInstanceOf(UnauthorizedError);
    expect(getUserProfileStrict).not.toHaveBeenCalled();
  });

  it("propagates 503 when the profile cannot be read", async () => {
    vi.mocked(getUserProfileStrict).mockRejectedValue(new ServiceUnavailableError());
    await expect(requireApprovedUser()).rejects.toBeInstanceOf(ServiceUnavailableError);
  });

  it("denies a missing profile as pending", async () => {
    vi.mocked(getUserProfileStrict).mockResolvedValue(null);
    await expect(requireApprovedUser()).rejects.toBeInstanceOf(AccessPendingError);
  });

  it("denies not_whitelisted and unknown ranks as pending", async () => {
    vi.mocked(getUserProfileStrict).mockResolvedValue(profile("not_whitelisted"));
    await expect(requireApprovedUser()).rejects.toBeInstanceOf(AccessPendingError);

    vi.mocked(getUserProfileStrict).mockResolvedValue(profile("superuser"));
    await expect(requireApprovedUser()).rejects.toBeInstanceOf(AccessPendingError);
  });

  it("denies blocked users even with an approved rank", async () => {
    vi.mocked(getUserProfileStrict).mockResolvedValue(profile("admin", true));
    await expect(requireApprovedUser()).rejects.toBeInstanceOf(UserBlockedError);
  });

  it.each(["basic", "pro", "admin"])("allows rank %s", async (rank) => {
    vi.mocked(getUserProfileStrict).mockResolvedValue(profile(rank));
    await expect(requireApprovedUser()).resolves.toEqual({ userId: "a@b.com", rank });
  });

  it("maps errors to the expected HTTP status codes", () => {
    expect(new AccessPendingError().statusCode).toBe(403);
    expect(new AccessPendingError().code).toBe("ACCESS_PENDING");
    expect(new UserBlockedError().code).toBe("USER_BLOCKED");
    expect(new ServiceUnavailableError().statusCode).toBe(503);
  });
});
