// src/app/features/image-gen/components/DescribeImageView.test.tsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DescribeImageView } from "./DescribeImageView";
import { toast } from "@/lib/store/toastStore";

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...rest}>{children}</div>
    ),
    button: ({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button {...rest}>{children}</button>
    ),
  },
}));

vi.mock("@/lib/store/toastStore", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/describe",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("../../layout/components/AppFrame", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-frame">{children}</div>
  ),
}));

vi.mock("../../chat/hooks/useTheme", () => ({
  useTheme: () => ({ theme: "hoanghon-dark", setTheme: vi.fn() }),
}));

vi.mock("../../chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "vi",
    setLanguage: vi.fn(),
    t: (key: string) =>
      ({
        imagesTitle: "Ảnh",
        imageSectionNav: "Chế độ ảnh",
        imageTabCreate: "Tạo ảnh",
        imageTabLibrary: "Thư viện",
        imageTabDescribe: "Mô tả ảnh",
      })[key] ?? key,
    langs: ["vi", "en"] as const,
  }),
}));

describe("DescribeImageView (phase 4 TC-08)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("uses the shared Images header with the Describe tab current", () => {
    render(<DescribeImageView />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Ảnh" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mô tả ảnh" })).toHaveAttribute("aria-current", "page");
  });

  it("styles the drop zone with tokens and no uppercase labels", () => {
    const { container } = render(<DescribeImageView />);
    const classes = Array.from(container.querySelectorAll("*")).map(
      (el) => el.getAttribute("class") ?? ""
    );
    expect(classes.filter((c) => /(purple|indigo|blue-[0-9])/.test(c))).toEqual([]);
    expect(classes.filter((c) => c.split(/\s+/).includes("uppercase"))).toEqual([]);
  });

  it("TC-P1-04: clicking a history item shows its thumbnail and prompt result", () => {
    localStorage.setItem(
      "vikini-describe-history",
      JSON.stringify([
        {
          thumbnail: "data:image/png;base64,abc",
          prompt: "A golden sunset over Saigon",
          timestamp: Date.now(),
        },
      ])
    );

    render(<DescribeImageView />);
    fireEvent.click(screen.getByRole("button", { name: /A golden sunset over Saigon/i }));

    expect(screen.getByText("A golden sunset over Saigon")).toBeInTheDocument();
    expect(screen.getByAltText("describeUploadedAlt")).toHaveAttribute(
      "src",
      "data:image/png;base64,abc"
    );
    expect(screen.getByRole("button", { name: "describeCopy" })).toBeInTheDocument();
  });

  it("TC-P1-04: clicking a history item with empty thumbnail still displays prompt without empty img src", () => {
    localStorage.setItem(
      "vikini-describe-history",
      JSON.stringify([
        {
          thumbnail: "",
          prompt: "Minimalist ink illustration",
          timestamp: Date.now(),
        },
      ])
    );

    render(<DescribeImageView />);
    fireEvent.click(screen.getByRole("button", { name: /Minimalist ink illustration/i }));

    expect(screen.getByText("Minimalist ink illustration")).toBeInTheDocument();
    expect(screen.queryByAltText("describeUploadedAlt")).toBeNull();
  });

  it("TC-P1-04: handles localStorage.removeItem failure safely and fires bilingual error toast for non-image files", () => {
    localStorage.setItem(
      "vikini-describe-history",
      JSON.stringify([{ thumbnail: "", prompt: "Saved item", timestamp: Date.now() }])
    );
    const removeSpy = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("QuotaBlocked");
    });

    const { container } = render(<DescribeImageView />);
    expect(() =>
      fireEvent.click(screen.getByRole("button", { name: /studioClearHistory/i }))
    ).not.toThrow();
    removeSpy.mockRestore();

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const textFile = new File(["hello"], "notes.txt", { type: "text/plain" });
    fireEvent.change(fileInput, { target: { files: [textFile] } });
    expect(toast.error).toHaveBeenCalledWith("describeInvalidImage");
  });

  it("TC-W3-06: renders dropzone as native button without nested interactive elements", () => {
    const { container } = render(<DescribeImageView />);
    const dropBtn = screen.getByRole("button", { name: /describeUpload/i });
    expect(dropBtn.tagName).toBe("BUTTON");
    expect(dropBtn.querySelector("input")).toBeNull();
    expect(container.querySelector('input[type="file"]')).not.toBeNull();
  });
});
