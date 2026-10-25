// /app/features/novelcrafter/hooks/useDockedPanes.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  applyDockedPaneToggle,
  resolveInitialDockedPanes,
  type DockedPaneId,
  type StudioLayoutConfig,
} from "@/lib/features/novelcrafter/studioLayout";

export interface DockedPanesController {
  openOrder: DockedPaneId[];
  isOpen: (id: DockedPaneId) => boolean;
  toggle: (id: DockedPaneId) => void;
  open: (id: DockedPaneId) => void;
  close: (id: DockedPaneId) => void;
  closeAll: () => void;
}

export function useDockedPanes(config: StudioLayoutConfig): DockedPanesController {
  const max = config.maxDockedSidePanes;

  const [openOrder, setOpenOrder] = useState<DockedPaneId[]>(() => resolveInitialDockedPanes(max));
  const [drawerPane, setDrawerPane] = useState<DockedPaneId | null>(null);

  useEffect(() => {
    if (max <= 0) {
      setOpenOrder([]);
      return;
    }
    setDrawerPane(null);
    setOpenOrder((prev) => {
      if (prev.length === 0) return resolveInitialDockedPanes(max);
      if (prev.length > max) return prev.slice(prev.length - max);
      return prev;
    });
  }, [max]);

  const isOpen = useCallback(
    (id: DockedPaneId): boolean => {
      if (max <= 0) return drawerPane === id;
      return openOrder.includes(id);
    },
    [drawerPane, max, openOrder]
  );

  const toggle = useCallback(
    (id: DockedPaneId) => {
      if (max <= 0) {
        setDrawerPane((prev) => (prev === id ? null : id));
        return;
      }
      setOpenOrder((prev) => applyDockedPaneToggle(prev, id, max));
    },
    [max]
  );

  const open = useCallback(
    (id: DockedPaneId) => {
      if (max <= 0) {
        setDrawerPane(id);
        return;
      }
      setOpenOrder((prev) => (prev.includes(id) ? prev : applyDockedPaneToggle(prev, id, max)));
    },
    [max]
  );

  const close = useCallback(
    (id: DockedPaneId) => {
      if (max <= 0) {
        setDrawerPane((prev) => (prev === id ? null : prev));
        return;
      }
      setOpenOrder((prev) => prev.filter((item) => item !== id));
    },
    [max]
  );

  const closeAll = useCallback(() => {
    setOpenOrder([]);
    setDrawerPane(null);
  }, []);

  return {
    openOrder,
    isOpen,
    toggle,
    open,
    close,
    closeAll,
  };
}
