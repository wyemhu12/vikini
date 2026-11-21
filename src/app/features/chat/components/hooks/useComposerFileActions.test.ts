import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useComposerFileActions } from "./useComposerFileActions";
import type { FileItem } from "@/types/files";
import { toast } from "@/lib/store/toastStore";

const mockGlobalMutate = vi.fn();

vi.mock("swr", () => ({
  useSWRConfig: () => ({ mutate: mockGlobalMutate }),
}));

vi.mock("@/lib/store/toastStore", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

const sampleFile: FileItem = {
  id: "f-1",
  conversation_id: "conv-1",
  filename: "photo.png",
  mime_type: "image/png",
  kind: "image",
  size_bytes: 1024,
  gemini_ready: true,
  created_at: "2026-11-21T10:00:00.000Z",
};

describe("useComposerFileActions (TC-QS-09)", () => {
  const t = (k: string) => k;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("merges completed uploads into bound SWR or globalMutate fallback on New Chat and notifies callbacks", () => {
    const mutate = vi.fn().mockResolvedValue(undefined);
    const onFileCompleted = vi.fn();
    const { result, rerender } = renderHook(
      ({ convId }) =>
        useComposerFileActions({
          conversationId: convId,
          files: [],
          mutate,
          releaseFileMetadata: vi.fn(),
          onFileCompleted,
          t,
        }),
      { initialProps: { convId: "conv-1" as string | null } }
    );

    act(() => {
      result.current.handleUploadComplete(sampleFile);
    });
    expect(onFileCompleted).toHaveBeenCalledWith(sampleFile);
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mockGlobalMutate).not.toHaveBeenCalled();

    // New Chat fallback (conversationId still null) -> writes to globalMutate key
    rerender({ convId: null });
    act(() => {
      result.current.handleUploadComplete(sampleFile);
    });
    expect(mockGlobalMutate).toHaveBeenCalledWith(
      "/api/files?conversationId=conv-1",
      expect.any(Function),
      { revalidate: true }
    );
  });

  it("reports HTTP 500 errors on single remove and partial failure on clear all", async () => {
    const mutate = vi.fn().mockResolvedValue(undefined);
    const releaseFileMetadata = vi.fn();
    const onFileRemoved = vi.fn();
    const onFilesCleared = vi.fn();

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: true, status: 200 })
        .mockResolvedValueOnce({ ok: false, status: 500 })
    );

    const file2: FileItem = { ...sampleFile, id: "f-2", filename: "doc.pdf" };
    const { result } = renderHook(() =>
      useComposerFileActions({
        conversationId: "conv-1",
        files: [sampleFile, file2],
        mutate,
        releaseFileMetadata,
        onFileRemoved,
        onFilesCleared,
        t,
      })
    );

    await act(async () => {
      await result.current.handleRemoveFile("f-1");
    });
    expect(onFileRemoved).toHaveBeenCalledWith("f-1");
    expect(releaseFileMetadata).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("deleteFileFailed");

    await act(async () => {
      await result.current.handleClearAll();
    });
    expect(onFilesCleared).toHaveBeenCalledTimes(1);
    expect(releaseFileMetadata).toHaveBeenCalledWith("f-1");
    expect(toast.error).toHaveBeenCalledWith("clearFilesPartialFailed");
  });
});
