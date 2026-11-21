import { describe, expect, it, vi, afterEach } from "vitest";
import {
  buildQueuedUploadItems,
  classifyClientSide,
  CLIENT_MAX_FILE_SIZE_BYTES,
  extractUploadErrorMessage,
  FILE_ACCEPT,
  sendFileUploadXhr,
  uploadFileWithRetry,
  validateFileForUpload,
} from "./fileUploadHelpers";

describe("fileUploadHelpers (TC-W2B-07 / NP-2)", () => {
  it("classifies file kinds across image, video, audio, document, archive, text, and other", () => {
    expect(classifyClientSide("png", "image/png")).toBe("image");
    expect(classifyClientSide("mp4", "")).toBe("video");
    expect(classifyClientSide("mp3", "audio/mpeg")).toBe("audio");
    expect(classifyClientSide("pdf", "application/pdf")).toBe("document");
    expect(classifyClientSide("zip", "application/zip")).toBe("archive");
    expect(classifyClientSide("ts", "")).toBe("text");
    expect(classifyClientSide("bin", "application/octet-stream")).toBe("other");
    expect(FILE_ACCEPT).toContain(".pdf");
  });

  it("validates blocked extensions, blocked MIME types, oversized files, and valid files", () => {
    const exeFile = new File(["data"], "malware.exe", { type: "application/octet-stream" });
    expect(validateFileForUpload(exeFile)).toEqual({
      code: "BLOCKED_EXTENSION",
      filename: "malware.exe",
      ext: ".exe",
    });

    const blockedMime = new File(["data"], "script.txt", { type: "application/x-msdownload" });
    expect(validateFileForUpload(blockedMime)).toEqual({
      code: "BLOCKED_MIME",
      filename: "script.txt",
    });

    const largeFile = new File(["x"], "huge.pdf", { type: "application/pdf" });
    Object.defineProperty(largeFile, "size", {
      value: CLIENT_MAX_FILE_SIZE_BYTES + 2 * 1024 * 1024,
    });
    expect(validateFileForUpload(largeFile)).toEqual({
      code: "FILE_TOO_LARGE",
      filename: "huge.pdf",
      sizeMB: 52,
    });

    const validFile = new File(["hello"], "notes.md", { type: "text/markdown" });
    expect(validateFileForUpload(validFile)).toBeNull();
  });

  it("NP-2: extracts structured JSON error messages without ever producing '[object Object]'", () => {
    expect(
      extractUploadErrorMessage(
        JSON.stringify({ success: false, error: { code: "QUOTA", message: "Hết dung lượng" } }),
        "Fallback"
      )
    ).toBe("Hết dung lượng");

    expect(
      extractUploadErrorMessage(
        JSON.stringify({ success: false, error: { code: "RAW" } }),
        "Fallback"
      )
    ).toBe("Fallback");

    expect(extractUploadErrorMessage(JSON.stringify({ error: "String error" }), "Fallback")).toBe(
      "String error"
    );

    expect(extractUploadErrorMessage("<html>502 Bad Gateway</html>", "Fallback")).toBe("Fallback");
    expect(extractUploadErrorMessage("", "Fallback")).toBe("Fallback");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("TC-SU-05 & NP-3: builds upfront queued items (CSP-safe deferred previewUrl), triggers onProcessing at 100%, and distinguishes cancelled vs stale in uploadFileWithRetry", async () => {
    const onValidationError = vi.fn();
    const img = new File(["img"], "a.png", { type: "image/png" });
    const bad = new File(["x"], "bad.exe", { type: "application/octet-stream" });

    const items = buildQueuedUploadItems([img, bad], onValidationError);
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe("queued");
    expect(items[0].kind).toBe("image");
    expect(items[0].previewUrl).toBeUndefined();
    expect(onValidationError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "BLOCKED_EXTENSION" })
    );

    const instances: Array<{
      upload: { onprogress: ((e: ProgressEvent) => void) | null; onload: (() => void) | null };
      onload: (() => void) | null;
      onabort: (() => void) | null;
      onerror: (() => void) | null;
      ontimeout: (() => void) | null;
      status: number;
      responseText: string;
      open: () => void;
      send: () => void;
      abort: () => void;
    }> = [];

    class LocalMockXHR {
      upload = {
        onprogress: null as ((e: ProgressEvent) => void) | null,
        onload: null as (() => void) | null,
      };
      onload: (() => void) | null = null;
      onabort: (() => void) | null = null;
      onerror: (() => void) | null = null;
      ontimeout: (() => void) | null = null;
      timeout = 0;
      status = 0;
      responseText = "";
      constructor() {
        instances.push(this);
      }
      open() {}
      send() {}
      abort() {
        this.onabort?.();
      }
    }
    vi.stubGlobal("XMLHttpRequest", LocalMockXHR);

    const activeXhrs = new Map<string, XMLHttpRequest>();
    const onProgress = vi.fn();
    const onProcessing = vi.fn();
    const onSuccess = vi.fn();

    const p1 = sendFileUploadXhr({
      tempId: items[0].tempId,
      file: img,
      conversationId: "conv-1",
      activeXhrs,
      onProgress,
      onProcessing,
      onSuccess,
    });

    expect(activeXhrs.has(items[0].tempId)).toBe(true);
    instances[0].upload.onprogress?.({
      lengthComputable: true,
      loaded: 100,
      total: 100,
    } as ProgressEvent);
    instances[0].upload.onload?.();
    expect(onProcessing).toHaveBeenCalledTimes(1);

    instances[0].status = 200;
    instances[0].responseText = JSON.stringify({
      data: { file: { id: "f-1", filename: "a.png" } },
    });
    instances[0].onload?.();
    await p1;
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ id: "f-1" }));
    expect(activeXhrs.has(items[0].tempId)).toBe(false);

    // Abort while not stale -> returns outcome: "cancelled"
    const p2 = uploadFileWithRetry({
      item: items[0],
      conversationId: "conv-1",
      activeXhrs,
      maxRetries: 1,
      retryDelayMs: 100,
      isStale: () => false,
      isCancelled: () => false,
      sleep: async () => {},
      onProgress: vi.fn(),
      onProcessing: vi.fn(),
      onSuccess: vi.fn(),
    });
    activeXhrs.get(items[0].tempId)?.abort();
    expect(await p2).toEqual({ outcome: "cancelled" });
  });
});
