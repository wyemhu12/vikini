import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";
import GlobalCommandPalette, { isEditableTarget } from "./GlobalCommandPalette";
import { useCommandPaletteStore } from "@/lib/store/commandPaletteStore";
import { useLanguageStore } from "@/lib/store/languageStore";

let mockPathname = "/gallery";
let mockStatus: "authenticated" | "unauthenticated" | "loading" = "authenticated";
const mockPush = vi.fn();
const mockFrameState = vi.fn(() => ({ mainChats: [{ id: "c1", title: "Old chat" }] }));

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush }),
}));
vi.mock("next-auth/react", () => ({ useSession: () => ({ status: mockStatus }) }));
vi.mock("../hooks/useAppFrameState", () => ({ useAppFrameState: () => mockFrameState() }));
vi.mock("../../chat/hooks/useTheme", () => ({
  useTheme: () => ({ mode: "dark", toggleMode: vi.fn() }),
}));

const pressCtrlK = (target: EventTarget = window) =>
  act(() => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
  });

describe("GlobalCommandPalette", () => {
  beforeEach(() => {
    mockPathname = "/gallery";
    mockStatus = "authenticated";
    mockPush.mockReset();
    mockFrameState.mockClear();
    useCommandPaletteStore.setState({ isOpen: false });
    useLanguageStore.setState({ language: "vi" });
  });

  it("TC-10: Ctrl+K opens navigation commands outside Chat", () => {
    render(<GlobalCommandPalette />);
    expect(screen.queryByRole("dialog")).toBeNull();
    pressCtrlK();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Đi tới Ảnh")).toBeInTheDocument();
    expect(screen.getByText("Old chat")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Đi tới Novelcrafter"));
    expect(mockPush).toHaveBeenCalledWith("/novelcrafter");
  });

  it("TC-11: stays off on Chat routes so only Chat's palette opens", () => {
    mockPathname = "/";
    render(<GlobalCommandPalette />);
    pressCtrlK();
    expect(screen.queryByRole("dialog")).toBeNull();
    act(() => useCommandPaletteStore.getState().open());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("TC-13: ignores Ctrl+K from text fields, editors or already-handled events", () => {
    render(<GlobalCommandPalette />);
    const textarea = document.createElement("textarea");
    const editor = document.createElement("div");
    editor.setAttribute("contenteditable", "true");
    document.body.append(textarea, editor);
    pressCtrlK(textarea);
    pressCtrlK(editor);
    act(() => {
      const event = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, cancelable: true });
      event.preventDefault();
      window.dispatchEvent(event);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    textarea.remove();
    editor.remove();
  });

  it.each([
    ["unauthenticated", "/gallery"],
    ["authenticated", "/auth/signin"],
  ] as const)("TC-14: does nothing when %s on %s", (status, pathname) => {
    mockStatus = status;
    mockPathname = pathname;
    render(<GlobalCommandPalette />);
    pressCtrlK();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mockFrameState).not.toHaveBeenCalled();
  });

  it("detects editable targets", () => {
    expect(isEditableTarget(document.createElement("input"))).toBe(true);
    expect(isEditableTarget(document.createElement("button"))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});
