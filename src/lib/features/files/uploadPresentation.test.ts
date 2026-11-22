import { describe, it, expect, vi, afterEach } from "vitest";
import type { FileItem, FileUploadProgress } from "@/types/files";
import {
  createSafeObjectUrl,
  filterVisibleUploadQueue,
  formatFileUploadError,
  formatRelativeFileDate,
  getStableFileKey,
  hydrateQueuedImagePreviews,
  isPendingSendReadyToFlush,
  mergeDispatchFileIds,
  mergeUploadedFileOptimistically,
  readImagePreviewDataUrl,
  revokeSafeObjectUrl,
  STUDIO_REF_ALLOWED_MIME_TYPES,
  STUDIO_REF_IMAGE_MAX_BYTES,
  sortComposerFiles,
  validateReferenceImages,
} from "./uploadPresentation";

function makeFileItem(id: string, createdAt?: string): FileItem {
  return {
    id,
    conversation_id: "conv-1",
    filename: `${id}.png`,
    mime_type: "image/png",
    kind: "image",
    size_bytes: 1024,
    gemini_ready: true,
    created_at: createdAt as string,
  };
}

describe("uploadPresentation (TC-SU-05, TC-SU-07)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sorts composer files ascending by created_at and preserves order when created_at is missing", () => {
    const newer = makeFileItem("f-2", "2026-11-21T10:05:00.000Z");
    const older = makeFileItem("f-1", "2026-11-21T10:00:00.000Z");
    expect(sortComposerFiles([newer, older]).map((f) => f.id)).toEqual(["f-1", "f-2"]);

    const minimalA = makeFileItem("m-1", undefined);
    const minimalB = makeFileItem("m-2", undefined);
    expect(sortComposerFiles([minimalA, minimalB]).map((f) => f.id)).toEqual(["m-1", "m-2"]);
  });

  it("merges uploaded file optimistically without duplicating existing IDs and filters visible upload queue", () => {
    const existing = makeFileItem("f-1", "2026-11-21T10:00:00.000Z");
    const added = makeFileItem("f-2", "2026-11-21T10:01:00.000Z");

    const merged = mergeUploadedFileOptimistically([existing], added);
    expect(merged.map((f) => f.id)).toEqual(["f-1", "f-2"]);

    const updated = mergeUploadedFileOptimistically(merged, { ...added, filename: "renamed.png" });
    expect(updated).toHaveLength(2);
    expect(updated[1].filename).toBe("renamed.png");

    const queue: FileUploadProgress[] = [
      {
        tempId: "t-1",
        file: new File(["a"], "a.png", { type: "image/png" }),
        filename: "a.png",
        size: 10,
        kind: "image",
        progress: 100,
        status: "ready",
        result: added,
      },
      {
        tempId: "t-2",
        file: new File(["b"], "b.png", { type: "image/png" }),
        filename: "b.png",
        size: 10,
        kind: "image",
        progress: 40,
        status: "uploading",
      },
    ];
    expect(filterVisibleUploadQueue(queue, merged).map((q) => q.tempId)).toEqual(["t-2"]);
  });

  it("formats relative dates using bilingual translation keys (no hardcoded English)", () => {
    const now = Date.parse("2026-11-21T12:00:00.000Z");
    const t = (key: string) =>
      (
        ({
          relativeTimeJustNow: "Vừa xong",
          relativeTimeMinutesAgo: "{count} phút trước",
          relativeTimeHoursAgo: "{count} giờ trước",
          relativeTimeYesterday: "Hôm qua",
          relativeTimeDaysAgo: "{count} ngày trước",
        }) as Record<string, string>
      )[key] ?? key;

    expect(formatRelativeFileDate("2026-11-21T11:59:45.000Z", t, now)).toBe("Vừa xong");
    expect(formatRelativeFileDate("2026-11-21T11:55:00.000Z", t, now)).toBe("5 phút trước");
    expect(formatRelativeFileDate("2026-11-21T09:00:00.000Z", t, now)).toBe("3 giờ trước");
    expect(formatRelativeFileDate("2026-11-20T10:00:00.000Z", t, now)).toBe("Hôm qua");
    expect(formatRelativeFileDate("2026-11-18T10:00:00.000Z", t, now)).toBe("3 ngày trước");
  });

  it("formats FileUploadError codes, manages objectURLs safely, returns stable file keys, and validates reference images", () => {
    const t = (k: string) =>
      k === "fileUploadTooLarge" ? "Too big {size}/{max}" : k === "uploadFailed" ? "Failed" : k;
    expect(formatFileUploadError({ code: "FILE_TOO_LARGE", sizeMB: 60 }, t, 50)).toBe(
      "Too big 60/50"
    );
    expect(formatFileUploadError({ code: "UPLOAD_FAILED", detail: "Quota" }, t)).toBe("Quota");

    const createSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-1");
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const f = new File(["img"], "pic.png", { type: "image/png" });
    const url = createSafeObjectUrl(f);
    expect(url).toBe("blob:mock-1");
    revokeSafeObjectUrl(url);
    expect(createSpy).toHaveBeenCalledWith(f);
    expect(revokeSpy).toHaveBeenCalledWith("blob:mock-1");

    const k1 = getStableFileKey(f);
    const k2 = getStableFileKey(f);
    expect(k1).toBe(k2);

    const bigImg = new File(["x"], "huge.png", { type: "image/png" });
    Object.defineProperty(bigImg, "size", { value: 12 * 1024 * 1024 });
    const txt = new File(["hi"], "notes.txt", { type: "text/plain" });
    const ok1 = new File(["1"], "1.png", { type: "image/png" });
    const ok2 = new File(["2"], "2.png", { type: "image/png" });

    const res = validateReferenceImages([txt, bigImg, ok1, ok2], 3, 4);
    expect(res).toEqual({
      accepted: [ok1],
      invalidTypeCount: 1,
      tooLargeCount: 1,
      overLimitCount: 1,
    });
  });

  it("TC-REF-09 & NP-5: validates 40MB Studio limit and 4-MIME whitelist while preserving 10MB default for TemplateModal", () => {
    expect(STUDIO_REF_IMAGE_MAX_BYTES).toBe(40 * 1024 * 1024);
    expect(STUDIO_REF_ALLOWED_MIME_TYPES).toEqual([
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
    ]);

    const img12MB = new File(["a"], "twelve.png", { type: "image/png" });
    Object.defineProperty(img12MB, "size", { value: 12 * 1024 * 1024 });

    // Default (TemplateModal) still rejects 12MB
    expect(validateReferenceImages([img12MB], 0, 1)).toEqual({
      accepted: [],
      invalidTypeCount: 0,
      tooLargeCount: 1,
      overLimitCount: 0,
    });

    const img35MB = new File(["b"], "big-ok.png", { type: "IMAGE/PNG" });
    Object.defineProperty(img35MB, "size", { value: 35 * 1024 * 1024 });
    const img41MB = new File(["c"], "too-big.png", { type: "image/png" });
    Object.defineProperty(img41MB, "size", { value: 41 * 1024 * 1024 });
    const svg = new File(["<svg/>"], "vec.svg", { type: "image/svg+xml" });
    const heic = new File(["heic"], "photo.heic", { type: "image/heic" });

    const studioRes = validateReferenceImages(
      [img12MB, img35MB, img41MB, svg, heic],
      0,
      4,
      STUDIO_REF_IMAGE_MAX_BYTES,
      STUDIO_REF_ALLOWED_MIME_TYPES
    );
    expect(studioRes).toEqual({
      accepted: [img12MB, img35MB],
      invalidTypeCount: 2,
      tooLargeCount: 1,
      overLimitCount: 0,
    });
  });

  it("reads CSP-safe data URLs via FileReader (with oversize guard and non-blocking queue hydration)", async () => {
    const img = new File(["hello"], "sample.png", { type: "image/png" });
    const dataUrl = await readImagePreviewDataUrl(img);
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);

    // Oversize file skips FileReader cleanly
    const huge = new File(["x"], "huge.png", { type: "image/png" });
    Object.defineProperty(huge, "size", { value: 20 * 1024 * 1024 });
    expect(await readImagePreviewDataUrl(huge)).toBeUndefined();

    // Non-blob URLs are ignored by revokeSafeObjectUrl
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    revokeSafeObjectUrl(dataUrl);
    expect(revokeSpy).not.toHaveBeenCalled();

    const onPreviewReady = vi.fn();
    hydrateQueuedImagePreviews(
      [
        {
          tempId: "t-img",
          file: img,
          filename: "sample.png",
          size: 5,
          kind: "image",
          progress: 0,
          status: "queued",
        },
        {
          tempId: "t-cancelled",
          file: new File(["no"], "cancel.png", { type: "image/png" }),
          filename: "cancel.png",
          size: 2,
          kind: "image",
          progress: 0,
          status: "queued",
        },
      ],
      (tempId) => tempId === "t-img",
      onPreviewReady
    );

    await vi.waitFor(() => {
      expect(onPreviewReady).toHaveBeenCalledWith("t-img", dataUrl);
    });
    expect(onPreviewReady).toHaveBeenCalledTimes(1);
  });

  it("TC-QS-03 & NP-7: merges SWR and synchronous completed file IDs without duplicates and gates pending-send flush", () => {
    const f1 = makeFileItem("f-1", "2026-11-21T10:00:00.000Z");
    const fOld = makeFileItem("f-old-sent", "2026-11-21T09:00:00.000Z");

    expect(mergeDispatchFileIds([fOld, f1], ["f-1", "f-2"], ["f-old-sent"])).toEqual([
      "f-1",
      "f-2",
    ]);
    expect(mergeDispatchFileIds([], ["f-1"], [])).toEqual(["f-1"]);
    expect(mergeDispatchFileIds([fOld], ["f-old-sent"], ["f-old-sent"])).toEqual([]);

    const base = {
      isPendingSend: true,
      isUploadBusy: false,
      disabled: false,
      isStreaming: false,
      isImageMode: false,
      expectedConversationId: "conv-new",
      currentConversationId: "conv-new",
      hasPromptText: true,
    };

    expect(isPendingSendReadyToFlush(base)).toBe(true);
    expect(isPendingSendReadyToFlush({ ...base, isUploadBusy: true })).toBe(false);
    expect(isPendingSendReadyToFlush({ ...base, hasPromptText: false })).toBe(false);
    expect(isPendingSendReadyToFlush({ ...base, currentConversationId: null })).toBe(false);
    expect(isPendingSendReadyToFlush({ ...base, currentConversationId: "conv-other" })).toBe(false);
    expect(isPendingSendReadyToFlush({ ...base, isImageMode: true })).toBe(false);
    expect(isPendingSendReadyToFlush({ ...base, isStreaming: true })).toBe(false);
    expect(isPendingSendReadyToFlush({ ...base, disabled: true })).toBe(false);
    expect(isPendingSendReadyToFlush({ ...base, expectedConversationId: null })).toBe(true);
  });
});
