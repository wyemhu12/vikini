import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  GeminiNativeImageProvider,
  INLINE_REF_IMAGE_THRESHOLD_BYTES,
} from "./GeminiNativeImageProvider";

const mockGenerateContent = vi.fn();
const mockFilesUpload = vi.fn();
const mockFilesDelete = vi.fn();
const mockGoogleGenAICtor = vi.fn();

vi.mock("@google/genai", () => ({
  GoogleGenAI: class MockGoogleGenAI {
    models = { generateContent: mockGenerateContent };
    files = { upload: mockFilesUpload, delete: mockFilesDelete };
    constructor(opts: unknown) {
      mockGoogleGenAICtor(opts);
    }
  },
}));

function mockValidImageResponse() {
  mockGenerateContent.mockResolvedValueOnce({
    candidates: [
      {
        finishReason: "STOP",
        content: {
          parts: [{ inlineData: { data: "aGVsbG8=", mimeType: "image/png" } }],
        },
      },
    ],
  });
}

describe("GeminiNativeImageProvider (TC-REF-06, TC-REF-07, WP-3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFilesDelete.mockResolvedValue({});
  });

  it("TC-REF-06: sends inlineData when resolvedReferenceImages total <= 15MB without calling Gemini Files API", async () => {
    mockValidImageResponse();
    const provider = new GeminiNativeImageProvider();
    const buf1 = Buffer.from("img-one");
    const buf2 = Buffer.from("img-two");

    const results = await provider.generate("Upscale to 4k", {
      model: "gemini-3.1-flash-image",
      resolvedReferenceImages: [
        { buffer: buf1, mimeType: "image/png", sizeBytes: 5 * 1024 * 1024, filename: "ref-1.png" },
        { buffer: buf2, mimeType: "image/jpeg", sizeBytes: 5 * 1024 * 1024, filename: "ref-2.jpg" },
      ],
    });

    expect(results).toHaveLength(1);
    expect(mockFilesUpload).not.toHaveBeenCalled();
    expect(mockFilesDelete).not.toHaveBeenCalled();
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);

    const callArg = mockGenerateContent.mock.calls[0][0] as {
      contents: Array<{ parts: unknown[] }>;
    };
    expect(callArg.contents[0].parts).toEqual([
      { inlineData: { data: buf1.toString("base64"), mimeType: "image/png" } },
      { inlineData: { data: buf2.toString("base64"), mimeType: "image/jpeg" } },
      { text: "Upscale to 4k" },
    ]);
  });

  it("TC-REF-07 (WP-3): uses Gemini Files API on the same BYOK client when total > 15MB and deletes files in finally", async () => {
    mockValidImageResponse();
    mockFilesUpload
      .mockResolvedValueOnce({
        name: "files/temp-1",
        uri: "https://generativelanguage.googleapis.com/v1beta/files/temp-1",
        mimeType: "image/png",
      })
      .mockResolvedValueOnce({
        name: "files/temp-2",
        uri: "https://generativelanguage.googleapis.com/v1beta/files/temp-2",
        mimeType: "image/webp",
      });

    const provider = new GeminiNativeImageProvider();
    const overThresholdEach = Math.ceil(INLINE_REF_IMAGE_THRESHOLD_BYTES / 2) + 1024;

    const results = await provider.generate(
      "Blend styles",
      {
        model: "gemini-3-pro-image",
        resolvedReferenceImages: [
          {
            buffer: Buffer.from("big-1"),
            mimeType: "image/png",
            sizeBytes: overThresholdEach,
            filename: "ref-1.png",
          },
          {
            buffer: Buffer.from("big-2"),
            mimeType: "image/webp",
            sizeBytes: overThresholdEach,
            filename: "ref-2.webp",
          },
        ],
      },
      "user-byok-key"
    );

    expect(results).toHaveLength(1);
    expect(mockGoogleGenAICtor).toHaveBeenCalledWith({ apiKey: "user-byok-key" });
    expect(mockFilesUpload).toHaveBeenCalledTimes(2);

    const callArg = mockGenerateContent.mock.calls[0][0] as {
      contents: Array<{ parts: unknown[] }>;
    };
    expect(callArg.contents[0].parts).toEqual([
      {
        fileData: {
          fileUri: "https://generativelanguage.googleapis.com/v1beta/files/temp-1",
          mimeType: "image/png",
        },
      },
      {
        fileData: {
          fileUri: "https://generativelanguage.googleapis.com/v1beta/files/temp-2",
          mimeType: "image/webp",
        },
      },
      { text: "Blend styles" },
    ]);

    expect(mockFilesDelete).toHaveBeenCalledTimes(2);
    expect(mockFilesDelete).toHaveBeenCalledWith({ name: "files/temp-1" });
    expect(mockFilesDelete).toHaveBeenCalledWith({ name: "files/temp-2" });
  });

  it("TC-REF-07: still deletes uploaded Gemini files in finally when generateContent throws", async () => {
    mockFilesUpload.mockResolvedValueOnce({
      name: "files/temp-fail",
      uri: "https://generativelanguage.googleapis.com/v1beta/files/temp-fail",
      mimeType: "image/png",
    });
    mockGenerateContent.mockRejectedValueOnce(new Error("Upstream 503"));

    const provider = new GeminiNativeImageProvider();
    await expect(
      provider.generate("Upscale", {
        resolvedReferenceImages: [
          {
            buffer: Buffer.from("huge"),
            mimeType: "image/png",
            sizeBytes: INLINE_REF_IMAGE_THRESHOLD_BYTES + 1,
            filename: "ref-huge.png",
          },
        ],
      })
    ).rejects.toThrow("Upstream 503");

    expect(mockFilesDelete).toHaveBeenCalledTimes(1);
    expect(mockFilesDelete).toHaveBeenCalledWith({ name: "files/temp-fail" });
  });

  it("TC-CLEAN-03: sends text-only parts when resolvedReferenceImages is omitted or empty", async () => {
    mockValidImageResponse();
    const provider = new GeminiNativeImageProvider();

    await provider.generate("A serene mountain", { model: "gemini-3.1-flash-image" });
    const call1 = mockGenerateContent.mock.calls[0][0] as {
      contents: Array<{ parts: unknown[] }>;
    };
    expect(call1.contents[0].parts).toEqual([{ text: "A serene mountain" }]);

    mockValidImageResponse();
    await provider.generate("A serene mountain", { resolvedReferenceImages: [] });
    const call2 = mockGenerateContent.mock.calls[1][0] as {
      contents: Array<{ parts: unknown[] }>;
    };
    expect(call2.contents[0].parts).toEqual([{ text: "A serene mountain" }]);
    expect(mockFilesUpload).not.toHaveBeenCalled();
    expect(mockFilesDelete).not.toHaveBeenCalled();
  });

  it("NP-CLEAN-03: ignores runtime-injected legacy base64 referenceImage/referenceImages fields", async () => {
    mockValidImageResponse();
    const provider = new GeminiNativeImageProvider();

    await provider.generate("Variation", {
      referenceImage: "data:image/png;base64,QUJDRA==",
      referenceImages: ["data:image/png;base64,QUJDRA=="],
    } as unknown as Parameters<typeof provider.generate>[1]);

    const callArg = mockGenerateContent.mock.calls[0][0] as {
      contents: Array<{ parts: unknown[] }>;
    };
    expect(callArg.contents[0].parts).toEqual([{ text: "Variation" }]);
    expect(mockFilesUpload).not.toHaveBeenCalled();
  });
});
