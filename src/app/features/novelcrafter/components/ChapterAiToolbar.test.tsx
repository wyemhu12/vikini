// /app/features/novelcrafter/components/ChapterAiToolbar.test.tsx
import React, { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ChapterAiToolbar, { type ChapterAiToolbarProps } from "./ChapterAiToolbar";
import type { ActiveChapterToolMenu } from "./ChapterAiToolMenus";

const DICT: Record<string, string> = {
  novelcrafterDraftChapterBtn: "Viết bản nháp chương",
  novelcrafterSlotWrite: "Viết tiếp",
  novelcrafterSlotFeedback: "Nhận xét",
  novelcrafterSlotBrainstorm: "Gợi ý",
  novelcrafterSlotRewrite: "Viết lại",
  novelcrafterSlotExpand: "Mô tả & Mở rộng",
  novelcrafterMoreToolsBtn: "Công cụ khác",
  novelcrafterFeedbackPanelBtn: "Bảng nhận xét ({count})",
  novelcrafterWriteMenuAria: "Tùy chọn viết tiếp",
};

vi.mock("../../chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "vi",
    setLanguage: vi.fn(),
    t: (key: string) => DICT[key] ?? key,
    langs: ["vi", "en"] as const,
  }),
}));

vi.mock("./PromptSourceTooltip", () => ({
  default: ({ children }: { children: React.ReactElement }) => children,
}));

vi.mock("./ChapterAiToolMenus", () => ({
  default: ({ activeMenu }: { activeMenu: string }) => <div>menu:{activeMenu}</div>,
}));

function baseProps(overrides: Partial<ChapterAiToolbarProps> = {}): ChapterAiToolbarProps {
  return {
    activeMenu: null,
    onSelectMenu: vi.fn(),
    isStreaming: false,
    onStopStream: vi.fn(),
    selectedCharCount: 0,
    openFeedbackCount: 0,
    showFeedbackGutter: false,
    onToggleFeedbackGutter: vi.fn(),
    onRunFirstDraft: vi.fn(),
    onRunWrite: vi.fn(),
    onRunRewrite: vi.fn(),
    onRunFeedback: vi.fn(),
    onRunExpand: vi.fn(),
    onRunBrainstorm: vi.fn(),
    ...overrides,
  };
}

function StatefulToolbar() {
  const [activeMenu, setActiveMenu] = useState<ActiveChapterToolMenu>(null);
  return <ChapterAiToolbar {...baseProps({ activeMenu, onSelectMenu: setActiveMenu })} />;
}

describe("ChapterAiToolbar (UX cleanup plan)", () => {
  it("TC-U04: shows only chapter-level actions", () => {
    render(<ChapterAiToolbar {...baseProps()} />);
    expect(screen.getByRole("button", { name: "Viết bản nháp chương" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Viết tiếp" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nhận xét" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gợi ý" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bảng nhận xét (0)" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Viết lại" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mô tả & Mở rộng" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Công cụ khác" })).toBeNull();
  });

  it("TC-U05: AI menus open in a popover that closes on re-click and on Escape with focus restored", async () => {
    const user = userEvent.setup();
    render(<StatefulToolbar />);
    const feedbackBtn = screen.getByRole("button", { name: "Nhận xét" });

    await user.click(feedbackBtn);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("menu:feedback")).toBeInTheDocument();
    expect(feedbackBtn).toHaveAttribute("aria-expanded", "true");
    expect(feedbackBtn.className).not.toMatch(/(^|\s)bg-\(--accent\)(\s|$)/);

    await user.click(feedbackBtn);
    expect(feedbackBtn).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(feedbackBtn);
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(feedbackBtn);
  });

  it("TC-U06: the feedback panel button shows the open item count", () => {
    render(<ChapterAiToolbar {...baseProps({ openFeedbackCount: 3 })} />);
    expect(screen.getByRole("button", { name: "Bảng nhận xét (3)" })).toBeInTheDocument();
  });
});
