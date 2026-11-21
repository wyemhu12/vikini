import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FilePreviewCard } from "./FilePreviewCard";
import { FilePreviewArea } from "./FilePreviewArea";
import type { FileItem, FileUploadProgress } from "@/types/files";

vi.mock("../hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "en",
    t: (key: string) => {
      const dict: Record<string, string> = {
        openFilePreview: "Preview file",
        removeFile: "Remove file",
        cancelUpload: "Cancel upload",
        dismissUploadError: "Dismiss upload error",
        fileStatusQueued: "Queued",
        fileStatusProcessing: "Processing...",
        fileStatusReady: "Ready",
        uploadFailed: "Upload failed",
        dropFilesHere: "Drop files here",
        clearAllFiles: "Clear all",
        confirmClearAll: "Confirm clear?",
      };
      return dict[key] ?? key;
    },
  }),
}));

const sampleFile: FileItem = {
  id: "db-img-1",
  conversation_id: "conv-1",
  filename: "diagram.png",
  mime_type: "image/png",
  kind: "image",
  size_bytes: 4096,
  gemini_ready: true,
  created_at: "2026-11-21T10:00:00.000Z",
};

describe("FilePreviewCard & FilePreviewArea (TC-SU-06)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards ref to root HTMLDivElement, morphs in place using localPreviewUrl without redundant URL fetch, and shows processing shimmer + cancel button", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const onCancel = vi.fn();
    const cardRef = React.createRef<HTMLDivElement>();

    const uploading: FileUploadProgress = {
      tempId: "temp-1",
      file: new File(["img"], "diagram.png", { type: "image/png" }),
      filename: "diagram.png",
      size: 4096,
      kind: "image",
      progress: 100,
      status: "processing",
      previewUrl: "blob:diagram-local",
    };

    const { rerender } = render(
      <FilePreviewCard ref={cardRef} upload={uploading} onCancelUpload={onCancel} />
    );

    expect(cardRef.current).toBeInstanceOf(HTMLDivElement);
    const initialNode = cardRef.current;
    expect(screen.getByText("Processing...")).toBeInTheDocument();
    expect(screen.getByTestId("upload-processing-shimmer")).toBeInTheDocument();
    expect(screen.getByAltText("diagram.png")).toHaveAttribute("src", "blob:diagram-local");

    fireEvent.click(screen.getByRole("button", { name: "Cancel upload: diagram.png" }));
    expect(onCancel).toHaveBeenCalledWith("temp-1");

    // Same React element transitions in-place to ready file with carried localPreviewUrl
    rerender(
      <FilePreviewCard
        ref={cardRef}
        file={sampleFile}
        localPreviewUrl="blob:diagram-local"
        justCompleted={true}
      />
    );

    expect(cardRef.current).toBe(initialNode);
    expect(screen.getByAltText("diagram.png")).toHaveAttribute("src", "blob:diagram-local");
    expect(screen.getByTitle("Ready")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("resets deleting spinner in finally when onRemove rejects", async () => {
    const onRemove = vi.fn().mockRejectedValue(new Error("HTTP 500"));
    render(
      <FilePreviewCard file={sampleFile} localPreviewUrl="blob:diagram-local" onRemove={onRemove} />
    );

    const removeBtn = screen.getByRole("button", { name: "Remove file: diagram.png" });
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(onRemove).toHaveBeenCalledWith("db-img-1");
      expect(removeBtn).not.toBeDisabled();
    });
  });

  it("renders a visible min-h-[88px] dropzone when dragging onto an empty FilePreviewArea", () => {
    render(
      <FilePreviewArea
        files={[]}
        uploadQueue={[]}
        onRemoveFile={vi.fn()}
        onClearAll={vi.fn()}
        onClickFile={vi.fn()}
        isDragging={true}
      />
    );

    const emptyZone = screen.getByTestId("composer-empty-dropzone");
    expect(emptyZone.innerHTML).toContain("min-h-[88px]");
    expect(screen.getByText("Drop files here")).toBeInTheDocument();
  });

  it("falls back to fetching signed URL if local initialSrc errors", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      json: async () => ({
        success: true,
        data: { signedUrl: "https://cdn.example.com/signed.png" },
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    render(<FilePreviewCard file={sampleFile} localPreviewUrl="data:image/png;base64,BROKEN" />);
    const img = screen.getByAltText("diagram.png");
    fireEvent.error(img);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith("/api/files/db-img-1/url");
      expect(screen.getByAltText("diagram.png")).toHaveAttribute(
        "src",
        "https://cdn.example.com/signed.png"
      );
    });

    vi.unstubAllGlobals();
  });
});
