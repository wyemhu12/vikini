// /app/features/novelcrafter/components/NovelcrafterAiComposer.test.tsx
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NovelcrafterRoutingConfigSchema } from "@/lib/features/novelcrafter/types";
import NovelcrafterAiComposer from "./NovelcrafterAiComposer";

const DICT: Record<string, string> = {
  novelcrafterComposerFormAria: "Soạn lệnh AI",
  novelcrafterComposerActionAria: "Nhóm lệnh AI",
  novelcrafterComposerModeGroupAria: "Chế độ thực thi",
  novelcrafterComposerPromptAria: "Hướng đi hoặc yêu cầu thêm",
  novelcrafterComposerPromptPlaceholder: "Gợi ý hướng đi cho AI (tùy chọn)…",
  novelcrafterComposerLengthSentence: "Câu",
  novelcrafterComposerLengthParagraph: "Đoạn",
  novelcrafterComposerLengthScene: "Cảnh",
  novelcrafterComposerPromptSourceAria: "Nguồn prompt đang dùng",
  novelcrafterComposerPromptSourceSummary: "GEM Tổng: {gem} · Persona: {persona}",
  novelcrafterComposerNoneShort: "chưa gắn",
  novelcrafterInheritShort: "Kế thừa",
  novelcrafterDisablePersonaShort: "Tắt",
  novelcrafterWriteLengthLabel: "Độ dài",
  novelcrafterSlotWrite: "Viết tiếp",
  novelcrafterWriteAuto: "Tự động",
  novelcrafterWriteGuided: "Chỉ dẫn",
  novelcrafterWriteToneShift: "Đổi giọng",
  novelcrafterSlotRewrite: "Viết lại",
  novelcrafterSlotExpand: "Mở rộng",
  novelcrafterSlotFeedback: "Nhận xét",
  novelcrafterSlotBrainstorm: "Gợi ý tình tiết",
  novelcrafterRewriteRephrase: "Diễn đạt lại",
  novelcrafterRewriteShorter: "Rút gọn",
  novelcrafterRewriteCustom: "Tự viết",
  stopBtn: "Dừng",
};

vi.mock("../../chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "vi",
    setLanguage: vi.fn(),
    t: (key: string) => DICT[key] ?? key,
    langs: ["vi", "en"] as const,
  }),
}));

describe("NovelcrafterAiComposer (5E TC-03)", () => {
  const routing = NovelcrafterRoutingConfigSchema.parse({
    masterGemId: "gem-1",
    masterPersonaId: "per-1",
  });

  it("switches write mode & length preset, displays prompt source, and submits stream params", () => {
    const onTriggerStream = vi.fn();
    const onOpenAiSettings = vi.fn();

    render(
      <NovelcrafterAiComposer
        isStreaming={false}
        hasActiveSelection={false}
        selectedModel="gemini-2.5-flash"
        routing={routing}
        gems={[{ id: "gem-1", name: "Văn xuôi trữ tình" }]}
        personas={[{ id: "per-1", name: "Nhà văn miền Tây" }]}
        onTriggerStream={onTriggerStream}
        onStopStream={vi.fn()}
        onOpenAiSettings={onOpenAiSettings}
      />
    );

    const guidedRadio = screen.getByRole("radio", { name: "Chỉ dẫn" });
    fireEvent.click(guidedRadio);
    expect(guidedRadio).toHaveAttribute("aria-checked", "true");

    const sentenceBtn = screen.getByRole("button", { name: "Câu" });
    const paragraphBtn = screen.getByRole("button", { name: "Đoạn" });
    expect(paragraphBtn).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(sentenceBtn);
    expect(sentenceBtn).toHaveAttribute("aria-pressed", "true");

    const promptInput = screen.getByRole("textbox", { name: "Hướng đi hoặc yêu cầu thêm" });
    fireEvent.change(promptInput, { target: { value: "Ông lái đò nhận ra Lam nhưng giấu đi" } });

    const sourceBtn = screen.getByRole("button", { name: "Nguồn prompt đang dùng" });
    expect(sourceBtn.textContent).toContain("Văn xuôi trữ tình");
    fireEvent.click(sourceBtn);
    expect(onOpenAiSettings).toHaveBeenCalledTimes(1);

    fireEvent.submit(screen.getByRole("form", { name: "Soạn lệnh AI" }));
    expect(onTriggerStream).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: "write",
        writeMode: "guided",
        writeLengthWords: 100,
        keyDetails: "Ông lái đò nhận ra Lam nhưng giấu đi",
      })
    );
  });

  it("switches primary CTA to Stop and calls onStopStream while streaming", () => {
    const onTriggerStream = vi.fn();
    const onStopStream = vi.fn();

    render(
      <NovelcrafterAiComposer
        isStreaming={true}
        hasActiveSelection={false}
        selectedModel="gemini-2.5-flash"
        routing={routing}
        gems={[]}
        personas={[]}
        onTriggerStream={onTriggerStream}
        onStopStream={onStopStream}
      />
    );

    const stopButton = screen.getByRole("button", { name: "Dừng" });
    fireEvent.click(stopButton);
    expect(onStopStream).toHaveBeenCalledTimes(1);
    expect(onTriggerStream).not.toHaveBeenCalled();
  });
});
