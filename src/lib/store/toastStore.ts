import { create } from "zustand";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastTimerEntry {
  timerId: ReturnType<typeof setTimeout> | null;
  startedAt: number | null;
  remainingMs: number;
  hoverPaused: boolean;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (message: string, type: ToastType, duration?: number) => string;
  removeToast: (id: string) => void;
  pauseToast: (id: string) => void;
  resumeToast: (id: string) => void;
  setVisibilityPaused: (paused: boolean) => void;
  clearAllToasts: () => void;
}

const timers = new Map<string, ToastTimerEntry>();
let visibilityPaused = false;

function clearEntryTimeout(entry: ToastTimerEntry): void {
  if (entry.timerId !== null) {
    clearTimeout(entry.timerId);
    if (entry.startedAt !== null) {
      entry.remainingMs = Math.max(0, entry.remainingMs - (Date.now() - entry.startedAt));
    }
    entry.timerId = null;
    entry.startedAt = null;
  }
}

export const useToastStore = create<ToastStore>((set, get) => {
  const syncTimer = (id: string) => {
    const entry = timers.get(id);
    if (!entry) return;

    if (entry.hoverPaused || visibilityPaused) {
      clearEntryTimeout(entry);
      return;
    }

    if (entry.timerId !== null) return;

    if (entry.remainingMs <= 0) {
      get().removeToast(id);
      return;
    }

    entry.startedAt = Date.now();
    entry.timerId = setTimeout(() => {
      get().removeToast(id);
    }, entry.remainingMs);
  };

  return {
    toasts: [],
    addToast: (message, type, duration = 5000) => {
      const id = Math.random().toString(36).substring(2, 9);
      set((state) => ({
        toasts: [...state.toasts, { id, message, type, duration }],
      }));

      // Sticky toasts (duration <= 0) are never tracked in the timers Map
      if (duration > 0) {
        timers.set(id, {
          timerId: null,
          startedAt: null,
          remainingMs: duration,
          hoverPaused: false,
        });
        syncTimer(id);
      }

      return id;
    },
    removeToast: (id) => {
      const entry = timers.get(id);
      if (entry) {
        clearEntryTimeout(entry);
        timers.delete(id);
      }
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    },
    pauseToast: (id) => {
      const entry = timers.get(id);
      if (!entry) return;
      entry.hoverPaused = true;
      syncTimer(id);
    },
    resumeToast: (id) => {
      const entry = timers.get(id);
      if (!entry) return;
      entry.hoverPaused = false;
      syncTimer(id);
    },
    setVisibilityPaused: (paused) => {
      if (visibilityPaused === paused) return;
      visibilityPaused = paused;
      for (const id of Array.from(timers.keys())) {
        syncTimer(id);
      }
    },
    clearAllToasts: () => {
      for (const entry of timers.values()) {
        clearEntryTimeout(entry);
      }
      timers.clear();
      visibilityPaused = false;
      set({ toasts: [] });
    },
  };
});

export const toast = {
  success: (msg: string, dur?: number) => useToastStore.getState().addToast(msg, "success", dur),
  error: (msg: string, dur?: number) => useToastStore.getState().addToast(msg, "error", dur),
  info: (msg: string, dur?: number) => useToastStore.getState().addToast(msg, "info", dur),
  warning: (msg: string, dur?: number) => useToastStore.getState().addToast(msg, "warning", dur),
};
