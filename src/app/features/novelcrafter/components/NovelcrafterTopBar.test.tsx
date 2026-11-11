// /app/features/novelcrafter/components/NovelcrafterTopBar.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import NovelcrafterTopBar from "./NovelcrafterTopBar";

const mockSetLanguage = vi.fn();

const DICT: Record<string, string> = {
  novelcrafterRoutingButton: "Cài đặt AI",
  novelcrafterAiSettingsSummary: "GEM tổng: {gem} · Persona tổng: {persona}",
  novelcrafterNoMasterGem: "Chưa chọn GEM Tổng",
  novelcrafterNoMasterPersona: "Không dùng Persona Tổng",
  novelcrafterMoreMenu: "Thêm",
  novelcrafterPromptStudioOpen: "Quản lý Prompt",
  novelcrafterExportMenuBtn: "Xuất bản thảo",
  novelcrafterExportIncludeBible: "Kèm hồ sơ truyện",
  novelcrafterExportIncludeSummaries: "Kèm tóm tắt chương",
  novelcrafterExportMarkdownBtn: "Xuất Markdown",
  novelcrafterExportPlainTextBtn: "Xuất văn bản thuần",
  novelcrafterLanguageSwitch: "Ngôn ngữ: {lang}",
  themes: "Giao diện",
};

vi.mock("../../chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "vi",
    setLanguage: mockSetLanguage,
    t: (key: string) => DICT[key] ?? key,
    langs: ["vi", "en"] as const,
  }),
}));

vi.mock("@/app/features/chat/components/ModelSelector", () => ({
  default: () => <div data-testid="model-selector" />,
}));

vi.mock("../../layout/components/ThemeMenuItems", () => ({
  default: () => <div data-testid="theme-items" />,
}));

vi.mock("next/link", () => ({
  default: React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(
    function MockLink({ href, children, ...rest }, ref) {
      return (
        <a ref={ref} href={href} {...rest}>
          {children}
        </a>
      );
    }
  ),
}));

type Props = React.ComponentProps<typeof NovelcrafterTopBar>;

function makeProps(overrides: Partial<Props> = {}): Props {
  return {
    storyTitle: "Gió mùa cuối",
    onRenameTitle: vi.fn(),
    selectedModel: "gemini-3.8-flash",
    onSelectModel: vi.fn(),
    allowedModelIds: new Set<string>(),
    masterGem: { id: "g1", name: "Văn xuôi trữ tình" } as Props["masterGem"],
    masterPersona: null,
    saveStatus: "saved",
    chapterWordCount: 1284,
    onRetrySave: vi.fn(),
    onOpenRoutingModal: vi.fn(),
    onExportManuscript: vi.fn(),
    showLeftPane: true,
    onToggleLeftPane: vi.fn(),
    showRightPane: true,
    onToggleRightPane: vi.fn(),
    ...overrides,
  };
}

function openMenu() {
  fireEvent.pointerDown(screen.getByRole("button", { name: "Thêm" }), {
    button: 0,
    ctrlKey: false,
  });
}

describe("NovelcrafterTopBar (5A)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has a single non-accent AI settings button describing the master GEM/Persona (TC-01)", () => {
    const props = makeProps();
    render(<NovelcrafterTopBar {...props} />);

    const settings = screen.getByRole("button", { name: "Cài đặt AI" });
    expect(settings).toHaveAccessibleDescription(
      "GEM tổng: Văn xuôi trữ tình · Persona tổng: Không dùng Persona Tổng"
    );
    expect(settings.className).not.toContain("bg-(--accent)");

    for (const button of screen.getAllByRole("button")) fireEvent.click(button);
    expect(props.onOpenRoutingModal).toHaveBeenCalledTimes(1);
  });

  it("drops the GEM/Persona badges, uppercase labels and horizontal scrolling (TC-02)", () => {
    const { container } = render(<NovelcrafterTopBar {...makeProps()} />);
    expect(screen.queryByText(/novelcrafterMasterGemBadge/)).toBeNull();
    expect(screen.queryByText(/novelcrafterMasterPersonaBadge/)).toBeNull();
    const classes = Array.from(container.querySelectorAll("*")).map(
      (el) => el.getAttribute("class") ?? ""
    );
    expect(classes.filter((c) => /(^|\s)(uppercase|overflow-x-auto)(\s|$)/.test(c))).toEqual([]);
    expect(container.querySelector("header")?.querySelectorAll("button, a, input").length).toBe(5);
  });

  it("groups secondary actions in the More menu (TC-03)", () => {
    render(<NovelcrafterTopBar {...makeProps()} />);
    openMenu();

    expect(screen.getByRole("menuitem", { name: "Quản lý Prompt" })).toHaveAttribute(
      "href",
      "/novelcrafter/prompts"
    );
    expect(screen.getAllByRole("menuitemcheckbox")).toHaveLength(2);
    expect(screen.getByRole("menuitem", { name: "Xuất Markdown" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Xuất văn bản thuần" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Ngôn ngữ: Tiếng Việt" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Giao diện" })).toBeInTheDocument();
  });

  it("exports with the chosen options and switches language (TC-04)", () => {
    const props = makeProps();
    render(<NovelcrafterTopBar {...props} />);
    openMenu();
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Kèm hồ sơ truyện" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Xuất Markdown" }));
    expect(props.onExportManuscript).toHaveBeenCalledWith({
      format: "md",
      includeStoryBible: false,
      includeChapterSummaries: true,
    });

    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Ngôn ngữ: Tiếng Việt" }));
    expect(mockSetLanguage).toHaveBeenCalledWith("en");
  });

  it("omits export entries when export is unavailable (TC-05)", () => {
    render(<NovelcrafterTopBar {...makeProps({ onExportManuscript: undefined })} />);
    openMenu();
    expect(screen.queryAllByRole("menuitemcheckbox")).toHaveLength(0);
    expect(screen.queryByRole("menuitem", { name: "Xuất Markdown" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Quản lý Prompt" })).toBeInTheDocument();
  });
});
