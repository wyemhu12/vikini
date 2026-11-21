import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { KnowledgePanel } from "./KnowledgePanel";
import { toast } from "@/lib/store/toastStore";
import { logger } from "@/lib/utils/logger";
import { confirm } from "@/lib/store/confirmStore";
import type { KnowledgeUploadCallbacks } from "@/lib/features/projects/knowledgeUploadHelpers";
import { UPLOAD_ABORTED_SENTINEL } from "@/lib/features/files/fileUploadHelpers";

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

  it("renders empty state safely when documents is undefined or empty (TC-6E-02)", () => {
    const onUploadMock = vi.fn().mockResolvedValue(undefined);
    const onDeleteMock = vi.fn().mockResolvedValue(undefined);
    const onRefreshMock = vi.fn();

    const { rerender } = render(
      <KnowledgePanel
        projectId="proj-1"
        documents={undefined as unknown as typeof mockDocuments}
        storageUsedBytes={0}
        storageMaxBytes={10485760}
        onUpload={onUploadMock}
        onDelete={onDeleteMock}
        onRefresh={onRefreshMock}
      />
    );

    expect(screen.getByText(/no documents/i)).toBeInTheDocument();

    rerender(
      <KnowledgePanel
        projectId="proj-1"
        documents={[]}
        storageUsedBytes={0}
        storageMaxBytes={10485760}
        onUpload={onUploadMock}
        onDelete={onDeleteMock}
        onRefresh={onRefreshMock}
      />
    );

    expect(screen.getByText(/no documents/i)).toBeInTheDocument();
  });

  it("TC-P1-08: renders Skeleton placeholders instead of Empty State while isLoading=true", () => {
    render(
      <KnowledgePanel
        projectId="proj-1"
        documents={[]}
        storageUsedBytes={0}
        storageMaxBytes={0}
        isLoading={true}
        onUpload={vi.fn()}
        onDelete={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    expect(screen.getByTestId("kb-loading-skeletons")).toBeInTheDocument();
    expect(screen.queryByText(/no documents/i)).toBeNull();
  });

  it("TC-P1-08: renders numeric chunk count with total_chunks, legacy chunk_count, or 0 fallback", () => {
    const legacyDoc = {
      ...mockDocuments[0],
      id: "doc-legacy",
      total_chunks: undefined as unknown as number,
      chunk_count: 18,
    };
    const zeroDoc = {
      ...mockDocuments[0],
      id: "doc-zero",
      filename: "empty.md",
      total_chunks: undefined as unknown as number,
      chunk_count: undefined,
    };
    render(
      <KnowledgePanel
        projectId="proj-1"
        documents={[legacyDoc, zeroDoc]}
        storageUsedBytes={2048}
        storageMaxBytes={10485760}
        onUpload={vi.fn()}
        onDelete={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    expect(screen.getByText(/18\s+chunks/i)).toBeInTheDocument();
    expect(screen.getByText(/0\s+chunks/i)).toBeInTheDocument();
  });

  it("TC-W3-04 & TC-W3-07: renders section heading as h2 and keeps delete button visible on mobile", () => {
    render(
      <KnowledgePanel
        projectId="proj-1"
        documents={mockDocuments}
        storageUsedBytes={1024}
        storageMaxBytes={10485760}
        onUpload={vi.fn()}
        onDelete={vi.fn()}
        onRefresh={vi.fn()}
      />
    );
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
    const deleteBtn = screen.getByTitle(/delete/i);
    expect(deleteBtn.className).toContain("opacity-100");
    expect(deleteBtn.className).toContain("md:opacity-0");
  });

  it("TC-SU-08 & NP-5: rejects .exe on drop, keeps optimistic pending row visible on empty project even when isLoading=true, and aborts active XHR cleanly on unmount", async () => {
    const signals: Array<AbortSignal | undefined> = [];
    const resolvers: Array<() => void> = [];
    const onUploadMock = vi.fn(
      (_file: File, _payload: FormData | string, callbacks?: KnowledgeUploadCallbacks) => {
        signals.push(callbacks?.signal);
        callbacks?.onProgress?.(60);
        callbacks?.onProcessing?.();
        return new Promise<void>((resolve, reject) => {
          callbacks?.signal?.addEventListener("abort", () => {
            reject(new Error(UPLOAD_ABORTED_SENTINEL));
          });
          resolvers.push(resolve);
        });
      }
    );

    const { container, rerender, unmount } = render(
      <KnowledgePanel
        projectId="proj-1"
        documents={[]}
        storageUsedBytes={0}
        storageMaxBytes={10485760}
        isLoading={false}
        onUpload={onUploadMock}
        onDelete={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    const dropLabel = container.querySelector("label") as HTMLLabelElement;
    const f1 = new File(["one"], "doc1.md", { type: "text/markdown" });
    const f2 = new File(["two"], "doc2.pdf", { type: "application/pdf" });
    const bad = new File(["x"], "virus.exe", { type: "application/octet-stream" });

    fireEvent.drop(dropLabel, {
      dataTransfer: { files: [f1, f2, bad], types: ["Files"] },
    });

    // Unsupported .exe rejected with toast.error
    expect(toast.error).toHaveBeenCalledTimes(1);

    // Both valid files appear as pending optimistic rows immediately
    expect(await screen.findAllByTestId("kb-pending-upload-row")).toHaveLength(2);
    expect(screen.getByText("doc1.md")).toBeInTheDocument();
    expect(screen.getByText("doc2.pdf")).toBeInTheDocument();

    // Even if parent sets isLoading=true while documents=[] (e.g. fetchDocuments after #1),
    // pending rows MUST remain visible and skeleton must NOT wipe them out!
    rerender(
      <KnowledgePanel
        projectId="proj-1"
        documents={[]}
        storageUsedBytes={0}
        storageMaxBytes={10485760}
        isLoading={true}
        onUpload={onUploadMock}
        onDelete={vi.fn()}
        onRefresh={vi.fn()}
      />
    );
    expect(screen.queryByTestId("kb-loading-skeletons")).not.toBeInTheDocument();
    expect(screen.getByText("doc2.pdf")).toBeInTheDocument();

    // Unmount mid-upload aborts active signal without calling toast.error again
    vi.mocked(toast.error).mockClear();
    unmount();
    expect(signals[0]?.aborted).toBe(true);
    await waitFor(() => {
      expect(toast.error).not.toHaveBeenCalled();
    });
  });
});
