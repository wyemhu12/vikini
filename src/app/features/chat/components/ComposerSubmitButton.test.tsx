import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ComposerSubmitButton } from "./ComposerSubmitButton";

vi.mock("../hooks/useLanguage", () => ({
  useLanguage: () => ({
    language: "vi",
    t: (key: string) => {
      const dict: Record<string, string> = {
        send: "Gửi",
        stopBtn: "Dừng",
        stopGeneration: "Dừng tạo phản hồi",
        cancelPendingSend: "Hủy gửi",
        sendWhenUploadsReady: "Sẽ tự động gửi khi tải tệp xong",
      };
      return dict[key] ?? key;
    },
  }),
}));

describe("ComposerSubmitButton (TC-QS-02, TC-QS-06, TC-QS-09)", () => {
  it("switches to type=button click-to-cancel when pendingSend is active without submitting the parent form", () => {
    const onFormSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    const onCancelPendingSend = vi.fn();

    render(
      <form onSubmit={onFormSubmit}>
        <ComposerSubmitButton
          isStreaming={false}
          isPendingSend={true}
          isUploadBusy={true}
          isImageMode={false}
          isReady={true}
          onCancelPendingSend={onCancelPendingSend}
        />
      </form>
    );

    const pendingBtn = screen.getByTestId("composer-pending-send-button");
    expect(pendingBtn).toHaveAttribute("type", "button");
    expect(pendingBtn).toHaveAttribute("aria-label", "Hủy gửi");
    fireEvent.click(pendingBtn);
    expect(onCancelPendingSend).toHaveBeenCalledTimes(1);
    expect(onFormSubmit).not.toHaveBeenCalled();
  });

  it("renders submit button for idle disabled, ready upload-busy, and streaming stop states", () => {
    const onCancel = vi.fn();
    const { rerender } = render(
      <ComposerSubmitButton
        isStreaming={false}
        isPendingSend={false}
        isUploadBusy={false}
        isImageMode={false}
        isReady={false}
        onCancelPendingSend={onCancel}
      />
    );
    expect(screen.getByRole("button", { name: "Gửi" })).toBeDisabled();

    rerender(
      <ComposerSubmitButton
        isStreaming={false}
        isPendingSend={false}
        isUploadBusy={true}
        isImageMode={false}
        isReady={true}
        onCancelPendingSend={onCancel}
      />
    );
    const uploadReadyBtn = screen.getByRole("button", {
      name: "Sẽ tự động gửi khi tải tệp xong",
    });
    expect(uploadReadyBtn).toHaveAttribute("type", "submit");
    expect(uploadReadyBtn).not.toBeDisabled();

    rerender(
      <ComposerSubmitButton
        isStreaming={true}
        isPendingSend={false}
        isUploadBusy={false}
        isImageMode={false}
        isReady={false}
        onCancelPendingSend={onCancel}
      />
    );
    const stopBtn = screen.getByRole("button", { name: "Dừng tạo phản hồi" });
    expect(stopBtn).toHaveAttribute("type", "submit");
    expect(stopBtn).not.toBeDisabled();
  });
});
