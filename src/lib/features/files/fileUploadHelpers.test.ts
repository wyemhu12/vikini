import { describe, expect, it } from "vitest";
import {
  classifyClientSide,
  CLIENT_MAX_FILE_SIZE_BYTES,
  extractUploadErrorMessage,
  FILE_ACCEPT,
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
});
