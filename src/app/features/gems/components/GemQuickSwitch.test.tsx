// src/app/features/gems/components/GemQuickSwitch.test.tsx
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import GemQuickSwitch from "./GemQuickSwitch";

vi.mock("../../chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "vi",
    setLanguage: vi.fn(),
    t: (key: string) => {
      const dict: Record<string, string> = {
        gemChip: "Gem",
        selectGem: "Chọn GEM",
        gemNoneFound: "Chưa có Gem nào",
        gemRemove: "Gỡ Gem",
        gemApplyFailed: "Không thể áp dụng Gem",
        gemLoadFailed: "Không thể tải danh sách Gem",
      };
      return dict[key] ?? key;
    },
    langs: ["vi", "en"] as const,
  }),
}));

vi.mock("../stores/useGemStore", () => ({
  useGemStore: () => ({ openGemModal: vi.fn(), triggerGemApplied: vi.fn() }),
}));

const mockToastError = vi.fn();
const mockLoggerError = vi.fn();
vi.mock("@/lib/store/toastStore", () => ({
  toast: { error: (msg: string) => mockToastError(msg), success: vi.fn(), info: vi.fn() },
}));
vi.mock("@/lib/utils/logger", () => ({
  logger: { error: (...args: unknown[]) => mockLoggerError(...args), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("@/components/ui/DynamicIcon", () => ({
  DynamicIcon: () => <svg data-testid="gem-icon" />,
}));

describe("GemQuickSwitch trigger (TC-17)", () => {
  it("prefixes the active gem name with 'Gem:'", () => {
    render(<GemQuickSwitch currentGem={{ name: "Kỹ sư Next.js" }} conversationId="c1" />);
    const trigger = screen.getByRole("button", { name: "Gem: Kỹ sư Next.js" });
    expect(trigger).not.toHaveAttribute("aria-pressed");
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger.className).not.toContain("uppercase");
  });

  it("shows the plain 'Gem' label when no gem is applied", () => {
    render(<GemQuickSwitch currentGem={null} conversationId="c1" />);
    expect(screen.getByRole("button", { name: "Gem" })).toBeInTheDocument();
  });

  it("drops the prefix when showPrefix is false", () => {
    render(
      <GemQuickSwitch
        currentGem={{ name: "Kỹ sư Next.js" }}
        conversationId="c1"
        showPrefix={false}
      />
    );
    expect(screen.getByRole("button", { name: "Kỹ sư Next.js" })).toBeInTheDocument();
  });
});

describe("GemQuickSwitch translations and error feedback (3D TC-05, TC-06)", () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    mockToastError.mockClear();
    mockLoggerError.mockClear();
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("shows translated empty and remove labels", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ gems: [] }) }) as unknown as typeof fetch;
    render(<GemQuickSwitch currentGem={null} conversationId="c1" />);
    fireEvent.click(screen.getByRole("button", { name: "Gem" }));
    expect(await screen.findByText("Chưa có Gem nào")).toBeInTheDocument();
    expect(screen.queryByText(/No GEMs found/)).toBeNull();
  });

  it("offers a translated remove action when a gem is applied", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ gems: [{ id: "g1", name: "Coder", icon: null }] }),
    }) as unknown as typeof fetch;
    render(<GemQuickSwitch currentGem={{ name: "Coder" }} conversationId="c1" />);
    fireEvent.click(screen.getByRole("button", { name: "Gem: Coder" }));
    expect(await screen.findByRole("button", { name: "Gỡ Gem" })).toBeInTheDocument();
  });

  it("logs and toasts when loading gems fails", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network")) as unknown as typeof fetch;
    render(<GemQuickSwitch currentGem={null} conversationId="c1" />);
    fireEvent.click(screen.getByRole("button", { name: "Gem" }));
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith("Không thể tải danh sách Gem"));
    expect(mockLoggerError).toHaveBeenCalledTimes(1);
  });

  it("treats a non-ok response as a load failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    }) as unknown as typeof fetch;
    render(<GemQuickSwitch currentGem={null} conversationId="c1" />);
    fireEvent.click(screen.getByRole("button", { name: "Gem" }));
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith("Không thể tải danh sách Gem"));
  });

  it("toasts a translated message when applying a gem fails", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ gems: [{ id: "g1", name: "Coder", icon: null }] }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      }) as unknown as typeof fetch;
    render(<GemQuickSwitch currentGem={null} conversationId="c1" />);
    fireEvent.click(screen.getByRole("button", { name: "Gem" }));
    fireEvent.click(await screen.findByRole("button", { name: "Coder" }));
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith("Không thể áp dụng Gem"));
  });

  it("sets type='button' on every button inside PopoverContent and does not refetch on rerender (TC-6E-01)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ gems: [{ id: "g1", name: "Coder", icon: null }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { rerender } = render(
      <GemQuickSwitch currentGem={{ name: "Coder" }} conversationId="c1" />
    );
    fireEvent.click(screen.getByRole("button", { name: "Gem: Coder" }));
    await screen.findByRole("button", { name: "Coder" });

    const dialog = screen.getByRole("dialog");
    const buttons = dialog.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThanOrEqual(3);
    buttons.forEach((btn) => {
      expect(btn).toHaveAttribute("type", "button");
    });

    rerender(<GemQuickSwitch currentGem={{ name: "Coder" }} conversationId="c1" />);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
