// /app/features/novelcrafter/components/NovelcrafterOutlineDetailPanel.test.tsx
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StoryBibleSchema, type NovelcrafterChapter } from "@/lib/features/novelcrafter/types";
import NovelcrafterOutlineDetailPanel from "./NovelcrafterOutlineDetailPanel";

const DICT: Record<string, string> = {
  novelcrafterChapterPrefix: "Chương",
  novelcrafterChapterActLabel: "Hồi / Phần",
  novelcrafterChapterActPlaceholder: "Ví dụ: Hồi 1 · Rời bến",
  novelcrafterOutlineDetailAria: "Chi tiết chương {number}",
  novelcrafterOutlineCloseDetail: "Đóng chi tiết",
  novelcrafterChapterSummaryLabel: "Tóm tắt chương",
  novelcrafterChapterBeatsLabel: "Phân cảnh Chương",
  novelcrafterOutlineEditWithAi: "Sửa bằng AI",
  novelcrafterOutlineAddBeat: "+ Thêm phân cảnh",
  novelcrafterOutlineBeatInputAria: "Phân cảnh {number}",
  novelcrafterOutlineRemoveBeatAria: "Xóa phân cảnh {number}",
  novelcrafterOutlineAiContextTitle: "AI sẽ đọc khi viết chương này",
  novelcrafterOutlineContextPrevChapters: "{count} chương trước",
  novelcrafterSynopsisLabel: "Tóm tắt cốt truyện",
  novelcrafterStyleLabel: "Văn phong",
  novelcrafterDraftChapterBtn: "Viết bản nháp chương",
  novelcrafterOutlineOpenInWriteBtn: "Mở trong bàn viết",
  novelcrafterRenameChapter: "Đổi tên chương",
};

vi.mock("../../chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "vi",
    setLanguage: vi.fn(),
    t: (key: string) => DICT[key] ?? key,
    langs: ["vi", "en"] as const,
  }),
}));

describe("NovelcrafterOutlineDetailPanel (5E TC-04)", () => {
  const chapter: NovelcrafterChapter = {
    id: "c4",
    title: "Làng Đông",
    actTitle: "Hồi 1 · Rời bến",
    summary: "Lam về tới Làng Đông dưới mưa.",
    scenes: "- Lam đi bộ từ bến vào làng\n- Ngôi nhà cũ đã có người ở",
    extraInstructions: "",
    content: "",
    feedbackItems: [],
    updatedAt: 0,
  };

  const storyBible = StoryBibleSchema.parse({
    synopsis: "Hành trình trở về.",
    synopsisVisibleToAI: true,
    characterCards: [{ id: "ch-lam", name: "Lam", visibleToAI: true }],
  });

  it("edits summary & beats, shows AI context chips, triggers AI draft/scenes, and opens in Write", () => {
    const onUpdateChapter = vi.fn();
    const onTriggerStream = vi.fn();
    const onOpenChapter = vi.fn();

    render(
      <NovelcrafterOutlineDetailPanel
        chapter={chapter}
        chapterIndex={3}
        storyBible={storyBible}
        isStreaming={false}
        onUpdateChapter={onUpdateChapter}
        onTriggerStream={onTriggerStream}
        onStopStream={vi.fn()}
        onOpenChapter={onOpenChapter}
        onClose={vi.fn()}
      />
    );

    const aside = screen.getByRole("complementary", { name: "Chi tiết chương 4" });
    expect(aside).toBeInTheDocument();
    expect(screen.getByText("Phân cảnh Chương")).toBeInTheDocument();
    expect(screen.queryByText("novelcrafterScenesLabel")).not.toBeInTheDocument();

    // Context chips
    expect(screen.getByText("Lam")).toBeInTheDocument();
    expect(screen.getByText("3 chương trước")).toBeInTheDocument();

    // Update summary
    fireEvent.change(screen.getByLabelText("Tóm tắt chương"), {
      target: { value: "Tóm tắt mới cho chương 4." },
    });
    expect(onUpdateChapter).toHaveBeenCalledWith("c4", { summary: "Tóm tắt mới cho chương 4." });

    // Add scene beat
    fireEvent.click(screen.getByRole("button", { name: "+ Thêm phân cảnh" }));
    expect(onUpdateChapter).toHaveBeenCalledWith(
      "c4",
      expect.objectContaining({
        scenes: expect.stringContaining("- Lam đi bộ từ bến vào làng"),
      })
    );

    // Refine beats with AI
    fireEvent.click(screen.getByRole("button", { name: "Sửa bằng AI" }));
    expect(onTriggerStream).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: "bible",
        bibleTarget: "scenes",
      })
    );

    // Write chapter draft CTA
    fireEvent.click(screen.getByRole("button", { name: "Viết bản nháp chương" }));
    expect(onTriggerStream).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: "bible",
        bibleTarget: "draft",
      })
    );

    // Open in Write view
    fireEvent.click(screen.getByRole("button", { name: "Mở trong bàn viết" }));
    expect(onOpenChapter).toHaveBeenCalledWith("c4");
  });
});
