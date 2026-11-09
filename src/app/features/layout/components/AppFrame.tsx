"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import Sidebar from "../../sidebar/components/Sidebar";
import HeaderBar from "./HeaderBar";
import { useAppFrameState } from "../hooks/useAppFrameState";
import { getShellPaddingClass } from "../utils/shellNav";
import { cn } from "@/lib/utils/cn";
import { useCommandPaletteStore } from "@/lib/store/commandPaletteStore";

interface AppFrameProps {
  children: React.ReactNode;
  /** Visually hidden page h1, for pages that do not render a PageHeader. */
  title?: string;
}

/** Shared page frame: sidebar (drawer on mobile), header and a scrollable content area. */
export default function AppFrame({ children, title }: AppFrameProps) {
  const f = useAppFrameState();
  const router = useRouter();
  const { data: session } = useSession();
  const openPalette = useCommandPaletteStore((s) => s.open);

  return (
    <div className="h-dvh w-full flex overflow-hidden relative font-sans bg-(--bg) text-(--text)">
      <Sidebar
        conversations={f.mainChats}
        allConversations={f.allConversations}
        onSelectConversation={(id) => router.push(`/?id=${id}`)}
        onNewChat={() => router.push("/")}
        collapsed={f.sidebarCollapsed}
        onToggleCollapse={f.toggleCollapsed}
        onOpenCommandPalette={openPalette}
        mobileOpen={f.mobileOpen}
        onCloseMobile={f.closeMobile}
        session={session}
        onLogout={() => void signOut({ callbackUrl: "/auth/signin" })}
      />

      <div
        className={cn(
          "flex-1 min-w-0 flex flex-col h-full relative z-10 pr-[var(--sar,0px)]",
          getShellPaddingClass(f.sidebarCollapsed)
        )}
      >
        <HeaderBar hideOnDesktop onToggleSidebar={f.openMobile} />
        <div
          id="page-content"
          className="flex-1 overflow-y-auto pt-[calc(4.75rem+1px+var(--sat,0px))] md:pt-0"
        >
          {title && <h1 className="sr-only">{title}</h1>}
          {children}
        </div>
      </div>
    </div>
  );
}
