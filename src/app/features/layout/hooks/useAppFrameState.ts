"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useConversation, type FrontendConversation } from "../../chat/hooks/useConversation";
import { useLayoutStore } from "@/lib/store/layoutStore";
import { getSectionForPath } from "../utils/shellNav";

/** Conversation models that are storage containers, not chats shown in the sidebar. */
const NON_CHAT_MODELS: ReadonlySet<string> = new Set([
  "vikini-image-studio",
  "user_templates_store",
]);

/** Sidebar data + drawer state for AppFrame pages; panel collapse comes from the shared layout store. */
export function useAppFrameState() {
  const { conversations } = useConversation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const section = getSectionForPath(usePathname());
  const sidebarCollapsed = useLayoutStore((s) => s.panelCollapsedBySection[section]);
  const togglePanel = useLayoutStore((s) => s.togglePanel);

  const allConversations: FrontendConversation[] = useMemo(
    () => conversations || [],
    [conversations]
  );
  const mainChats = useMemo(
    () => allConversations.filter((c) => !NON_CHAT_MODELS.has(c.model ?? "")),
    [allConversations]
  );

  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const toggleCollapsed = useCallback(() => togglePanel(section), [togglePanel, section]);

  return {
    allConversations,
    mainChats,
    mobileOpen,
    sidebarCollapsed,
    openMobile,
    closeMobile,
    toggleCollapsed,
  };
}
