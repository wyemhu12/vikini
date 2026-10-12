// /app/features/chat/components/hooks/useChatLayoutState.ts
"use client";

import { useCallback, useState } from "react";

interface UseChatLayoutStateOptions {
  /** Navigates back to the landing view (clears conversation & project selection). */
  onNavigateHome: () => void;
}

export interface UseChatLayoutStateReturn {
  mobileOpen: boolean;
  sidebarCollapsed: boolean;
  showMobileControls: boolean;
  closeMobileSidebar: () => void;
  toggleMobileSidebar: () => void;
  /** Mobile only: tapping the chat area toggles the floating controls (ignored on text selection). */
  handleContentTap: (disabled: boolean) => void;
  memoizedOnToggleCollapse: () => void;
  memoizedOnLogoClick: () => void;
}

/** Shell layout state: mobile sidebar drawer, desktop collapse, mobile control visibility. */
export function useChatLayoutState({
  onNavigateHome,
}: UseChatLayoutStateOptions): UseChatLayoutStateReturn {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMobileControls, setShowMobileControls] = useState(true);

  const closeMobileSidebar = useCallback(() => setMobileOpen(false), []);
  const toggleMobileSidebar = useCallback(() => setMobileOpen((v) => !v), []);
  const handleContentTap = useCallback((disabled: boolean) => {
    if (disabled || window.innerWidth >= 768) return;
    setTimeout(() => {
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) return;
      setShowMobileControls((prev) => !prev);
    }, 10);
  }, []);
  const memoizedOnToggleCollapse = useCallback(() => setSidebarCollapsed((prev) => !prev), []);

  const memoizedOnLogoClick = useCallback(() => {
    onNavigateHome();
    closeMobileSidebar();
  }, [onNavigateHome, closeMobileSidebar]);

  return {
    mobileOpen,
    sidebarCollapsed,
    showMobileControls,
    closeMobileSidebar,
    toggleMobileSidebar,
    handleContentTap,
    memoizedOnToggleCollapse,
    memoizedOnLogoClick,
  };
}
