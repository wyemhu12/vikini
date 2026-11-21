import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import EditImagePromptModal from "./EditImagePromptModal";
import { useLanguageStore } from "@/lib/store/languageStore";

describe("EditImagePromptModal (TC-W4-05)", () => {
  beforeEach(() => {
    useLanguageStore.setState({ language: "vi" });
  });

  it("renders single localized close button, bilingual title/labels, and --on-accent submit button", () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <EditImagePromptModal
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        initialPrompt="A cat in space"
      />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Đóng" })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 2, name: "Chỉnh sửa prompt ảnh" })
    ).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: "Tạo lại với prompt này" });
    expect(submitBtn.className).toContain("text-(--on-accent)");
    expect(submitBtn).toBeDisabled();

    const textarea = screen.getByLabelText("Nội dung prompt");
    fireEvent.change(textarea, { target: { value: "A cat wearing a spacesuit" } });
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);
    expect(onConfirm).toHaveBeenCalledWith("A cat wearing a spacesuit");
  });
});
