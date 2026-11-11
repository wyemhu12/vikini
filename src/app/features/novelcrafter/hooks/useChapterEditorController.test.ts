import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useChapterEditorController } from "./useChapterEditorController";
import type { NovelcrafterChapter } from "@/lib/features/novelcrafter/types";

function makeChapter(id: string, content: string): NovelcrafterChapter {
  return {
    id,
    title: `Chapter ${id}`,
    scenes: "",
    extraInstructions: "",
    content,
    feedbackItems: [],
    updatedAt: 0,
  };
}

describe("useChapterEditorController draft preservation (TC-6E-05)", () => {
  it("preserves quickEdit state when chapterContent changes within the same chapterId, and resets when chapterId changes", () => {
    const feedbackPane = {
      isOpen: false,
      open: vi.fn(),
      close: vi.fn(),
      toggle: vi.fn(),
    };

    const { result, rerender } = renderHook(
      ({ chapter }) =>
        useChapterEditorController({
          chapter,
          selection: { start: 0, end: 5, text: "Hello" },
          onSelectionChange: vi.fn(),
          isStreaming: false,
          onTriggerStream: vi.fn().mockResolvedValue(undefined),
          onUpdateChapter: vi.fn(),
          onUpdateFeedbackItems: vi.fn(),
          feedbackPane,
        }),
      { initialProps: { chapter: makeChapter("ch-1", "") } }
    );

    expect(result.current.beatsOpen).toBe(true);

    act(() => {
      result.current.quickEdit.onToggle();
      result.current.quickEdit.onChangePrompt("Make dialogue sharper");
    });

    expect(result.current.quickEdit.open).toBe(true);
    expect(result.current.quickEdit.prompt).toBe("Make dialogue sharper");

    // Same chapterId, updated content -> must NOT reset quickEditOpen or quickEditPrompt
    rerender({ chapter: makeChapter("ch-1", "Hello world, updated manuscript!") });
    expect(result.current.quickEdit.open).toBe(true);
    expect(result.current.quickEdit.prompt).toBe("Make dialogue sharper");

    // Different chapterId with non-empty content -> resets quickEdit and sets beatsOpen=false
    rerender({ chapter: makeChapter("ch-2", "Non-empty second chapter") });
    expect(result.current.quickEdit.open).toBe(false);
    expect(result.current.quickEdit.prompt).toBe("");
    expect(result.current.beatsOpen).toBe(false);
  });
});
