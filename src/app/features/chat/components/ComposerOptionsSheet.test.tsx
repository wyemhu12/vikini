// src/app/features/chat/components/ComposerOptionsSheet.test.tsx
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ComposerOptionsSheet, { type ComposerOptionsSheetProps } from "./ComposerOptionsSheet";

vi.mock("../hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "vi",
    setLanguage: vi.fn(),
    t: (key: string) => {
      const dict: Record<string, string> = {
        composerOptions: "Tùy chọn",
        done: "Xong",
        webSearchToggle: "Tìm web",
        webSearchDesc: "AI tự quyết khi nào cần tra cứu",
        webSearchNotSupported: "Model này không hỗ trợ tìm kiếm web",
        alwaysSearch: "Luôn tìm kiếm",
        alwaysSearchDesc: "Tra cứu ở mọi tin nhắn",
        thinkingLevel: "Suy luận",
        thinkingOff: "Tắt",
        thinkingLevelLow: "Nhanh",
        thinkingLevelMedium: "Vừa",
        thinkingLevelHigh: "Sâu",
        thinkingLevelMinimal: "Tối thiểu",
        gemChip: "Gem",
        personaChip: "Persona",
        attachFileOrImage: "Đính kèm ảnh hoặc tệp",
        conflictWarning: "Đang bật cả Gem và Persona.",
        localSamplingTitle: "Thông số sáng tạo",
      };
      return dict[key] ?? key;
    },
    langs: ["vi", "en"] as const,
  }),
}));

vi.mock("../../gems/components/GemQuickSwitch", () => ({
  default: () => <div data-testid="gem-switch" />,
}));
vi.mock("../../personas/components/PersonaQuickSwitch", () => ({
  default: () => <div data-testid="persona-switch" />,
}));
vi.mock("./ModelSelector", () => ({
  default: () => <div data-testid="model-selector" />,
}));
vi.mock("./LocalSamplingSettings", () => ({
  default: () => <div data-testid="local-sampling" />,
}));

function makeProps(overrides: Partial<ComposerOptionsSheetProps> = {}): ComposerOptionsSheetProps {
  return {
    open: true,
    onOpenChange: vi.fn(),
    currentModel: "gemini-3.8-flash",
    webSearchEnabled: true,
    toggleWebSearch: vi.fn(),
    alwaysSearch: false,
    toggleAlwaysSearch: vi.fn(),
    thinkingLevel: "medium",
    setThinkingLevel: vi.fn(),
    currentGem: null,
    currentPersona: null,
    conversationId: "c1",
    onSelectModel: vi.fn(),
    isModelAllowed: () => true,
    onAttach: vi.fn(),
    attachDisabled: false,
    localSamplingDisabled: false,
    ...overrides,
  };
}

describe("ComposerOptionsSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a titled dialog with described web search switch (TC-09)", () => {
    const props = makeProps();
    render(<ComposerOptionsSheet {...props} />);

    expect(screen.getByRole("dialog", { name: "Tùy chọn" })).toBeInTheDocument();
    const web = screen.getByRole("switch", { name: "Tìm web" });
    expect(web).toHaveAttribute("aria-checked", "true");
    expect(web).toHaveAccessibleDescription("AI tự quyết khi nào cần tra cứu");

    fireEvent.click(web);
    expect(props.toggleWebSearch).toHaveBeenCalledTimes(1);

    const always = screen.getByRole("switch", { name: "Luôn tìm kiếm" });
    expect(always).toHaveAttribute("aria-checked", "false");
    fireEvent.click(always);
    expect(props.toggleAlwaysSearch).toHaveBeenCalledTimes(1);

    expect(screen.getByTestId("gem-switch")).toBeInTheDocument();
    expect(screen.getByTestId("persona-switch")).toBeInTheDocument();
    expect(screen.getByTestId("model-selector")).toBeInTheDocument();
  });

  it("shows the thinking level radiogroup with the effective level checked (TC-10)", () => {
    const props = makeProps();
    render(<ComposerOptionsSheet {...props} />);

    const group = screen.getByRole("radiogroup", { name: "Suy luận" });
    expect(within(group).getByRole("radio", { name: "Vừa" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(within(group).getByRole("radio", { name: "Tắt" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    fireEvent.click(within(group).getByRole("radio", { name: "Sâu" }));
    expect(props.setThinkingLevel).toHaveBeenCalledWith("high");
  });

  it("hides thinking and always-search rows for unsupported models (TC-11)", () => {
    render(<ComposerOptionsSheet {...makeProps({ currentModel: "gpt-unknown-model" })} />);

    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.queryByRole("switch", { name: "Luôn tìm kiếm" })).toBeNull();
    expect(screen.getByRole("switch", { name: "Tìm web" })).toBeInTheDocument();
  });

  it("disables web search with an explanation when the model cannot search", () => {
    const props = makeProps({ currentModel: "deepseek-v4-flash" });
    render(<ComposerOptionsSheet {...props} />);

    const web = screen.getByRole("switch", { name: "Tìm web" });
    expect(web).toBeDisabled();
    expect(web).toHaveAttribute("aria-checked", "false");
    expect(web).toHaveAccessibleDescription("Model này không hỗ trợ tìm kiếm web");
  });

  it("closes before opening the file picker and closes on Done (TC-12)", () => {
    const calls: string[] = [];
    const props = makeProps({
      onOpenChange: vi.fn((open: boolean) => calls.push(`open:${open}`)),
      onAttach: vi.fn(() => calls.push("attach")),
    });
    render(<ComposerOptionsSheet {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Đính kèm ảnh hoặc tệp" }));
    expect(calls).toEqual(["open:false", "attach"]);
    expect(props.onAttach).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Xong" }));
    expect(props.onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("shows the conflict note and local sampling row when relevant", () => {
    render(
      <ComposerOptionsSheet
        {...makeProps({
          currentModel: "strata-local",
          currentGem: { name: "Coder" },
          currentPersona: { name: "Mentor", icon: null, color: null },
        })}
      />
    );
    expect(screen.getByText("Đang bật cả Gem và Persona.")).toBeInTheDocument();
    expect(screen.getByTestId("local-sampling")).toBeInTheDocument();
  });
});
