import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TagInput from "./TagInput";

const mockToastError = vi.fn();

vi.mock("../../chat/hooks/useLanguage", () => ({
  useLanguage: () => ({
    t: (k: string) => k,
    language: "vi",
  }),
}));

vi.mock("@/lib/store/toastStore", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: vi.fn(),
  },
}));

describe("TagInput (TC-W3-06, TC-W4-05)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes accessible bilingual labels on add and remove buttons", () => {
    render(<TagInput imageId="img-1" currentTags={["sunset"]} onTagsUpdated={vi.fn()} />);

    const addBtn = screen.getByRole("button", { name: "tagAddLabel" });
    fireEvent.click(addBtn);

    expect(screen.getByRole("button", { name: "tagRemoveLabel: sunset" })).toBeInTheDocument();
  });

  it("shows toast.error when saving tags fails with non-OK HTTP status", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

    render(<TagInput imageId="img-1" currentTags={["sunset"]} onTagsUpdated={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "tagAddLabel" }));
    fireEvent.click(screen.getByRole("button", { name: "tagRemoveLabel: sunset" }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("tagSaveFailed");
    });
  });

  it("shows toast.error when fetch rejects", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch;

    render(<TagInput imageId="img-1" currentTags={["sunset"]} onTagsUpdated={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "tagAddLabel" }));
    const input = screen.getByRole("textbox", { name: "tagAddLabel" });
    fireEvent.change(input, { target: { value: "neon" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("tagSaveFailed");
    });
  });
});
