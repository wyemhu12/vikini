// src/app/features/chat/components/ComposerLeadingControls.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ComposerLeadingControls, { countActiveComposerOptions } from "./ComposerLeadingControls";
import type { ComposerOptionsSheetProps } from "./ComposerOptionsSheet";

const mockSheet = vi.fn();

vi.mock("../hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "vi",
    setLanguage: vi.fn(),
    t: (key: string) => {
      const dict: Record<string, string> = {
        composerOptions: "Tùy chọn",
        composerOptionsActive: "{n} tùy chọn đang bật",
        webSearchToggle: "Tìm web",
        webSearchNotSupported: "Model này không hỗ trợ tìm kiếm web",
        alwaysSearch: "Luôn tìm kiếm",
        alwaysSearchTooltip: "AI luôn tìm kiếm web",
        conflictWarning: "Đang bật cả Gem và Persona.",
        files: "Tệp",
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
vi.mock("./LocalSamplingSettings", () => ({
  default: () => <div data-testid="local-sampling" />,
}));
vi.mock("./FileManagerPanel", () => ({
  default: () => <div data-testid="file-manager" />,
}));
vi.mock("./ComposerOptionsSheet", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./ComposerOptionsSheet")>()),
  default: (props: ComposerOptionsSheetProps) => {
    mockSheet(props);
    return props.open ? <div data-testid="options-sheet" /> : null;
  },
}));

type Props = React.ComponentProps<typeof ComposerLeadingControls>;

function makeProps(overrides: Partial<Props> = {}): Props {
  return {
    currentModel: "gemini-3.8-flash",
    webSearchEnabled: true,
    toggleWebSearch: vi.fn(),
    alwaysSearch: false,
    toggleAlwaysSearch: vi.fn(),
    thinkingLevel: "off",
    setThinkingLevel: vi.fn(),
    currentGem: null,
    currentPersona: null,
    conversationId: "c1",
    fileCount: 0,
    fileConversationId: "c1",
    onSelectModel: vi.fn(),
    isModelAllowed: () => true,
    onAttach: vi.fn(),
    attachDisabled: false,
    localSamplingDisabled: false,
    ...overrides,
  };
}

describe("ComposerLeadingControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders labelled aria-pressed toggles without ON/OFF text (TC-05)", () => {
    const props = makeProps();
    const { container } = render(<ComposerLeadingControls {...props} />);

    const web = screen.getByRole("button", { name: "Tìm web" });
    const always = screen.getByRole("button", { name: "Luôn tìm kiếm" });
    expect(web).toHaveAttribute("aria-pressed", "true");
    expect(always).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(web);
    fireEvent.click(always);
    expect(props.toggleWebSearch).toHaveBeenCalledTimes(1);
    expect(props.toggleAlwaysSearch).toHaveBeenCalledTimes(1);

    const text = container.textContent ?? "";
    expect(text).not.toMatch(/\b(BẬT|TẮT|ON|OFF)\b/);
    expect(container.innerHTML).not.toContain("uppercase");
  });

  it("disables web search for unsupported models and hides always-search (TC-06)", () => {
    const props = makeProps({ currentModel: "deepseek-v4-flash" });
    render(<ComposerLeadingControls {...props} />);

    const web = screen.getByRole("button", { name: "Tìm web" });
    expect(web).toBeDisabled();
    expect(web).toHaveAttribute("aria-pressed", "false");
    expect(web).toHaveAttribute("title", "Model này không hỗ trợ tìm kiếm web");
    fireEvent.click(web);
    expect(props.toggleWebSearch).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Luôn tìm kiếm" })).toBeNull();
  });

  it("keeps web search and options usable while a reply is streaming (TC-06, Revision 2)", () => {
    const props = makeProps({ localSamplingDisabled: true });
    render(<ComposerLeadingControls {...props} />);

    const web = screen.getByRole("button", { name: "Tìm web" });
    const options = screen.getByRole("button", { name: /^Tùy chọn/ });
    expect(web).not.toBeDisabled();
    expect(options).not.toBeDisabled();
    fireEvent.click(web);
    expect(props.toggleWebSearch).toHaveBeenCalledTimes(1);
  });

  it("counts active options using the effective thinking level (TC-07)", () => {
    const base = {
      currentModel: "gemini-3.8-flash",
      webSearchEnabled: false,
      alwaysSearch: false,
      thinkingLevel: "off" as const,
      currentGem: null,
      currentPersona: null,
    };
    expect(countActiveComposerOptions(base)).toBe(0);
    expect(
      countActiveComposerOptions({
        ...base,
        webSearchEnabled: true,
        alwaysSearch: true,
        thinkingLevel: "high",
        currentGem: { name: "Coder" },
        currentPersona: { name: "Mentor", icon: null, color: null },
      })
    ).toBe(5);
    expect(countActiveComposerOptions({ ...base, currentModel: "gemini-4-argon" })).toBe(1);
    expect(
      countActiveComposerOptions({
        ...base,
        currentModel: "gpt-unknown-model",
        thinkingLevel: "high",
      })
    ).toBe(0);
    expect(
      countActiveComposerOptions({
        ...base,
        currentModel: "deepseek-v4-flash",
        webSearchEnabled: true,
        alwaysSearch: true,
      })
    ).toBe(0);
    expect(
      countActiveComposerOptions({ ...base, currentModel: "claude-sonnet-4.5", alwaysSearch: true })
    ).toBe(0);
  });

  it("renders the mobile options button with an active-count label and desktop group (TC-07)", () => {
    const { container } = render(
      <ComposerLeadingControls {...makeProps({ thinkingLevel: "high" })} />
    );

    const options = screen.getByRole("button", { name: "Tùy chọn · 2 tùy chọn đang bật" });
    expect(options.className).toContain("@3xl/chat:hidden");
    expect(options).toHaveAttribute("aria-haspopup", "dialog");
    expect(options).toHaveTextContent("2");

    const desktop = container.querySelector('[data-composer-group="desktop"]');
    expect(desktop?.className).toContain("hidden");
    expect(desktop?.className).toContain("@3xl/chat:flex");

    expect(screen.queryByTestId("options-sheet")).toBeNull();
    fireEvent.click(options);
    expect(screen.getByTestId("options-sheet")).toBeInTheDocument();
    expect(mockSheet).toHaveBeenLastCalledWith(expect.objectContaining({ open: true }));
  });

  it("shows the files chip only with files and a labelled conflict badge (TC-08)", () => {
    const { rerender } = render(<ComposerLeadingControls {...makeProps()} />);
    expect(screen.queryByRole("button", { name: /Tệp/ })).toBeNull();

    rerender(
      <ComposerLeadingControls
        {...makeProps({
          fileCount: 3,
          currentGem: { name: "Coder" },
          currentPersona: { name: "Mentor", icon: null, color: null },
        })}
      />
    );
    expect(screen.getByRole("button", { name: "Tệp (3)" })).toBeInTheDocument();
    expect(screen.getByLabelText("Đang bật cả Gem và Persona.")).toBeInTheDocument();
  });
});
