// src/app/features/chat/components/FileInMessage.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { FileInMessage } from "./FileInMessage";
import type { FileItem } from "@/types/files";

const MOCK_FILES: FileItem[] = [
  {
    id: "file-long-name",
    filename: "very_long_unbroken_attachment_filename_2026_11_22_report_final_v2.pdf",
    mime_type: "application/pdf",
    size_bytes: 204800,
    kind: "document",
    created_at: "2026-11-22T00:00:00.000Z",
    conversation_id: "conv-1",
    gemini_ready: true,
  },
];

vi.mock("@/lib/features/files/useFiles", () => ({
  useFiles: () => ({
    files: MOCK_FILES,
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@/lib/features/files/store", () => ({
  useFileStore: (selector: (s: { localPreviewByFileId: Record<string, string> }) => unknown) =>
    selector({ localPreviewByFileId: {} }),
}));

describe("FileInMessage", () => {
  it("TC-UB-08: constrains file list and long unbroken filenames inside responsive min-w-0/max-w classes", () => {
    const onClick = vi.fn();
    const { container } = render(
      <FileInMessage conversationId="conv-1" fileIds={["file-long-name"]} onClick={onClick} />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("flex", "flex-wrap", "min-w-0", "max-w-full");

    const button = screen.getByRole("button");
    expect(button).toHaveClass("max-w-[min(220px,100%)]", "min-w-0");

    const filenameEl = screen.getByText(MOCK_FILES[0].filename);
    expect(filenameEl).toHaveClass("truncate");

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledWith(MOCK_FILES[0]);
  });

  it("returns null when no fileIds match conversation files", () => {
    const { container } = render(
      <FileInMessage conversationId="conv-1" fileIds={["non-existent-id"]} />
    );

    expect(container.firstChild).toBeNull();
  });
});
