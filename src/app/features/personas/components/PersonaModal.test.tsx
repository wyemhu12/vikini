import { render, act } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import PersonaModal from "./PersonaModal";
import { usePersonaStore } from "../stores/usePersonaStore";
import { confirm } from "@/lib/store/confirmStore";

// Mock confirmStore
vi.mock("@/lib/store/confirmStore", () => ({
  confirm: vi.fn(),
}));

// Mock PersonaManager to isolate modal testing
vi.mock("./PersonaManager", () => ({
  default: () => <div data-testid="persona-manager">Persona Manager</div>,
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

describe("PersonaModal (TC-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePersonaStore.setState({
      isOpen: true,
      hasDirtyEditor: false,
    });
    window.confirm = vi.fn();
  });

  it("closes directly when hasDirtyEditor is false", async () => {
    const closeSpy = vi.spyOn(usePersonaStore.getState(), "closePersonaModal");

    render(<PersonaModal />);

    await act(async () => {
      capturedOnOpenChange?.(false);
    });

    expect(window.confirm).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
    expect(closeSpy).toHaveBeenCalled();
  });

  it("calls confirm with variant: 'danger' when hasDirtyEditor is true and closes if confirmed", async () => {
    usePersonaStore.setState({ hasDirtyEditor: true });
    vi.mocked(confirm).mockResolvedValue(true);
    const closeSpy = vi.spyOn(usePersonaStore.getState(), "closePersonaModal");

    render(<PersonaModal />);

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
    usePersonaStore.setState({ hasDirtyEditor: true });
    vi.mocked(confirm).mockResolvedValue(false);
    const closeSpy = vi.spyOn(usePersonaStore.getState(), "closePersonaModal");

    render(<PersonaModal />);

    await act(async () => {
      capturedOnOpenChange?.(false);
    });

    expect(window.confirm).not.toHaveBeenCalled();
    expect(confirm).toHaveBeenCalled();
    expect(closeSpy).not.toHaveBeenCalled();
  });
});
