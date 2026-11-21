import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import * as GlobalErrorModule from "./global-error";
import GlobalErrorView from "./components/GlobalErrorView";
import { LANGUAGE_STORAGE_KEY } from "@/lib/utils/translations/resolveInitialLanguage";

const GlobalError = GlobalErrorModule.default;

describe("GlobalError & GlobalErrorView (TC-P5-07, NP-4)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = "";
    document.title = "";
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = "";
    document.title = "";
    vi.restoreAllMocks();
  });

  it("exports ONLY default from Next.js App Router special file global-error.tsx and renders html/body shell", () => {
    expect(Object.keys(GlobalErrorModule)).toEqual(["default"]);

    const err = Object.assign(new Error("Fatal crash"), { digest: "DIG-999" });
    const html = renderToStaticMarkup(<GlobalError error={err} reset={vi.fn()} />);

    expect(html).toContain('<html lang="en"');
    expect(html).toContain("<body");
    expect(html).toContain('<main role="alert"');
    expect(html).toContain("<h1");
    expect(html).toContain("DIG-999");
    expect(html).toContain('type="button"');
  });

  it("GlobalErrorView renders Vietnamese copy, digest, and updates document.documentElement.lang when localStorage is vi", async () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "vi");
    const reset = vi.fn();
    const err = Object.assign(new Error("Crash"), { digest: "ERR-42" });

    render(<GlobalErrorView error={err} reset={reset} />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: "Lỗi hệ thống nghiêm trọng" })
      ).toBeInTheDocument();
      expect(document.documentElement.lang).toBe("vi");
      expect(document.title).toBe("Lỗi hệ thống nghiêm trọng");
    });

    expect(screen.getByText(/Mã tham chiếu:\s*ERR-42/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Tải lại trang" })).toBeInTheDocument();
  });

  it("GlobalErrorView renders English copy when localStorage is en", async () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "en");
    const reset = vi.fn();
    const err = Object.assign(new Error("Crash"), { digest: "ERR-77" });

    render(<GlobalErrorView error={err} reset={reset} />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 1, name: "Critical system error" })
      ).toBeInTheDocument();
      expect(document.documentElement.lang).toBe("en");
    });
    expect(screen.getByText(/Reference ID:\s*ERR-77/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("NP-4: degrades safely without crashing when localStorage.getItem throws SecurityError", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    const reset = vi.fn();

    render(<GlobalErrorView error={new Error("Crash")} reset={reset} />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0]);
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
