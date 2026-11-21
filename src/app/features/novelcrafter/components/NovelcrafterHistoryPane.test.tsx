// /app/features/novelcrafter/components/NovelcrafterHistoryPane.test.tsx
import React from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNovelcrafterStreamStore } from "@/lib/features/novelcrafter/novelcrafterStreamStore";
import NovelcrafterHistoryPane from "./NovelcrafterHistoryPane";

vi.mock("../../chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "vi",
    setLanguage: vi.fn(),
    t: (key: string) => key,
    langs: ["vi", "en"] as const,
  }),
}));

vi.mock("./NovelcrafterHistoryCardItem", () => ({
  default: () => <div data-testid="history-card" />,
}));

vi.mock("./NovelcrafterCardMetaBadges", () => ({
  default: ({ model }: { model?: string }) => <div data-testid="meta-badges">{model ?? ""}</div>,
}));

describe("NovelcrafterHistoryPane — 60fps leaf subscription (TC-W2B-11)", () => {
  beforeEach(() => {
    useNovelcrafterStreamStore.getState().resetStreamStore();
  });

  afterEach(() => {
    useNovelcrafterStreamStore.getState().resetStreamStore();
  });

  it("renders live streaming updates directly from useNovelcrafterStreamStore without re-rendering parent", () => {
    let parentRenderCount = 0;

    function ParentHarness() {
      parentRenderCount += 1;
      return (
        <NovelcrafterHistoryPane
          historyCards={[]}
          isStreaming={false}
          hasActiveSelection={false}
          onAppendToChapter={vi.fn()}
          onReplaceSelection={vi.fn()}
          onApplyToBible={vi.fn()}
          onDeleteCard={vi.fn()}
          onClearAllCards={vi.fn()}
        />
      );
    }

    render(<ParentHarness />);
    expect(parentRenderCount).toBe(1);
    expect(screen.getByText("novelcrafterHistoryEmpty")).toBeInTheDocument();

    act(() => {
      const store = useNovelcrafterStreamStore.getState();
      store.beginStreamRun("run-1", {
        feature: "write",
        subLabel: "Auto Write",
        model: "gemini-3.8-flash",
        gemName: null,
        personaName: null,
      });
      store.flushStreamSnapshot("run-1", "Chunk 1", "Think 1");
    });

    expect(screen.getByText("Auto Write")).toBeInTheDocument();
    expect(screen.getByText("Think 1")).toBeInTheDocument();
    expect(screen.getByText("Chunk 1")).toBeInTheDocument();
    expect(parentRenderCount).toBe(1);

    act(() => {
      useNovelcrafterStreamStore.getState().flushStreamSnapshot("run-1", "Chunk 2", "Think 1");
    });

    expect(screen.getByText("Chunk 2")).toBeInTheDocument();
    expect(screen.queryByText("Chunk 1")).not.toBeInTheDocument();
    expect(parentRenderCount).toBe(1);

    act(() => {
      useNovelcrafterStreamStore.getState().finishStreamRun("run-1");
    });

    expect(screen.queryByText("Chunk 2")).not.toBeInTheDocument();
    expect(parentRenderCount).toBe(1);
  });
});
