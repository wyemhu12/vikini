import { create } from "zustand";

export interface ConfirmOptions {
  /** Bold heading of the dialog. */
  title: string;
  /** Optional supporting line under the title. */
  description?: string;
  /** Confirm button label. Defaults provided by the host per language. */
  confirmLabel?: string;
  /** Cancel button label. */
  cancelLabel?: string;
  /** "danger" gives the destructive red treatment + glow. */
  variant?: "default" | "danger";
  /**
   * Optional async work to run while the dialog shows a loading state.
   * If provided, the dialog stays open (buttons disabled, spinner shown)
   * until it resolves, then closes. Throwing keeps the dialog open.
   */
  onConfirm?: () => Promise<void> | void;
}

interface ConfirmState {
  open: boolean;
  loading: boolean;
  options: ConfirmOptions | null;
  resolve: ((value: boolean) => void) | null;
  request: (options: ConfirmOptions) => Promise<boolean>;
  /** Internal: called by the host when the user picks confirm/cancel. */
  settle: (value: boolean) => Promise<void>;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  loading: false,
  options: null,
  resolve: null,
  request: (options) =>
    new Promise<boolean>((resolve) => {
      set({ open: true, loading: false, options, resolve });
    }),
  settle: async (value) => {
    const { options, resolve } = get();

    if (value && options?.onConfirm) {
      set({ loading: true });
      try {
        await options.onConfirm();
      } catch (err) {
        // Keep the dialog open so the user can retry; surface the error upstream.
        set({ loading: false });
        throw err;
      }
    }

    resolve?.(value);
    set({ open: false, loading: false, resolve: null });
  },
}));

/**
 * Imperative confirmation prompt — the canonical replacement for window.confirm().
 *
 * @example
 * if (await confirm({ title: "Delete project?", variant: "danger" })) {
 *   await deleteProject();
 * }
 *
 * @example with in-dialog loading
 * await confirm({ title: "Delete?", variant: "danger", onConfirm: () => deleteProject() });
 */
export const confirm = (options: ConfirmOptions) => useConfirmStore.getState().request(options);
