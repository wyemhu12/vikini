// /app/features/novelcrafter/components/NovelcrafterViewPanel.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { StoryBibleSchema, type NovelcrafterChapter } from "@/lib/features/novelcrafter/types";
import NovelcrafterViewPanel, { type NovelcrafterViewPanelStory } from "./NovelcrafterViewPanel";
import type { NovelcrafterViewIds } from "./NovelcrafterViewTabs";

vi.mock("../../chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "vi",
    setLanguage: vi.fn(),
    t: (key: string) => key,
    langs: ["vi", "en"] as const,
  }),
}));

const IDS: NovelcrafterViewIds = {
  tab: (v) => `tab-${v}`,
  panel: (v) => `panel-${v}`,
};

function makeChapter(id: string, title: string, scenes = ""): NovelcrafterChapter {
  return {
    id,
    title,
    scenes,
    extraInstructions: "",
    content: "",
    feedbackItems: [],
    updatedAt: 0,
  };
}

function makeStory(scenes = ""): NovelcrafterViewPanelStory {
  const c1 = makeChapter("c1", "Chương 1", scenes);
  const c2 = makeChapter("c2", "Chương 2");
  return {
    storyState: {
      chapters: [c1, c2],
      storyBible: StoryBibleSchema.parse({
        outlineItems: [
          {
            id: "o1",
            kind: "chapter",
            title: "Mở màn",
            summary: "- Cảnh A",
            visibleToAI: true,
          },
        ],
      }),
    },
    activeChapter: c1,
    addChapter: vi.fn(),
    selectChapter: vi.fn(),
    updateChapter: vi.fn(),
    updateStoryBible: vi.fn(),
  };
}

describe("NovelcrafterViewPanel (5B)", () => {
  it("wraps write view children in a labelled tabpanel", () => {
    render(
      <NovelcrafterViewPanel
        view="write"
        ids={IDS}
        story={makeStory()}
        bibleNav={{ section: "braindump", jump: null }}
        isStreaming={false}
        onTriggerStream={vi.fn().mockResolvedValue(undefined)}
        onReturnToWrite={vi.fn()}
      >
        <div data-testid="write-body">Manuscript</div>
      </NovelcrafterViewPanel>
    );
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAttribute("id", "panel-write");
    expect(panel).toHaveAttribute("aria-labelledby", "tab-write");
    expect(screen.getByTestId("write-body")).toBeInTheDocument();
  });

  it("hides write children in outline view, selects chapter into detail panel on card click, and returns to write on Open in Write (5E Loại C)", () => {
    const story = makeStory();
    const onReturnToWrite = vi.fn();
    render(
      <NovelcrafterViewPanel
        view="outline"
        ids={IDS}
        story={story}
        bibleNav={{ section: "braindump", jump: null }}
        isStreaming={false}
        onTriggerStream={vi.fn().mockResolvedValue(undefined)}
        onReturnToWrite={onReturnToWrite}
      >
        <div data-testid="write-body">Manuscript</div>
      </NovelcrafterViewPanel>
    );
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAttribute("id", "panel-outline");
    expect(panel).toHaveAttribute("aria-labelledby", "tab-outline");
    expect(screen.queryByTestId("write-body")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Chương 2/ }));
    expect(story.selectChapter).toHaveBeenCalledWith("c2");
    expect(onReturnToWrite).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "novelcrafterOutlineOpenInWriteBtn" }));
    expect(onReturnToWrite).toHaveBeenCalledWith({ clearSelection: true });
  });

  it("sends outline beats to active chapter scenes in bible view without double scroll wrappers", () => {
    const story = makeStory("- Cảnh cũ");
    const onReturnToWrite = vi.fn();
    render(
      <NovelcrafterViewPanel
        view="bible"
        ids={IDS}
        story={story}
        bibleNav={{ section: "outline", jump: null }}
        isStreaming={false}
        onTriggerStream={vi.fn().mockResolvedValue(undefined)}
        onReturnToWrite={onReturnToWrite}
      >
        <div data-testid="write-body">Manuscript</div>
      </NovelcrafterViewPanel>
    );
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAttribute("id", "panel-bible");
    expect(panel.className).not.toContain("overflow-y-auto");
    expect(screen.queryByTestId("write-body")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "novelcrafterSendToChapterScenesBtn" }));
    expect(story.updateChapter).toHaveBeenCalledWith("c1", {
      scenes: "- Cảnh cũ\n\n- Cảnh A",
    });
    expect(onReturnToWrite).toHaveBeenCalledWith({ openBeats: true });
  });
});
