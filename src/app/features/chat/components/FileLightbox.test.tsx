import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FileLightbox } from "./FileLightbox";
import type { FileItem } from "@/types/files";

vi.mock("../hooks/useLanguage", () => ({
  useLanguage: () => ({
    t: (k: string) => k,
    language: "vi",
  }),
}));

const sampleFiles: FileItem[] = [
  {
    id: "f-1",
    filename: "notes.txt",
    mime_type: "text/plain",
    size_bytes: 128,
    kind: "text",
  } as FileItem,
  {
    id: "f-2",
    filename: "photo.png",
    mime_type: "image/png",
    size_bytes: 2048,
    kind: "image",
  } as FileItem,
];

describe("FileLightbox (TC-W3-05, WP-4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/api/files/")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: { signedUrl: "https://cdn.example.com/file" } }),
        });
      }
      return Promise.resolve({
        ok: true,
        text: async () => "Hello file content",
      });
    }) as unknown as typeof fetch;
  });

  it("renders Radix Dialog, supports ArrowRight navigation, Escape and backdrop click close", async () => {
    const onClose = vi.fn();
    const onNavigate = vi.fn();

    render(
      <FileLightbox
        file={sampleFiles[0]}
        files={sampleFiles}
        onClose={onClose}
        onNavigate={onNavigate}
      />
    );

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Hello file content")).toBeInTheDocument();
    });

    // ArrowRight navigates to next file
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(onNavigate).toHaveBeenCalledWith(sampleFiles[1]);

    // Backdrop click on Dialog.Content itself closes lightbox
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Escape closes via Radix Dialog
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("retries signed URL load cleanly via retryNonce after failure", async () => {
    let calls = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      calls += 1;
      if (calls === 1) return Promise.reject(new Error("offline"));
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: { signedUrl: "https://cdn.example.com/retry.png" } }),
      });
    }) as unknown as typeof fetch;

    render(<FileLightbox file={sampleFiles[1]} onClose={vi.fn()} />);

    const retryBtn = await screen.findByRole("button", { name: /tryAgain/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByAltText("photo.png")).toHaveAttribute(
        "src",
        "https://cdn.example.com/retry.png"
      );
    });
  });

  it("NP-4: does not render dead Prev/Next arrows when onNavigate is omitted even with multiple files", () => {
    render(<FileLightbox file={sampleFiles[1]} files={sampleFiles} onClose={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /previousImage/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /nextImage/i })).not.toBeInTheDocument();
  });
});
