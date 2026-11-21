import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const { mockUseSession, mockSignIn, mockSignOut } = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
  mockSignIn: vi.fn(),
  mockSignOut: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
  signIn: (...args: unknown[]) => mockSignIn(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

import { useAuthGate } from "./useAuthGate";

describe("useAuthGate (TC-W1-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls signOut and does NOT call signIn when session user is __blocked__ with stripped email", () => {
    mockUseSession.mockReturnValue({
      status: "authenticated",
      data: {
        user: {
          id: "",
          rank: "__blocked__",
          email: undefined,
          name: undefined,
          image: undefined,
        },
      },
    });

    const { result } = renderHook(() => useAuthGate());

    expect(result.current.isAuthed).toBe(false);
    expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: "/auth/error?error=blocked" });
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("calls signIn when unauthenticated and not blocked", () => {
    mockUseSession.mockReturnValue({
      status: "unauthenticated",
      data: null,
    });

    renderHook(() => useAuthGate());

    expect(mockSignIn).toHaveBeenCalledTimes(1);
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("does not trigger signIn or signOut for a valid authenticated user", () => {
    mockUseSession.mockReturnValue({
      status: "authenticated",
      data: {
        user: { id: "u@example.com", email: "u@example.com", rank: "basic" },
      },
    });

    const { result } = renderHook(() => useAuthGate());

    expect(result.current.isAuthed).toBe(true);
    expect(result.current.isPendingAccess).toBe(false);
    expect(mockSignIn).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
