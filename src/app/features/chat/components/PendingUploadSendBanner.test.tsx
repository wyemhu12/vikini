import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PendingUploadSendBanner } from "./PendingUploadSendBanner";

vi.mock("../hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "vi",
    t: (key: string) => {
      const dict: Record<string, string> = {
        pendingSendWaiting: "Đang tải tệp lên — sẽ tự động gửi khi hoàn tất",
        pendingSendWaitingCount: "Đang tải {count} tệp lên — sẽ tự động gửi khi hoàn tất",
        cancelPendingSend: "Hủy gửi",
      };
      return dict[key] ?? key;
    },
  }),
}));

describe("PendingUploadSendBanner (TC-QS-09)", () => {
  it("renders nothing when visible is false", () => {
    render(<PendingUploadSendBanner visible={false} activeUploadCount={1} onCancel={vi.fn()} />);
    expect(screen.queryByTestId("pending-upload-send-banner")).not.toBeInTheDocument();
  });

  it("renders singular and plural labels with role=status, native Cancel button, and no transition-all", () => {
    const onCancel = vi.fn();
    const { rerender } = render(
      <PendingUploadSendBanner visible={true} activeUploadCount={1} onCancel={onCancel} />
    );

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Đang tải tệp lên — sẽ tự động gửi khi hoàn tất");
    expect(status.innerHTML).not.toContain("transition-all");

    const cancelBtn = screen.getByRole("button", { name: "Hủy gửi" });
    expect(cancelBtn).toHaveAttribute("type", "button");
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);

    rerender(<PendingUploadSendBanner visible={true} activeUploadCount={3} onCancel={onCancel} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Đang tải 3 tệp lên — sẽ tự động gửi khi hoàn tất"
    );
  });
});
