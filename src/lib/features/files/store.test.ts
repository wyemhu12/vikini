import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { FileItem, FileUploadProgress } from "@/types/files";
import { useFileStore } from "./store";

const uploadedFile: FileItem = {
  id: "file-db-1",
  conversation_id: "conv-1",
  filename: "photo.png",
  mime_type: "image/png",
  kind: "image",
  size_bytes: 2048,
  gemini_ready: true,
  created_at: "2026-11-21T10:00:00.000Z",
};

describe("useFileStore (TC-SU-05, NP-3)", () => {
  let revokeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    revokeSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    useFileStore.setState({
      uploadQueue: [],
      sentFileIds: [],
      renderKeyByFileId: {},
      localPreviewByFileId: {},
      recentlyCompletedAt: {},
    });
  });

  afterEach(() => {
    revokeSpy.mockRestore();
  });

  it("atomically completes upload by transferring renderKey + previewUrl and removing queue item without revoking active preview", () => {
    const item: FileUploadProgress = {
      tempId: "temp-1",
      file: new File(["img"], "photo.png", { type: "image/png" }),
      filename: "photo.png",
      size: 2048,
      kind: "image",
      progress: 80,
      status: "uploading",
      previewUrl: "blob:preview-1",
    };

    useFileStore.getState().enqueueFiles([item]);
    useFileStore.getState().setStatus("temp-1", "processing");
    expect(useFileStore.getState().uploadQueue[0].progress).toBe(100);

    useFileStore.getState().completeUpload("temp-1", uploadedFile);

    const state = useFileStore.getState();
    expect(state.uploadQueue).toHaveLength(0);
    expect(state.renderKeyByFileId["file-db-1"]).toBe("temp-1");
    expect(state.localPreviewByFileId["file-db-1"]).toBe("blob:preview-1");
    expect(typeof state.recentlyCompletedAt["file-db-1"]).toBe("number");
    // Preview is still in use by the ready card — must NOT be revoked yet
    expect(revokeSpy).not.toHaveBeenCalled();

    useFileStore.getState().clearRecentlyCompleted("file-db-1");
    expect(useFileStore.getState().recentlyCompletedAt["file-db-1"]).toBeUndefined();

    // Deleting the file revokes the transferred previewUrl cleanly
    useFileStore.getState().releaseFileMetadata("file-db-1");
    expect(revokeSpy).toHaveBeenCalledWith("blob:preview-1");
    expect(useFileStore.getState().localPreviewByFileId["file-db-1"]).toBeUndefined();
    expect(useFileStore.getState().renderKeyByFileId["file-db-1"]).toBeUndefined();
  });

  it("revokes objectURLs on removeFromQueue and clearQueue", () => {
    useFileStore.getState().enqueueFiles([
      {
        tempId: "t-a",
        file: new File(["a"], "a.png", { type: "image/png" }),
        filename: "a.png",
        size: 10,
        kind: "image",
        progress: 0,
        status: "queued",
        previewUrl: "blob:a",
      },
      {
        tempId: "t-b",
        file: new File(["b"], "b.png", { type: "image/png" }),
        filename: "b.png",
        size: 10,
        kind: "image",
        progress: 0,
        status: "queued",
        previewUrl: "blob:b",
      },
    ]);

    useFileStore.getState().removeFromQueue("t-a");
    expect(revokeSpy).toHaveBeenCalledWith("blob:a");
    expect(useFileStore.getState().uploadQueue).toHaveLength(1);

    useFileStore.getState().clearQueue();
    expect(revokeSpy).toHaveBeenCalledWith("blob:b");
    expect(useFileStore.getState().uploadQueue).toHaveLength(0);
  });

  it("hydrates CSP-safe data preview URLs both while queued and after ultra-fast completion", () => {
    const item: FileUploadProgress = {
      tempId: "temp-fast",
      file: new File(["img"], "photo.png", { type: "image/png" }),
      filename: "photo.png",
      size: 2048,
      kind: "image",
      progress: 0,
      status: "queued",
    };

    useFileStore.getState().enqueueFiles([item]);
    useFileStore.getState().setPreviewUrl("temp-fast", "data:image/png;base64,AAA");
    expect(useFileStore.getState().uploadQueue[0].previewUrl).toBe("data:image/png;base64,AAA");

    // Ultra-fast completion before preview resolves -> setPreviewUrl backfills localPreviewByFileId
    useFileStore.getState().enqueueFiles([{ ...item, tempId: "temp-instant" }]);
    useFileStore.getState().completeUpload("temp-instant", uploadedFile);
    useFileStore.getState().setPreviewUrl("temp-instant", "data:image/png;base64,BBB");
    expect(useFileStore.getState().localPreviewByFileId["file-db-1"]).toBe(
      "data:image/png;base64,BBB"
    );
  });
});
