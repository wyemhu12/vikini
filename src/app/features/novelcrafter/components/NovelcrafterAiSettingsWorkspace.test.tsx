// /app/features/novelcrafter/components/NovelcrafterAiSettingsWorkspace.test.tsx
import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createDefaultStoryState } from "@/lib/features/novelcrafter/types";
import { parseXmlPreviewNodes } from "@/lib/features/novelcrafter/xmlPreviewHighlighter";
import { vi as viTranslations } from "@/lib/utils/translations/vi";
import NovelcrafterAiSettingsWorkspace from "./NovelcrafterAiSettingsWorkspace";
import PromptStudioXmlPreview from "./prompt-studio/PromptStudioXmlPreview";

vi.mock("../../chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "vi",
    setLanguage: vi.fn(),
    t: (key: keyof typeof viTranslations) => viTranslations[key] ?? key,
    langs: ["vi", "en"] as const,
  }),
}));

vi.mock("../../gems/stores/useGemStore", () => ({
  useGemStore: () => ({ openGemModal: vi.fn() }),
}));

vi.mock("../../personas/stores/usePersonaStore", () => ({
  usePersonaStore: () => ({ openPersonaModal: vi.fn() }),
}));

function buildDefaultProps() {
  const state = createDefaultStoryState();
  return {
    storyTitle: "Gió mùa cuối",
    selectedModel: state.selectedModel,
    allowedModelIds: new Set([state.selectedModel]),
    routing: state.routing,
    gems: [{ id: "g1", name: "Văn xuôi trữ tình" }],
    personas: [{ id: "p1", name: "Nhà văn miền Tây" }],
    onUpdateRouting: vi.fn(),
    onUpdateFeaturePersonaSlot: vi.fn(),
    onUpdateFeatureModelSlot: vi.fn(),
    state,
  };
}

describe("NovelcrafterAiSettingsWorkspace (Prompt Studio IDE & Shared Navigation)", () => {
  it("TC-U16: shows defaults and Prompt Studio tabs, navigates collapsible AI action groups with keyboard, toggles context nodes, flags sample data, and closes on Escape", async () => {
    const onClose = vi.fn();
    const { state, ...baseProps } = buildDefaultProps();

    render(
      <NovelcrafterAiSettingsWorkspace
        {...baseProps}
        onClose={onClose}
        previewSource={{ storyBible: { ...state.storyBible, synopsis: "Truyện thật" } }}
      />
    );

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByRole("tab", { name: /Prompt Studio/i }));
    expect(screen.getByRole("tab", { name: /Prompt Studio/i })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    // Preset bar renders in top utility row when Studio tab is hydrated
    expect(await screen.findByRole("button", { name: /Bộ mẫu:/i })).toBeInTheDocument();

    const promptStudioPanel = await screen.findByRole("tabpanel", {
      name: /Prompt Studio/i,
    });
    expect(promptStudioPanel).toBeInTheDocument();

    // Action navigation renders 6 accordion group buttons; initial group ("Hồ sơ & Bản thảo") is expanded with 7 options
    const actionNav = await screen.findByRole("navigation", { name: "Hành động AI" });
    const groupButtons = Array.from(
      actionNav.querySelectorAll<HTMLButtonElement>("button[aria-expanded]")
    );
    expect(groupButtons).toHaveLength(6);
    expect(groupButtons[0]).toHaveAttribute("aria-expanded", "true");
    expect(groupButtons[0]).toHaveTextContent("Hồ sơ & Bản thảo");
    for (const btn of groupButtons.slice(1)) {
      expect(btn).toHaveAttribute("aria-expanded", "false");
    }

    const initialOptions = within(actionNav).getAllByRole("option");
    expect(initialOptions).toHaveLength(7);
    const selectedOption = initialOptions.find((o) => o.getAttribute("aria-selected") === "true")!;
    expect(selectedOption).toHaveAttribute("data-action-key", "bible:draft");

    // ArrowDown on selected option moves from bible:draft to bible:chapter_summary
    fireEvent.keyDown(selectedOption, { key: "ArrowDown" });
    await waitFor(() => {
      const summaryOpt = within(actionNav)
        .getAllByRole("option")
        .find((o) => o.getAttribute("data-action-key") === "bible:chapter_summary");
      expect(summaryOpt).toHaveAttribute("aria-selected", "true");
    });

    // Expand "Gợi ý ý tưởng" (10 actions -> 7 + 10 = 17 visible options) and press End on active option
    fireEvent.click(within(actionNav).getByRole("button", { name: /Gợi ý ý tưởng/i }));
    const expandedOptions = within(actionNav).getAllByRole("option");
    expect(expandedOptions).toHaveLength(17);

    const activeOptBeforeEnd = expandedOptions.find(
      (o) => o.getAttribute("aria-selected") === "true"
    )!;
    fireEvent.keyDown(activeOptBeforeEnd, { key: "End" });
    await waitFor(() => {
      const latestOptions = within(actionNav).getAllByRole("option");
      const lastOpt = latestOptions[latestOptions.length - 1];
      expect(lastOpt).toHaveAttribute("data-action-key", "brainstorm:titles");
      expect(lastOpt).toHaveAttribute("aria-selected", "true");
    });

    // Token badge and sample data notice render in XML preview
    expect(screen.getByText(/≈.*token/i)).toBeInTheDocument();
    expect(screen.getByText(viTranslations.novelcrafterPreviewSampleNotice)).toBeInTheDocument();

    // Toggle an optional context checkbox
    const checkboxes = promptStudioPanel.querySelectorAll('input[type="checkbox"]:not(:disabled)');
    expect(checkboxes.length).toBeGreaterThan(0);
    const firstOptional = checkboxes[0] as HTMLInputElement;
    const beforeChecked = firstOptional.checked;
    fireEvent.click(firstOptional);
    expect(firstOptional.checked).toBe(!beforeChecked);

    // Escape closes workspace when no modal/dropdown is open
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("TC-NAV-01: renders single shared Back to Studio button across both tabs without duplicating storyTitle, and supports backHref + initialTab='studio'", async () => {
    const onClose = vi.fn();
    const { state: _state, ...baseProps } = buildDefaultProps();

    const { unmount } = render(
      <NovelcrafterAiSettingsWorkspace {...baseProps} onClose={onClose} />
    );

    // On defaults tab: strictly 1 Back button and strictly 1 storyTitle element
    const backButtonsDefaults = screen.getAllByRole("button", { name: /Quay lại Studio/i });
    expect(backButtonsDefaults).toHaveLength(1);
    expect(screen.getAllByText("Gió mùa cuối")).toHaveLength(1);

    // Switch to Prompt Studio tab: Back button persists and calls onClose
    fireEvent.click(screen.getByRole("tab", { name: /Prompt Studio/i }));
    const backButtonsStudio = await screen.findAllByRole("button", { name: /Quay lại Studio/i });
    expect(backButtonsStudio).toHaveLength(1);
    fireEvent.click(backButtonsStudio[0]);
    expect(onClose).toHaveBeenCalledTimes(1);

    unmount();

    // Standalone /novelcrafter/prompts mode: backHref + initialTab="studio"
    render(
      <NovelcrafterAiSettingsWorkspace
        {...baseProps}
        backHref="/novelcrafter"
        initialTab="studio"
      />
    );

    expect(screen.getByRole("tab", { name: /Prompt Studio/i })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    const studioBackLink = screen.getByRole("link", { name: /Quay lại Studio/i });
    expect(studioBackLink).toHaveAttribute("href", "/novelcrafter");

    fireEvent.click(screen.getByRole("tab", { name: /Mặc định & thừa kế/i }));
    const defaultsBackLink = screen.getByRole("link", { name: /Quay lại Studio/i });
    expect(defaultsBackLink).toHaveAttribute("href", "/novelcrafter");
  });

  it("TC-A11Y-01: prevents roving tabIndex deadlock when collapsing active group, ignores arrow keys on accordion headers, and keeps h1 -> h2 -> h3 order", async () => {
    const { state: _state, ...baseProps } = buildDefaultProps();

    render(<NovelcrafterAiSettingsWorkspace {...baseProps} initialTab="studio" />);

    const actionNav = await screen.findByRole("navigation", { name: "Hành động AI" });

    // Heading hierarchy h1 -> h2 -> h3 on Studio tab
    expect(screen.getByRole("heading", { level: 1, name: "Prompt Studio" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Hành động AI" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: viTranslations.novelcrafterPromptActionBibleDraft,
      })
    ).toBeInTheDocument();

    const bibleGroupBtn = within(actionNav).getByRole("button", { name: /Hồ sơ & Bản thảo/i });
    const writeGroupBtn = within(actionNav).getByRole("button", { name: /^Viết tiếp/i });

    // Firing ArrowDown / End on accordion group header button MUST NOT hijack selection
    fireEvent.keyDown(bibleGroupBtn, { key: "ArrowDown" });
    fireEvent.keyDown(bibleGroupBtn, { key: "End" });
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: viTranslations.novelcrafterPromptActionBibleDraft,
      })
    ).toBeInTheDocument();

    // Collapse active group ("bible") and expand "write": write:auto automatically receives tabIndex="0"
    fireEvent.click(bibleGroupBtn);
    fireEvent.click(writeGroupBtn);

    const visibleOptions = within(actionNav).getAllByRole("option");
    expect(visibleOptions).toHaveLength(5);
    expect(visibleOptions[0]).toHaveAttribute("data-action-key", "write:auto");
    expect(visibleOptions[0]).toHaveAttribute("tabIndex", "0");
    for (const opt of visibleOptions.slice(1)) {
      expect(opt).toHaveAttribute("tabIndex", "-1");
    }

    // Pressing ArrowDown on write:auto selects write:guided
    fireEvent.keyDown(visibleOptions[0], { key: "ArrowDown" });
    await waitFor(() => {
      const guidedOpt = within(actionNav)
        .getAllByRole("option")
        .find((o) => o.getAttribute("data-action-key") === "write:guided");
      expect(guidedOpt).toHaveAttribute("aria-selected", "true");
    });
  });

  it("TC-SYNC-01 & Negative Probes 2-3: uses valid sibling <label> + <button>, gates Crosshair by presentContextNodes, syncs hover/scroll on element blocks only, and blocks XSS", async () => {
    const { state, ...baseProps } = buildDefaultProps();
    const scrollIntoViewMock = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewMock,
    });

    const { container } = render(
      <NovelcrafterAiSettingsWorkspace
        {...baseProps}
        initialTab="studio"
        previewSource={{
          storyBible: {
            ...state.storyBible,
            synopsis: "Truyện <script>alert(1)</script>",
          },
          chapter: {
            title: "Chương 2",
            content: "Đoạn văn đang viết dở trong chương 2.",
            scenes: "- Phân cảnh 1",
            summary: "",
            extraInstructions: "",
          },
          previousChapterProseTail: "Đoạn kết chương 1.",
          previousChapterSummaries: "Tóm tắt chương 1.",
        }}
      />
    );

    const previewRegion = await screen.findByRole("region", { name: "Xem trước prompt" });

    // 1. Sibling <label> + <button> HTML5 structure on synopsis chip
    const synopsisChip = container.querySelector(
      'div[data-context-node="synopsis"]'
    ) as HTMLDivElement;
    expect(synopsisChip).not.toBeNull();
    const synopsisLabel = synopsisChip.querySelector("label")!;
    const synopsisLocateBtn = within(synopsisChip).getByRole("button", {
      name: /<synopsis>/i,
    });
    expect(synopsisLabel.contains(synopsisLocateBtn)).toBe(false);

    // 2. Two-way hover highlight & Crosshair scroll without toggling checkbox
    const synopsisCheckbox = synopsisChip.querySelector(
      'input[type="checkbox"]'
    ) as HTMLInputElement;
    expect(synopsisCheckbox.checked).toBe(true);

    const synopsisXmlBlock = previewRegion.querySelector(
      '[data-context-node="synopsis"]'
    ) as HTMLElement;
    expect(synopsisXmlBlock).not.toBeNull();

    fireEvent.mouseEnter(synopsisChip);
    expect(synopsisChip).toHaveAttribute("data-highlighted", "true");
    expect(synopsisXmlBlock).toHaveAttribute("data-highlighted", "true");

    fireEvent.mouseLeave(synopsisChip);
    expect(synopsisChip).not.toHaveAttribute("data-highlighted");
    expect(synopsisXmlBlock).not.toHaveAttribute("data-highlighted");

    fireEvent.mouseEnter(synopsisXmlBlock);
    expect(synopsisChip).toHaveAttribute("data-highlighted", "true");
    expect(synopsisXmlBlock).toHaveAttribute("data-highlighted", "true");

    fireEvent.click(synopsisLocateBtn);
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
    expect(synopsisCheckbox.checked).toBe(true);

    // 3. Negative Probe 2 (XSS): typing raw <img> in directive & <script> in synopsis creates zero DOM img/script tags
    const directiveInput = screen.getByLabelText(
      viTranslations.novelcrafterPromptStudioDirectiveLabel
    );
    fireEvent.change(directiveInput, {
      target: { value: "Write vividly <img src=x onerror=alert(1)>" },
    });
    expect(previewRegion.querySelector("script")).toBeNull();
    expect(previewRegion.querySelector("img")).toBeNull();
    expect(previewRegion.textContent).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(previewRegion.textContent).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");

    // Direct unescaped XML into PromptStudioXmlPreview also renders strictly text nodes (no img/script DOM)
    const rawXssXml =
      "<feature_instruction><img src=x onerror=alert(1)>&lt;script&gt;alert(1)&lt;/script&gt;</feature_instruction>";
    const { container: directPreviewContainer, unmount: unmountDirectPreview } = render(
      <PromptStudioXmlPreview
        previewResult={{ ok: true, xml: rawXssXml }}
        parsedNodes={parseXmlPreviewNodes(rawXssXml)}
        highlightedNode={null}
        scrollRequest={null}
        onHoverNode={vi.fn()}
      />
    );
    expect(directPreviewContainer.querySelector("img")).toBeNull();
    expect(directPreviewContainer.querySelector("script")).toBeNull();
    expect(directPreviewContainer.textContent).toContain("<img src=x onerror=alert(1)>");
    expect(directPreviewContainer.textContent).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    unmountDirectPreview();

    // 4. Negative Probe 3 ("bible:chapter_summary"): inline <scenes> & <preceding_prose> inside <feature_instruction> do NOT duplicate [data-context-node]
    const actionNav = screen.getByRole("navigation", { name: "Hành động AI" });
    const summaryActionBtn = within(actionNav)
      .getAllByRole("option")
      .find((o) => o.getAttribute("data-action-key") === "bible:chapter_summary")!;
    fireEvent.click(summaryActionBtn);

    await waitFor(() => {
      expect(previewRegion.querySelectorAll('[data-context-node="scenes"]')).toHaveLength(1);
      expect(previewRegion.querySelectorAll('[data-context-node="preceding_prose"]')).toHaveLength(
        1
      );
    });

    const scenesChip = container.querySelector('div[data-context-node="scenes"]') as HTMLDivElement;
    const scenesCheckbox = scenesChip.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(scenesCheckbox.disabled).toBe(true);
    const scenesLocateBtn = within(scenesChip).getByRole("button", { name: /<scenes>/i });
    fireEvent.click(scenesLocateBtn);
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(2);
    expect(scenesCheckbox.checked).toBe(true);

    // 5. Switch to "write:auto" where chapter.content is non-empty -> continuityDataGuard omits <previous_chapter_continuity>
    fireEvent.click(within(actionNav).getByRole("button", { name: /^Viết tiếp/i }));
    const writeAutoBtn = within(actionNav)
      .getAllByRole("option")
      .find((o) => o.getAttribute("data-action-key") === "write:auto")!;
    fireEvent.click(writeAutoBtn);

    const prevContChip = container.querySelector(
      'div[data-context-node="previous_chapter_continuity"]'
    ) as HTMLDivElement;
    const prevContCheckbox = prevContChip.querySelector(
      'input[type="checkbox"]'
    ) as HTMLInputElement;
    expect(prevContCheckbox.checked).toBe(true);
    expect(within(prevContChip).queryByRole("button")).toBeNull();
    expect(within(scenesChip).getByRole("button", { name: /<scenes>/i })).toBeInTheDocument();
  });
});
