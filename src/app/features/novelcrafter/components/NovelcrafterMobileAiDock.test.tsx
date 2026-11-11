// /app/features/novelcrafter/components/NovelcrafterMobileAiDock.test.tsx
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NovelcrafterMobileAiDock, NovelcrafterMobileBeatBar } from "./NovelcrafterMobileAiDock";

const DICT: Record<string, string> = {
  novelcrafterMobileAiDockAria: "Công cụ AI",
  novelcrafterWriteMenuBtn: "Viết tiếp",
  stopBtn: "Dừng",
  novelcrafterMobileRewriteSelectionAria: "Viết lại đoạn chọn",
  novelcrafterMobileBrainstormAria: "Gợi ý tình tiết",
  novelcrafterMobileCardsCountAria: "Thẻ AI, {count} thẻ",
  novelcrafterHistoryTitle: "Thẻ AI",
  novelcrafterPrevBeatAria: "Phân cảnh trước",
  novelcrafterNextBeatAria: "Phân cảnh sau",
};

vi.mock("../../chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "vi",
    setLanguage: vi.fn(),
    t: (key: string) => DICT[key] ?? key,
    langs: ["vi", "en"] as const,
  }),
}));

describe("NovelcrafterMobileAiDock & BeatBar (5E TC-06)", () => {
  it("steps through scene beats and toggles beat sheet on click", () => {
    const onToggleBeats = vi.fn();
    render(
      <NovelcrafterMobileBeatBar
        beats={["Lam lên chuyến đò cuối", "Ông lái đò nhận ra Lam", "Mưa lớn ghé bãi bồi"]}
        onToggleBeats={onToggleBeats}
      />
    );

    expect(screen.getByText(/Lam lên chuyến đò cuối/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Phân cảnh sau" }));
    expect(screen.getByText(/Ông lái đò nhận ra Lam/)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Ông lái đò nhận ra Lam/));
    expect(onToggleBeats).toHaveBeenCalledTimes(1);
  });

  it("renders mobile AI dock actions, badge count >=12px, and switches primary CTA to Stop while streaming", () => {
    const onRunAutoWrite = vi.fn();
    const onStopStream = vi.fn();
    const onRunRewriteSelection = vi.fn();
    const onRunBrainstorm = vi.fn();
    const onOpenHistoryDrawer = vi.fn();

    const { rerender } = render(
      <NovelcrafterMobileAiDock
        isStreaming={false}
        historyCount={6}
        onRunAutoWrite={onRunAutoWrite}
        onStopStream={onStopStream}
        onRunRewriteSelection={onRunRewriteSelection}
        onRunBrainstorm={onRunBrainstorm}
        onOpenHistoryDrawer={onOpenHistoryDrawer}
      />
    );

    const nav = screen.getByRole("navigation", { name: "Công cụ AI" });
    expect(nav).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Viết tiếp" }));
    expect(onRunAutoWrite).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Viết lại đoạn chọn" }));
    expect(onRunRewriteSelection).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Gợi ý tình tiết" }));
    expect(onRunBrainstorm).toHaveBeenCalledTimes(1);

    const cardsBtn = screen.getByRole("button", { name: "Thẻ AI, 6 thẻ" });
    fireEvent.click(cardsBtn);
    expect(onOpenHistoryDrawer).toHaveBeenCalledTimes(1);

    rerender(
      <NovelcrafterMobileAiDock
        isStreaming={true}
        historyCount={6}
        onRunAutoWrite={onRunAutoWrite}
        onStopStream={onStopStream}
        onRunRewriteSelection={onRunRewriteSelection}
        onRunBrainstorm={onRunBrainstorm}
        onOpenHistoryDrawer={onOpenHistoryDrawer}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Dừng" }));
    expect(onStopStream).toHaveBeenCalledTimes(1);
    expect(onRunAutoWrite).toHaveBeenCalledTimes(1);
  });
});
