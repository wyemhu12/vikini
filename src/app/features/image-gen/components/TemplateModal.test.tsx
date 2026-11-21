import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TemplateModal from "./TemplateModal";
import type { ImageTemplate } from "@/lib/features/image-gen/templates";
import { toast } from "@/lib/store/toastStore";

vi.mock("@/lib/store/toastStore", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("../../chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "en",
    t: (key: string) => {
      const dict: Record<string, string> = {
        choosePhoto: "Choose photo",
        cancel: "Cancel",
        describeInvalidImage: "Invalid image file",
        describeFileTooLarge: "Image exceeds 10MB",
        templateDropPhotoHint: "Drop a photo here to apply template",
      };
      return dict[key] ?? key;
    },
  }),
}));

const sampleTemplate: ImageTemplate = {
  id: "tpl-1",
  name: { vi: "Chân dung", en: "Portrait" },
  description: { vi: "Mẫu chân dung", en: "Portrait style template" },
  previewUrl: "https://cdn.example.com/tpl.png",
  prompt: "portrait",
  requiresPhoto: true,
  style: "portrait",
};

describe("TemplateModal (TC-SU-10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-image and oversized files with toast.error and accepts valid dropped image", () => {
    const onChoosePhoto = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <TemplateModal
        template={sampleTemplate}
        open={true}
        onOpenChange={onOpenChange}
        onChoosePhoto={onChoosePhoto}
      />
    );

    const dialog = screen.getByRole("dialog");
    const input = dialog.querySelector('input[type="file"]') as HTMLInputElement;

    // 1. Non-image file -> toast.error
    const pdf = new File(["pdf"], "doc.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [pdf] } });
    expect(toast.error).toHaveBeenCalledWith("Invalid image file");
    expect(onChoosePhoto).not.toHaveBeenCalled();

    // 2. Oversized image (>10MB) -> toast.error
    const huge = new File(["big"], "huge.png", { type: "image/png" });
    Object.defineProperty(huge, "size", { value: 11 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [huge] } });
    expect(toast.error).toHaveBeenCalledWith("Image exceeds 10MB");
    expect(onChoosePhoto).not.toHaveBeenCalled();

    // 3. Valid dropped PNG -> invokes onChoosePhoto and closes modal
    const validPng = new File(["ok"], "me.png", { type: "image/png" });
    fireEvent.drop(dialog, {
      dataTransfer: { files: [validPng], types: ["Files"] },
    });
    expect(onChoosePhoto).toHaveBeenCalledWith(sampleTemplate, validPng);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
