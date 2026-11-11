// /app/features/novelcrafter/components/NovelcrafterOutlineBoard.test.tsx
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { NovelcrafterChapter } from "@/lib/features/novelcrafter/types";
import NovelcrafterOutlineBoard from "./NovelcrafterOutlineBoard";

vi.mock("../../chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "vi",
    setLanguage: vi.fn(),
    t: (key: string) =>
      ({
        novelcrafterAddChapter: "Thêm chương",
        novelcrafterOutlineStatusIdea: "Ý tưởng",
        novelcrafterOutlineStatusPlanned: "Có dàn ý",
        novelcrafterOutlineStatusDraft: "Bản nháp",
        novelcrafterOutlineStats: "{chapters} chương · {words} từ",
        novelcrafterOutlineStatsWithActs: "{acts} hồi · {chapters} chương · {words} từ",
        novelcrafterOutlineUnassignedAct: "Chưa gán hồi",
        novelcrafterOutlineChapterMeta: "{scenes} cảnh · {words} từ",
        novelcrafterOutlineNoSummary: "Chưa có tóm tắt.",
      })[key] ?? key,
    langs: ["vi", "en"] as const,
  }),
}));

function chapter(id: string, title: string, extra: Partial<NovelcrafterChapter> = {}) {
  return {
    id,
    title,
    scenes: "",
    extraInstructions: "",
    content: "",
    feedbackItems: [],
    updatedAt: 0,
    ...extra,
  } satisfies NovelcrafterChapter;
}

const CHAPTERS = [
  chapter("c1", "Bến cũ"),
  chapter("c2", "Lá thư", { summary: "Hồi ức mùa lũ.", scenes: "- Mưa\n- Đò" }),
  chapter("c3", "Gió mùa cuối", { content: "Chuyến đò cuối cùng rời bến." }),
];

describe("NovelcrafterOutlineBoard (5B)", () => {
  it("shows story stats and one card per chapter with its status (TC-05)", () => {
    render(
      <NovelcrafterOutlineBoard
        chapters={CHAPTERS}
        activeChapterId="c2"
        onOpenChapter={vi.fn()}
        onAddChapter={vi.fn()}
      />
    );
    expect(screen.getByText("3 chương · 6 từ")).toBeInTheDocument();

    const cards = screen.getAllByRole("button", { name: /Bến cũ|Lá thư|Gió mùa cuối/ });
    expect(cards).toHaveLength(3);
    expect(within(cards[0]).getByText("Ý tưởng")).toBeInTheDocument();
    expect(within(cards[0]).getByText("Chưa có tóm tắt.")).toBeInTheDocument();
    expect(within(cards[1]).getByText("Có dàn ý")).toBeInTheDocument();
    expect(within(cards[1]).getByText("2 cảnh · 0 từ")).toBeInTheDocument();
    expect(within(cards[2]).getByText("Bản nháp")).toBeInTheDocument();

    expect(cards[1]).toHaveAttribute("aria-current", "true");
    expect(cards[1].className).toContain("border-(--accent)");
    expect(cards[0]).not.toHaveAttribute("aria-current");
  });

  it("opens a chapter and adds chapters (TC-06)", () => {
    const onOpenChapter = vi.fn();
    const onAddChapter = vi.fn();
    render(
      <NovelcrafterOutlineBoard
        chapters={CHAPTERS}
        activeChapterId="c1"
        onOpenChapter={onOpenChapter}
        onAddChapter={onAddChapter}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Gió mùa cuối/ }));
    expect(onOpenChapter).toHaveBeenCalledTimes(1);
    expect(onOpenChapter).toHaveBeenCalledWith("c3");
    fireEvent.click(screen.getByRole("button", { name: "Thêm chương" }));
    expect(onAddChapter).toHaveBeenCalledTimes(1);
  });

  it("handles a story without chapters (TC-07)", () => {
    render(
      <NovelcrafterOutlineBoard
        chapters={[]}
        activeChapterId=""
        onOpenChapter={vi.fn()}
        onAddChapter={vi.fn()}
      />
    );
    expect(screen.getByText("0 chương · 0 từ")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Thêm chương" })).toBeInTheDocument();
  });

  it("groups chapters into act sections and supports onSelectChapter + double-click open (5E TC-05)", () => {
    const onSelectChapter = vi.fn();
    const onOpenChapter = vi.fn();
    const actChapters = [
      chapter("c1", "Bến cũ", { actTitle: "Hồi 1 · Rời bến", content: "một hai" }),
      chapter("c2", "Lá thư", { actTitle: "Hồi 1 · Rời bến", content: "ba" }),
      chapter("c3", "Nước lên", { actTitle: "Hồi 2 · Mùa lũ", content: "bốn năm sáu" }),
    ];

    render(
      <NovelcrafterOutlineBoard
        chapters={actChapters}
        activeChapterId="c1"
        selectedChapterId="c2"
        onSelectChapter={onSelectChapter}
        onOpenChapter={onOpenChapter}
        onAddChapter={vi.fn()}
      />
    );

    expect(screen.getByText("2 hồi · 3 chương · 6 từ")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Hồi 1 · Rời bến" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Hồi 2 · Mùa lũ" })).toBeInTheDocument();

    const c3Btn = screen.getByRole("button", { name: /Nước lên/ });
    fireEvent.click(c3Btn);
    expect(onSelectChapter).toHaveBeenCalledWith("c3");
    expect(onOpenChapter).not.toHaveBeenCalled();

    fireEvent.doubleClick(c3Btn);
    expect(onOpenChapter).toHaveBeenCalledWith("c3");
  });
});
