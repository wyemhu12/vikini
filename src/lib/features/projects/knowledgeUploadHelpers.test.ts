import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  KNOWLEDGE_MAX_FILE_BYTES,
  sendKnowledgeUploadXhr,
  validateKnowledgeFile,
} from "./knowledgeUploadHelpers";
import { UPLOAD_ABORTED_SENTINEL } from "@/lib/features/files/fileUploadHelpers";

class MockKnowledgeXHR {
  static instances: MockKnowledgeXHR[] = [];
  upload = {
    onprogress: null as ((e: ProgressEvent) => void) | null,
    onload: null as (() => void) | null,
  };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  timeout = 0;
  status = 0;
  responseText = "";
  aborted = false;
  url = "";

  constructor() {
    MockKnowledgeXHR.instances.push(this);
  }
  open(_method: string, url: string) {
    this.url = url;
  }
  send() {}
  abort() {
    this.aborted = true;
    this.onabort?.();
  }
}

describe("knowledgeUploadHelpers (TC-SU-08, NP-5)", () => {
  beforeEach(() => {
    MockKnowledgeXHR.instances = [];
    vi.stubGlobal("XMLHttpRequest", MockKnowledgeXHR);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("validates allowed extensions and 4MB size ceiling", () => {
    expect(
      validateKnowledgeFile(new File(["hi"], "notes.md", { type: "text/markdown" }))
    ).toBeNull();
    expect(validateKnowledgeFile(new File(["hi"], "evil.exe"))).toBe("UNSUPPORTED_TYPE");
    expect(validateKnowledgeFile(new File(["hi"], "noext"))).toBe("UNSUPPORTED_TYPE");

    const huge = new File(["x"], "huge.pdf");
    Object.defineProperty(huge, "size", { value: KNOWLEDGE_MAX_FILE_BYTES + 1 });
    expect(validateKnowledgeFile(huge)).toBe("TOO_LARGE");
  });

  it("streams progress -> processing -> resolved document and handles 413, nested JSON errors, and AbortSignal", async () => {
    const onProgress = vi.fn();
    const onProcessing = vi.fn();
    const file = new File(["hello"], "guide.md");

    const p1 = sendKnowledgeUploadXhr({
      projectId: "proj-1",
      file,
      payloadTooLargeMessage: "Too large (413)",
      fallbackErrorMessage: "Upload failed",
      onProgress,
      onProcessing,
    });

    const xhr1 = MockKnowledgeXHR.instances[0];
    expect(xhr1.url).toBe("/api/projects/proj-1/knowledge");
    xhr1.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 } as ProgressEvent);
    xhr1.upload.onprogress?.({ lengthComputable: true, loaded: 100, total: 100 } as ProgressEvent);
    xhr1.upload.onload?.();
    expect(onProgress).toHaveBeenCalledWith(50);
    expect(onProgress).toHaveBeenCalledWith(100);
    expect(onProcessing).toHaveBeenCalledTimes(1);

    xhr1.status = 200;
    xhr1.responseText = JSON.stringify({ success: true, data: { truncated: true } });
    xhr1.onload?.();
    expect(await p1).toEqual({ document: undefined, truncated: true });

    // HTTP 413
    const p413 = sendKnowledgeUploadXhr({
      projectId: "proj-1",
      file,
      payloadTooLargeMessage: "Too large (413)",
      fallbackErrorMessage: "Upload failed",
    });
    const xhr2 = MockKnowledgeXHR.instances[1];
    xhr2.status = 413;
    xhr2.onload?.();
    await expect(p413).rejects.toThrow("Too large (413)");

    // Structured JSON error (never "[object Object]")
    const pJsonErr = sendKnowledgeUploadXhr({
      projectId: "proj-1",
      file,
      payloadTooLargeMessage: "Too large (413)",
      fallbackErrorMessage: "Upload failed",
    });
    const xhr3 = MockKnowledgeXHR.instances[2];
    xhr3.status = 400;
    xhr3.responseText = JSON.stringify({
      success: false,
      error: { code: "QUOTA", message: "Storage limit reached" },
    });
    xhr3.onload?.();
    await expect(pJsonErr).rejects.toThrow("Storage limit reached");

    // AbortSignal
    const ac = new AbortController();
    const pAbort = sendKnowledgeUploadXhr({
      projectId: "proj-1",
      file,
      payloadTooLargeMessage: "Too large (413)",
      fallbackErrorMessage: "Upload failed",
      signal: ac.signal,
    });
    ac.abort();
    expect(MockKnowledgeXHR.instances[3].aborted).toBe(true);
    await expect(pAbort).rejects.toThrow(UPLOAD_ABORTED_SENTINEL);
  });
});
