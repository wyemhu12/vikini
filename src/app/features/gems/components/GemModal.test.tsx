import { render, act } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import GemModal from "./GemModal";
import { useGemStore } from "../stores/useGemStore";
import { confirm } from "@/lib/store/confirmStore";

// Mock confirmStore
vi.mock("@/lib/store/confirmStore", () => ({
  confirm: vi.fn(),
}));

// Mock GemManager to isolate modal testing
vi.mock("./GemManager", () => ({
  default: () => <div data-testid="gem-manager">Gem Manager</div>,
}));

// Mock Dialog to expose onOpenChange directly
let capturedOnOpenChange: ((open: boolean) => void) | undefined;
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => {
    capturedOnOpenChange = onOpenChange;
    return open ? <div data-testid="dialog">{children}</div> : null;
  },
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("GemModal (TC-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGemStore.setState({
      isOpen: true,
      hasDirtyEditor: false,
    });
    window.confirm = vi.fn();
  });

  it("closes directly when hasDirtyEditor is false", async () => {
    const closeSpy = vi.spyOn(useGemStore.getState(), "closeGemModal");

    render(<GemModal />);

    await act(async () => {
      capturedOnOpenChange?.(false);
    });

    expect(window.confirm).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
    expect(closeSpy).toHaveBeenCalled();
  });

  it("calls confirm with variant: 'danger' when hasDirtyEditor is true and closes if confirmed", async () => {
    useGemStore.setState({ hasDirtyEditor: true });
    vi.mocked(confirm).mockResolvedValue(true);
    const closeSpy = vi.spyOn(useGemStore.getState(), "closeGemModal");

    render(<GemModal />);

    await act(async () => {
      capturedOnOpenChange?.(false);
    });

    expect(window.confirm).not.toHaveBeenCalled();
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "danger",
      })
    );
    expect(closeSpy).toHaveBeenCalled();
  });

  it("does NOT close when user cancels confirm dialog", async () => {
    useGemStore.setState({ hasDirtyEditor: true });
    vi.mocked(confirm).mockResolvedValue(false);
    const closeSpy = vi.spyOn(useGemStore.getState(), "closeGemModal");

    render(<GemModal />);

    await act(async () => {
      capturedOnOpenChange?.(false);
    });

    expect(window.confirm).not.toHaveBeenCalled();
    expect(confirm).toHaveBeenCalled();
    expect(closeSpy).not.toHaveBeenCalled();
  });
});
