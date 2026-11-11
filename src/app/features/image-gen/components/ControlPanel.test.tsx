// src/app/features/image-gen/components/ControlPanel.test.tsx
import React from "react";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ControlPanel from "./ControlPanel";

const DICT: Record<string, string> = {
  settings: "Cài đặt",
  studioAiEnhance: "AI Enhance",
  studioAiEnhanceDesc: "Tự cải thiện prompt",
  studioModel: "Model",
  studioGenerate: "Tạo",
  studioPromptRequired: "Nhập prompt để bắt đầu",
  studioShortcutHint: "Nhấn Ctrl+Enter để tạo nhanh",
  studioTitle: "Studio",
  studioGenerateCount: "Tạo {n} ảnh",
};

vi.mock("../../chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "vi",
    setLanguage: vi.fn(),
    t: (key: string) => DICT[key] ?? key,
    langs: ["vi", "en"] as const,
  }),
}));

vi.mock("./SettingsModal", () => ({ default: () => null }));

// Style swatches are intentional categorical colors (out of phase 4 scope).
vi.mock("./StyleSelector", () => ({ default: () => <div data-testid="style-selector" /> }));

vi.mock("./hooks/usePromptAutocomplete", () => ({
  usePromptAutocomplete: () => ({
    handlePromptChange: vi.fn(),
    handlePromptKeyDown: vi.fn(),
    dismissSuggestions: vi.fn(),
    selectSuggestion: vi.fn(),
    showSuggestions: false,
    suggestions: [] as string[],
    loadingSuggestions: false,
    selectedSuggestionIdx: -1,
  }),
}));

type Props = React.ComponentProps<typeof ControlPanel>;

export function makeControlPanelProps(overrides: Partial<Props> = {}): Props {
  return {
    prompt: "",
    setPrompt: vi.fn(),
    model: "gemini-3.1-flash-image",
    setModel: vi.fn(),
    aspectRatio: "1:1",
    setAspectRatio: vi.fn(),
    resolution: "1K",
    setResolution: vi.fn(),
    style: "none",
    setStyle: vi.fn(),
    isEnhancerOn: false,
    setIsEnhancerOn: vi.fn(),
    onGenerate: vi.fn(),
    generating: false,
    referenceImages: [],
    setReferenceImages: vi.fn(),
    numberOfImages: 1,
    setNumberOfImages: vi.fn(),
    batchQuota: null,
    negativePrompt: "",
    setNegativePrompt: vi.fn(),
    promptHistory: [],
    onClearHistory: vi.fn(),
    ...overrides,
  };
}

describe("ControlPanel accessible names (3D TC-01)", () => {
  it("names the settings button, AI Enhance switch and model picker", () => {
    render(<ControlPanel {...makeControlPanelProps()} />);

    expect(screen.getByRole("button", { name: "Cài đặt" })).toBeInTheDocument();
    const enhance = screen.getByRole("switch", { name: "AI Enhance" });
    expect(enhance).toHaveAccessibleDescription("Tự cải thiện prompt");
    expect(screen.getByRole("combobox", { name: "Model" })).toBeInTheDocument();
  });
});

const RAW_COLOR = /(purple|indigo|fuchsia|violet|from-|to-blue|blue-[0-9]|red-[0-9]|amber-[0-9])/;

function allClassNames(root: HTMLElement): string[] {
  return [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))].map((el) =>
    typeof el.className === "string" ? el.className : (el.getAttribute("class") ?? "")
  );
}

describe("ControlPanel tokens, labels and M5 (phase 4)", () => {
  it("uses no uppercase labels, no raw purple/blue gradients and no Studio title block (TC-03)", () => {
    const { container } = render(<ControlPanel {...makeControlPanelProps()} />);
    const classes = allClassNames(container);
    expect(classes.filter((c) => c.split(/\s+/).includes("uppercase"))).toEqual([]);
    expect(classes.filter((c) => RAW_COLOR.test(c))).toEqual([]);
    expect(screen.queryByText("Studio")).toBeNull();
    // 3D accessible names survive the redesign
    expect(screen.getByRole("button", { name: "Cài đặt" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "AI Enhance" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Model" })).toBeInTheDocument();
  });

  it("explains why Generate is disabled when the prompt is empty (TC-04)", () => {
    render(<ControlPanel {...makeControlPanelProps({ prompt: "" })} />);
    const generate = screen.getByRole("button", { name: "Tạo" });
    expect(generate).toBeDisabled();
    expect(generate).toHaveAccessibleDescription("Nhập prompt để bắt đầu");
    expect(generate.className).toContain("bg-(--accent)");
    expect(generate.className).toContain("text-(--on-accent)");
  });

  it("drops the hint once there is a prompt or while generating (TC-05)", () => {
    const { rerender } = render(<ControlPanel {...makeControlPanelProps({ prompt: "mèo" })} />);
    expect(screen.queryByText("Nhập prompt để bắt đầu")).toBeNull();
    expect(screen.getByRole("button", { name: "Tạo" })).not.toHaveAttribute("aria-describedby");

    rerender(<ControlPanel {...makeControlPanelProps({ prompt: "", generating: true })} />);
    expect(screen.queryByText("Nhập prompt để bắt đầu")).toBeNull();
  });

  it("hides the keyboard hint on coarse pointers and keeps text at 12px or more (TC-06)", () => {
    const { container } = render(<ControlPanel {...makeControlPanelProps()} />);
    const hint = screen.getByText("Nhấn Ctrl+Enter để tạo nhanh");
    expect(hint.className).toContain("pointer-coarse:hidden");
    expect(hint.className).toContain("text-xs");
    const tiny = allClassNames(container).filter((c) => /text-\[(8|9|10|11)px\]/.test(c));
    expect(tiny).toEqual([]);
  });

  it("left-aligns the model option content", () => {
    render(<ControlPanel {...makeControlPanelProps()} />);
    const trigger = screen.getByRole("combobox", { name: "Model" });
    const content = within(trigger).getByText("Gemini Image Flash").parentElement;
    expect(content?.className).toContain("items-start");
    expect(content?.className).toContain("text-left");
  });
});

describe("ControlPanel studio form (phase 4B)", () => {
  it("uses a compact labelled switch and an aspect-ratio radiogroup (TC-04)", () => {
    const props = makeControlPanelProps();
    render(<ControlPanel {...props} />);

    const enhance = screen.getByRole("switch", { name: "AI Enhance" });
    expect(enhance).not.toHaveAttribute("aria-label");
    expect(screen.getByText("AI Enhance").tagName).toBe("LABEL");
    fireEvent.click(enhance);
    expect(props.setIsEnhancerOn).toHaveBeenCalledTimes(1);
    expect(props.setIsEnhancerOn).toHaveBeenCalledWith(true);

    expect(screen.queryByText("studioEnhancement")).toBeNull();
    expect(screen.getByRole("radiogroup", { name: "studioAspectRatioGroup" })).toBeInTheDocument();
  });

  it("puts the image count in the Generate label (TC-05)", () => {
    const { rerender } = render(<ControlPanel {...makeControlPanelProps({ prompt: "mèo" })} />);
    expect(screen.getByRole("button", { name: "Tạo" })).toBeInTheDocument();

    rerender(<ControlPanel {...makeControlPanelProps({ prompt: "mèo", numberOfImages: 4 })} />);
    expect(screen.getByRole("button", { name: "Tạo 4 ảnh" })).toBeInTheDocument();
    expect(screen.queryByText(/\(4/)).toBeNull();
  });

  it("shows the keyboard hint below the Generate button (TC-06)", () => {
    render(<ControlPanel {...makeControlPanelProps({ prompt: "mèo" })} />);
    const generate = screen.getByRole("button", { name: "Tạo" });
    const hint = screen.getByText("Nhấn Ctrl+Enter để tạo nhanh");
    expect(generate.compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(hint.className).toContain("pointer-coarse:hidden");
  });
});
