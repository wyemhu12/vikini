import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import AdminDashboard from "./AdminDashboard";
import AuditLogViewer from "./AuditLogViewer";
import UserManager from "./UserManager";
import { useLanguageStore } from "@/lib/store/languageStore";

const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
vi.mock("@/lib/store/toastStore", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

vi.mock("@/app/features/chat/hooks/useTheme", () => ({
  useTheme: () => ({
    family: "vikini",
    mode: "dark",
    setFamily: vi.fn(),
    setMode: vi.fn(),
    toggleMode: vi.fn(),
  }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("AdminDashboard, UserManager & AuditLogViewer (TC-W4-04)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    useLanguageStore.setState({ language: "vi" });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("renders AdminDashboard with responsive scrollable tablist, Theme Switcher, and --soft/--accent active VN button (no --warning)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ users: [] }),
    }) as unknown as typeof fetch;

    const { container } = render(<AdminDashboard currentUserId="admin-1" />);

    expect(container.firstElementChild?.className).toContain("bg-(--bg)");
    const tablist = screen.getByRole("tablist");
    expect(tablist.className).toContain("overflow-x-auto");

    const themeBtn = screen.getByRole("button", { name: "Giao diện" });
    expect(themeBtn).toBeInTheDocument();

    const vnBtn = screen.getByRole("button", { name: "VN" });
    expect(vnBtn).toHaveAttribute("aria-pressed", "true");
    expect(vnBtn.className).toContain("bg-(--soft)");
    expect(vnBtn.className).toContain("text-(--accent)");
    expect(vnBtn.className).not.toContain("--warning");

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/admin/users"));
  });

  it("UserManager shows Skeleton while loading, Inline Error + Retry on failure, and toast.error on openUserDetail failure", async () => {
    let userCalls = 0;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url === "/api/admin/users") {
        userCalls += 1;
        if (userCalls === 1) {
          return { ok: false, status: 500, json: async () => ({}) };
        }
        return {
          ok: true,
          json: async () => ({
            users: [
              {
                id: "u-2",
                email: "alice@example.com",
                rank: "pro",
                is_blocked: false,
                created_at: "2026-01-01T00:00:00Z",
              },
            ],
          }),
        };
      }
      if (url.startsWith("/api/admin/stats")) {
        return { ok: false, status: 500, json: async () => ({}) };
      }
      return { ok: true, json: async () => ({}) };
    }) as unknown as typeof fetch;

    render(<UserManager currentUserId="admin-1" />);

    // Loading skeleton shown immediately
    expect(screen.getByRole("status")).toBeInTheDocument();

    // First fetch fails -> role="alert" + Retry
    const alert = await screen.findByRole("alert");
    expect(alert).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));

    // Retry succeeds -> renders user row with accessible checkbox & detail trigger
    const emailBtn = await screen.findByRole("button", { name: "alice@example.com" });
    expect(screen.getByRole("button", { name: "Chọn tất cả người dùng" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(
      screen.getByRole("button", { name: "Chọn người dùng: alice@example.com" })
    ).toHaveAttribute("aria-pressed", "false");

    // Clicking email opens Radix dialog and fires toast.error when stats fetch fails
    fireEvent.click(emailBtn);
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(mockToastError).toHaveBeenCalledWith("Không thể tải chi tiết người dùng");
    });
  });

  it("AuditLogViewer renders bilingual action labels via translation keys and supports Error Retry", async () => {
    let calls = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      calls += 1;
      if (calls === 1) {
        return { ok: false, status: 500, json: async () => ({}) };
      }
      return {
        ok: true,
        json: async () => ({
          tableExists: true,
          logs: [
            {
              id: "log-1",
              action: "UPDATE_USER_RANK",
              admin_id: "a1",
              admin_email: "admin@vikini.app",
              target_id: "u2",
              target_email: "alice@example.com",
              details: { rank: "pro" },
              created_at: "2026-01-02T00:00:00Z",
            },
          ],
        }),
      };
    }) as unknown as typeof fetch;

    render(<AuditLogViewer />);
    await screen.findByRole("alert");

    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("Đổi xếp hạng")).toBeInTheDocument();
  });
});
