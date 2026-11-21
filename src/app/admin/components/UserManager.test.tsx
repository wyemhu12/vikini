// /app/admin/components/UserManager.test.tsx
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import UserManager from "./UserManager";
import type { Profile } from "./UserDetailModal";

const mockLoggerError = vi.fn();
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
const mockConfirm = vi.fn(async (..._args: unknown[]) => true);

vi.mock("@/app/features/chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "vi",
    setLanguage: vi.fn(),
    t: (key: string) =>
      key === "adminBulkPartialFailed" ? "Updated {succeeded}/{total} ({failed} failed)" : key,
    langs: ["vi", "en"] as const,
  }),
}));

vi.mock("@/lib/utils/logger", () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/store/toastStore", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/store/confirmStore", () => ({
  confirm: (...args: unknown[]) => mockConfirm(...args),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    disabled,
    onValueChange,
    value,
  }: {
    children: React.ReactNode;
    disabled?: boolean;
    onValueChange?: (v: string) => void;
    value?: string;
  }) => (
    <div data-testid="mock-select" data-disabled={String(Boolean(disabled))}>
      <select
        disabled={disabled}
        value={value ?? ""}
        aria-label="mock-select-control"
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        <option value="" />
        <option value="basic">basic</option>
        <option value="pro">pro</option>
      </select>
      {children}
    </div>
  ),
  SelectTrigger: ({
    children,
    "aria-label": ariaLabel,
  }: {
    children: React.ReactNode;
    "aria-label"?: string;
  }) => <div data-trigger-label={ariaLabel}>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder ?? ""}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("./UserDetailModal", () => ({
  default: ({
    user,
    stats,
    loading,
    onClose,
  }: {
    user: Profile | null;
    stats: { conversations: number; messages: number } | null;
    loading: boolean;
    onClose: () => void;
  }) =>
    user ? (
      <div data-testid="user-detail-modal">
        <span data-testid="detail-email">{user.email}</span>
        <span data-testid="detail-loading">{String(loading)}</span>
        <span data-testid="detail-stats">
          {stats ? `${stats.conversations}/${stats.messages}` : "none"}
        </span>
        <button type="button" onClick={onClose}>
          close-modal
        </button>
      </div>
    ) : null,
}));

const USERS: Profile[] = [
  {
    id: "admin-self",
    email: "admin@example.com",
    rank: "admin",
    is_blocked: false,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "alice+1@example.com",
    email: "alice@example.com",
    rank: "basic",
    is_blocked: false,
    created_at: "2026-01-02T00:00:00.000Z",
  },
  {
    id: "bob-2",
    email: "bob@example.com",
    rank: "pro",
    is_blocked: false,
    created_at: "2026-01-03T00:00:00.000Z",
  },
];

describe("UserManager (TC-W2B-15 / NP-5)", () => {
  beforeEach(() => {
    mockLoggerError.mockReset();
    mockToastError.mockReset();
    mockToastSuccess.mockReset();
    mockConfirm.mockReset().mockResolvedValue(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("encodes userId in stats URL and aborts stale detail request when switching users", async () => {
    let resolveA!: (res: Response) => void;
    let signalA: AbortSignal | null | undefined;

    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/admin/users") {
        return Promise.resolve(
          new Response(JSON.stringify({ data: { users: USERS } }), { status: 200 })
        );
      }
      if (url.includes("alice%2B1%40example.com")) {
        signalA = init?.signal;
        return new Promise<Response>((res) => {
          resolveA = res;
        });
      }
      if (url.includes("userId=bob-2")) {
        return Promise.resolve(
          new Response(JSON.stringify({ data: { conversations: 7, messages: 42 } }), {
            status: 200,
          })
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<UserManager currentUserId="admin-self" />);
    await waitFor(() => expect(screen.getByText("alice@example.com")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "alice@example.com" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/stats?userId=alice%2B1%40example.com",
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    );

    // Switch immediately to Bob while Alice's request is still in-flight
    fireEvent.click(screen.getByRole("button", { name: "bob@example.com" }));
    expect(signalA?.aborted).toBe(true);

    await waitFor(() => expect(screen.getByTestId("detail-stats")).toHaveTextContent("7/42"));

    // Resolve Alice late — must NOT overwrite Bob's stats or trigger toast error
    await act(async () => {
      resolveA(
        new Response(JSON.stringify({ data: { conversations: 99, messages: 999 } }), {
          status: 200,
        })
      );
      await Promise.resolve();
    });

    expect(screen.getByTestId("detail-email")).toHaveTextContent("bob@example.com");
    expect(screen.getByTestId("detail-stats")).toHaveTextContent("7/42");
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("disables bulk rank select during bulkUpdate, prevents concurrent runs, and reports partial failures", async () => {
    let resolveFirstPatch!: (res: Response) => void;
    let patchCount = 0;
    let usersFetchCount = 0;

    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/admin/users" && (!init?.method || init.method === "GET")) {
        usersFetchCount += 1;
        return Promise.resolve(
          new Response(JSON.stringify({ data: { users: USERS } }), { status: 200 })
        );
      }
      if (url === "/api/admin/users" && init?.method === "PATCH") {
        patchCount += 1;
        const body = JSON.parse(String(init.body)) as { userId: string };
        if (body.userId === "alice+1@example.com") {
          return new Promise<Response>((res) => {
            resolveFirstPatch = res;
          });
        }
        return Promise.resolve(
          new Response(JSON.stringify({ error: { message: "DB failed" } }), { status: 500 })
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<UserManager currentUserId="admin-self" />);
    await waitFor(() => expect(screen.getByText("alice@example.com")).toBeInTheDocument());
    expect(usersFetchCount).toBe(1);

    // Select both non-self users
    fireEvent.click(screen.getByRole("button", { name: "adminSelectAllUsers" }));
    expect(screen.getByText("2 adminBulkSelected")).toBeInTheDocument();

    const blockBtn = screen.getByRole("button", { name: "adminBulkBlock" });
    fireEvent.click(blockBtn);

    // While in flight: bulk Select is disabled & second click is ignored
    const bulkSelectWrapper = screen.getAllByTestId("mock-select")[2];
    expect(bulkSelectWrapper).toHaveAttribute("data-disabled", "true");
    fireEvent.click(blockBtn);
    expect(patchCount).toBe(1);

    // Finish user 1 (200 OK), then user 2 automatically gets 500
    await act(async () => {
      resolveFirstPatch(new Response(JSON.stringify({ success: true }), { status: 200 }));
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Updated 1/2 (1 failed)");
    });

    expect(patchCount).toBe(2);
    expect(usersFetchCount).toBe(2); // fetchUsers re-called to sync user 1
    expect(mockLoggerError).toHaveBeenCalledTimes(1);
    expect(screen.getByText("1 adminBulkSelected")).toBeInTheDocument(); // only failed bob-2 stays selected
  });

  it("uses confirmAction key on rank change and logs + toasts on single updateUser HTTP 500", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/admin/users" && (!init?.method || init.method === "GET")) {
        return Promise.resolve(
          new Response(JSON.stringify({ data: { users: USERS } }), { status: 200 })
        );
      }
      if (url === "/api/admin/users" && init?.method === "PATCH") {
        return Promise.resolve(
          new Response(JSON.stringify({ error: { message: "Forbidden rank" } }), { status: 500 })
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<UserManager currentUserId="admin-self" />);
    await waitFor(() => expect(screen.getByText("alice@example.com")).toBeInTheDocument());

    // First 2 selects are rankFilter & statusFilter, 3rd is admin-self row, 4th is alice row
    const selects = screen.getAllByLabelText("mock-select-control");
    fireEvent.change(selects[3], { target: { value: "pro" } });

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith("Forbidden rank"));
    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ confirmLabel: "confirmAction" })
    );
    expect(mockLoggerError).toHaveBeenCalledWith(
      "[UserManager] Failed to update user:",
      expect.any(Error)
    );
  });
});
