// /app/features/novelcrafter/components/NovelcrafterA11yNames.test.tsx
// 3D (C3): icon-only-on-mobile Novelcrafter buttons keep an accessible name.
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { StoryBibleSchema, type NovelcrafterHistoryCard } from "@/lib/features/novelcrafter/types";
import NovelcrafterTopBar from "./NovelcrafterTopBar";
import NovelcrafterHistoryPane from "./NovelcrafterHistoryPane";
import { StoryBibleOutlineItemsList } from "./StoryBibleStructuredCards";

const DICT: Record<string, string> = {
  novelcrafterRoutingButton: "Cài đặt GEM & Persona",
  novelcrafterExpandAllCards: "Mở rộng tất cả",
  novelcrafterCollapseAllCards: "Thu gọn tất cả",
  novelcrafterSendToChapterScenesBtn: "Đẩy sang Phân cảnh Chương",
};

vi.mock("../../chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "vi",
    setLanguage: vi.fn(),
    t: (key: string) => DICT[key] ?? key,
    langs: ["vi", "en"] as const,
  }),
}));

vi.mock("@/app/features/chat/components/ModelSelector", () => ({
  default: () => <div data-testid="model-selector" />,
}));

vi.mock("../../layout/components/ThemeMenuItems", () => ({
  default: () => null,
}));

vi.mock("./NovelcrafterHistoryCardItem", () => ({
  default: () => <div data-testid="history-card" />,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const CARD: NovelcrafterHistoryCard = {
  id: "card-1",
  feature: "write",
  subLabel: "Auto Write",
  content: "Đoạn văn mẫu.",
  model: "gemini-3.8-flash",
  createdAt: 1700000000000,
};

describe("Novelcrafter accessible names (3D TC-04)", () => {
  it("names the GEM & Persona routing button even when its label is hidden on mobile", () => {
    render(
      <NovelcrafterTopBar
        storyTitle="Truyện"
        onRenameTitle={vi.fn()}
        selectedModel="gemini-3.8-flash"
        onSelectModel={vi.fn()}
        allowedModelIds={new Set<string>()}
        masterGem={null}
        masterPersona={null}
        saveStatus="saved"
        chapterWordCount={0}
        onRetrySave={vi.fn()}
        onOpenRoutingModal={vi.fn()}
        showLeftPane
        onToggleLeftPane={vi.fn()}
        showRightPane
        onToggleRightPane={vi.fn()}
      />
    );
    // jsdom ignores `hidden sm:inline`, so assert the explicit aria-label that survives on mobile.
    expect(screen.getByRole("button", { name: "Cài đặt GEM & Persona" })).toHaveAttribute(
      "aria-label",
      "Cài đặt GEM & Persona"
    );
  });

  it("names the expand/collapse-all toggle by its current action", () => {
    render(
      <NovelcrafterHistoryPane
        historyCards={[CARD]}
        isStreaming={false}
        streamingContent=""
        streamingThinking=""
        streamingMeta={null}
        hasActiveSelection={false}
        onAppendToChapter={vi.fn()}
        onReplaceSelection={vi.fn()}
        onApplyToBible={vi.fn()}
        onDeleteCard={vi.fn()}
        onClearAllCards={vi.fn()}
      />
    );
    const toggle = screen.getByRole("button", { name: /^(Mở rộng tất cả|Thu gọn tất cả)$/ });
    const before = toggle.getAttribute("aria-label");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-label")).not.toBe(before);
  });

  it("names the send-to-chapter-scenes button", () => {
    const storyBible = StoryBibleSchema.parse({
      outlineItems: [{ id: "o1", type: "chapter", title: "Chương 1", summary: "Mở đầu" }],
    });
    render(
      <StoryBibleOutlineItemsList
        storyBible={storyBible}
        onUpdateStoryBible={vi.fn()}
        onSendToChapterScenes={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Đẩy sang Phân cảnh Chương" })).toHaveAttribute(
      "aria-label",
      "Đẩy sang Phân cảnh Chương"
    );
  });
});
