import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ControlPanelReferenceImages from "./ControlPanelReferenceImages";
import { toast } from "@/lib/store/toastStore";

vi.mock("@/lib/store/toastStore", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("../../chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "en",
    t: (key: string) => {
      const dict: Record<string, string> = {
        studioReferenceImages: "Reference images",
        studioRefCount: "{{count}}/4",
        studioUploadRef: "Upload reference",
        studioRefImagesDesc: "Up to 4 images",
        studioRemoveRef: "Remove reference",
        studioAddMoreRef: "Add more",
        studioRefOnlyGemini: "Gemini only",
        describeInvalidImage: "Invalid image file",
        describeFileTooLarge: "Image too large",
        studioRefFileTooLarge: "Reference image size must be under 40MB",
        studioRefMaxReached: "Maximum {max} reference images",
      };
      return dict[key] ?? key;
    },
  }),
}));

function Harness({ initial = [] as File[] }) {
  const [files, setFiles] = useState<File[]>(initial);
  return (
    <ControlPanelReferenceImages
      model="gemini-3-pro-image"
      referenceImages={files}
      setReferenceImages={setFiles}
    />
  );
}

describe("ControlPanelReferenceImages (TC-SU-09)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders CSP-safe data URL previews with stable keys, removes cleanly without blanking peers, keeps remove button touch-accessible, and validates drops", async () => {
    const f1 = new File(["1"], "one.png", { type: "image/png" });
    const f2 = new File(["2"], "two.png", { type: "image/png" });
    const f3 = new File(["3"], "three.png", { type: "image/png" });

    render(<Harness initial={[f1, f2, f3]} />);

    await waitFor(() => {
      expect(screen.getByAltText("one.png").getAttribute("src")).toMatch(
        /^data:image\/png;base64,/
      );
      expect(screen.getByAltText("two.png").getAttribute("src")).toMatch(
        /^data:image\/png;base64,/
      );
      expect(screen.getByAltText("three.png").getAttribute("src")).toMatch(
        /^data:image\/png;base64,/
      );
    });

    // Touch-accessible remove button (opacity-100 on mobile, md:opacity-0 on desktop)
    const removeFirst = screen.getByRole("button", { name: "Remove reference: one.png" });
    expect(removeFirst.className).toContain("opacity-100");
    expect(removeFirst.className).toContain("md:opacity-0");

    // Removing image #1 preserves existing thumbnails without blanking peers
    fireEvent.click(removeFirst);
    await waitFor(() => {
      expect(screen.queryByAltText("one.png")).not.toBeInTheDocument();
    });
    expect(screen.getByAltText("two.png").getAttribute("src")).toMatch(/^data:image\/png;base64,/);
    expect(screen.getByAltText("three.png").getAttribute("src")).toMatch(
      /^data:image\/png;base64,/
    );

    // Input accept attribute must align with server 4-MIME whitelist
    const fileInput = screen.getByLabelText("Upload reference") as HTMLInputElement;
    expect(fileInput.accept).toBe("image/png,image/jpeg,image/webp,image/gif");

    // Dropping invalid .txt / .svg / .heic, oversized 41MB image, 12MB accepted image, and 2 more images (2 slots left -> 1 over limit)
    const badTxt = new File(["txt"], "doc.txt", { type: "text/plain" });
    const badSvg = new File(["<svg/>"], "vec.svg", { type: "image/svg+xml" });
    const badHeic = new File(["heic"], "photo.heic", { type: "image/heic" });
    const hugeImg = new File(["big"], "huge.png", { type: "image/png" });
    Object.defineProperty(hugeImg, "size", { value: 41 * 1024 * 1024 });
    const twelveMbImg = new File(["4"], "four.png", { type: "image/png" });
    Object.defineProperty(twelveMbImg, "size", { value: 12 * 1024 * 1024 });
    const f5 = new File(["5"], "five.png", { type: "image/png" });
    const f6 = new File(["6"], "six.png", { type: "image/png" });

    const wrapper = screen.getByText("Reference images").closest("div")
      ?.parentElement as HTMLElement;
    fireEvent.drop(wrapper, {
      dataTransfer: {
        files: [badTxt, badSvg, badHeic, hugeImg, twelveMbImg, f5, f6],
        types: ["Files"],
      },
    });

    expect(toast.error).toHaveBeenCalledWith("Invalid image file");
    expect(toast.error).toHaveBeenCalledWith("Reference image size must be under 40MB");
    expect(toast.info).toHaveBeenCalledWith("Maximum 4 reference images");

    await waitFor(() => {
      expect(screen.getByAltText("four.png").getAttribute("src")).toMatch(
        /^data:image\/png;base64,/
      );
      expect(screen.getByAltText("five.png").getAttribute("src")).toMatch(
        /^data:image\/png;base64,/
      );
    });
    expect(screen.queryByAltText("six.png")).not.toBeInTheDocument();
  });
});
