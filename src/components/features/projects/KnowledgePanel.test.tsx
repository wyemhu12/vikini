import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { KnowledgePanel } from "./KnowledgePanel";
import { toast } from "@/lib/store/toastStore";
import { logger } from "@/lib/utils/logger";
import { confirm } from "@/lib/store/confirmStore";

vi.mock("@/lib/store/toastStore", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/utils/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/store/confirmStore", () => ({
  confirm: vi.fn(),
}));

describe("KnowledgePanel (TC-08)", () => {
  const mockDocuments = [
    {
      id: "doc-1",
      project_id: "proj-1",
      user_id: "user-1",
      filename: "test.pdf",
      mime_type: "application/pdf",
      size_bytes: 1024,
      chunk_count: 5,
      total_chunks: 5,
      embedding_model: "gemini-embedding-2" as const,
      status: "ready" as const,
      error_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls toast.error and logger.error when onUpload throws an exception", async () => {
    const onUploadMock = vi.fn().mockRejectedValue(new Error("Network failure"));
    const onDeleteMock = vi.fn().mockResolvedValue(undefined);
    const onRefreshMock = vi.fn();

    const { container } = render(
      <KnowledgePanel
        projectId="proj-1"
        documents={mockDocuments}
        storageUsedBytes={1024}
        storageMaxBytes={10485760}
        onUpload={onUploadMock}
        onDelete={onDeleteMock}
        onRefresh={onRefreshMock}
      />
    );

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeDefined();

    const file = new File(["dummy content"], "test.txt", { type: "text/plain" });
    // mock file.text()
    file.text = vi.fn().mockResolvedValue("dummy content");

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(onUploadMock).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it("calls toast.error and logger.error when onDelete throws an exception", async () => {
    vi.mocked(confirm).mockResolvedValue(true);
    const onUploadMock = vi.fn().mockResolvedValue(undefined);
    const onDeleteMock = vi.fn().mockRejectedValue(new Error("Database write failed"));
    const onRefreshMock = vi.fn();

    render(
      <KnowledgePanel
        projectId="proj-1"
        documents={mockDocuments}
        storageUsedBytes={1024}
        storageMaxBytes={10485760}
        onUpload={onUploadMock}
        onDelete={onDeleteMock}
        onRefresh={onRefreshMock}
      />
    );

    // Find delete button
    const deleteBtn = screen.getByTitle(/delete/i);
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(onDeleteMock).toHaveBeenCalledWith("doc-1");
      expect(logger.error).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalled();
    });
  });
});
