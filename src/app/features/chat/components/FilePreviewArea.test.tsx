import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FilePreviewArea } from "./FilePreviewArea";
import { useLanguageStore } from "@/lib/store/languageStore";
import type { FileItem } from "@/types/files";

const MOCK_FILES: FileItem[] = [
  {
    id: "f-1",
    conversation_id: "c-1",
    filename: "report.pdf",
    mime_type: "application/pdf",
    size_bytes: 1024,
    kind: "document",
    gemini_ready: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "f-2",
    conversation_id: "c-1",
    filename: "notes.txt",
    mime_type: "text/plain",
    size_bytes: 256,
    kind: "text",
    gemini_ready: false,
    created_at: new Date().toISOString(),
  },
];

describe("FilePreviewArea (CT-6B-02)", () => {
  beforeEach(() => {
    useLanguageStore.setState({ language: "en" });
  });

  afterEach(() => {
    useLanguageStore.setState({ language: "en" });
    vi.restoreAllMocks();
  });

  it("renders localized drag overlay in EN and VI via useLanguage without t prop", () => {
    const { rerender } = render(
      <FilePreviewArea
        files={[]}
        uploadQueue={[]}
        onRemoveFile={vi.fn()}
        onClearAll={vi.fn()}
        onClickFile={vi.fn()}
        isDragging={true}
      />
    );

    expect(screen.getByText("Drop files here to upload")).toBeInTheDocument();

    useLanguageStore.setState({ language: "vi" });
    rerender(
      <FilePreviewArea
        files={[]}
        uploadQueue={[]}
        onRemoveFile={vi.fn()}
        onClearAll={vi.fn()}
        onClickFile={vi.fn()}
        isDragging={true}
      />
    );

    expect(screen.getByText("Thả tệp vào đây để tải lên")).toBeInTheDocument();
  });

  it("requires 2-step confirmation for Clear All with localized labels", () => {
    const onClearAll = vi.fn();
    render(
      <FilePreviewArea
        files={MOCK_FILES}
        uploadQueue={[]}
        onRemoveFile={vi.fn()}
        onClearAll={onClearAll}
        onClickFile={vi.fn()}
      />
    );

    const clearBtn = screen.getByRole("button", { name: /clear all/i });
    fireEvent.click(clearBtn);
    expect(onClearAll).not.toHaveBeenCalled();

    const confirmBtn = screen.getByRole("button", {
      name: "Are you sure you want to clear all files?",
    });
    fireEvent.click(confirmBtn);
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });
});
