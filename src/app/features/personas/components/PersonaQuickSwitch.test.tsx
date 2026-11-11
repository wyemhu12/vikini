// src/app/features/personas/components/PersonaQuickSwitch.test.tsx
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import PersonaQuickSwitch from "./PersonaQuickSwitch";

let mockLang: "vi" | "en" = "vi";

vi.mock("../../chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: mockLang,
    setLanguage: vi.fn(),
    t: (key: string) => {
      const dict: Record<string, string> = {
        personaChip: "Persona",
        selectPersona: "Chọn Persona",
        personaNoneFound: mockLang === "vi" ? "Chưa có Persona nào" : "No Personas found",
        personaRemove: "Gỡ Persona",
        personaLoadFailed: "Không thể tải danh sách Persona",
        personaApplyFailed: "Không thể áp dụng Persona",
        managePersonas: "Quản lý Persona",
      };
      return dict[key] ?? key;
    },
    langs: ["vi", "en"] as const,
  }),
}));

vi.mock("../stores/usePersonaStore", () => ({
  usePersonaStore: () => ({ openPersonaModal: vi.fn(), triggerPersonaApplied: vi.fn() }),
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
  DynamicIcon: () => <svg data-testid="persona-icon" />,
}));

describe("PersonaQuickSwitch trigger (TC-18)", () => {
  it("prefixes the active persona name with 'Persona:'", () => {
    render(
      <PersonaQuickSwitch
        currentPersona={{ name: "Mentor", icon: null, color: null }}
        conversationId="c1"
      />
    );
    const trigger = screen.getByRole("button", { name: "Persona: Mentor" });
    expect(trigger).not.toHaveAttribute("aria-pressed");
    expect(trigger.className).not.toContain("uppercase");
  });

  it("shows the plain 'Persona' label when none is applied", () => {
    render(<PersonaQuickSwitch currentPersona={null} conversationId="c1" />);
    expect(screen.getByRole("button", { name: "Persona" })).toBeInTheDocument();
  });

  it("drops the prefix when showPrefix is false", () => {
    render(
      <PersonaQuickSwitch
        currentPersona={{ name: "Mentor", icon: null, color: null }}
        conversationId="c1"
        showPrefix={false}
      />
    );
    expect(screen.getByRole("button", { name: "Mentor" })).toBeInTheDocument();
  });
});

describe("PersonaQuickSwitch single-fetch guard & button types (TC-6E-01)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockLang = "vi";
    mockToastError.mockClear();
    mockLoggerError.mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("fetches /api/personas only once per opening when list is empty and does not refetch on language change", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ personas: [] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { rerender } = render(<PersonaQuickSwitch currentPersona={null} conversationId="c1" />);
    fireEvent.click(screen.getByRole("button", { name: "Persona" }));

    expect(await screen.findByText("Chưa có Persona nào")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    mockLang = "en";
    rerender(<PersonaQuickSwitch currentPersona={null} conversationId="c1" />);
    expect(await screen.findByText("No Personas found")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Closing and reopening allows a fresh retry
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Persona" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("fires fetch and toast.error only once when /api/personas returns HTTP 500", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<PersonaQuickSwitch currentPersona={null} conversationId="c1" />);
    fireEvent.click(screen.getByRole("button", { name: "Persona" }));

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Không thể tải danh sách Persona")
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mockToastError).toHaveBeenCalledTimes(1);
  });

  it("sets type='button' on every button inside PopoverContent", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ personas: [{ id: "p1", name: "Mentor", icon: null, color: null }] }),
    }) as unknown as typeof fetch;

    render(
      <PersonaQuickSwitch
        currentPersona={{ name: "Mentor", icon: null, color: null }}
        conversationId="c1"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Persona: Mentor" }));
    await screen.findByRole("button", { name: "Mentor" });

    const dialog = screen.getByRole("dialog");
    const buttons = dialog.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThanOrEqual(3);
    buttons.forEach((btn) => {
      expect(btn).toHaveAttribute("type", "button");
    });
  });
});
