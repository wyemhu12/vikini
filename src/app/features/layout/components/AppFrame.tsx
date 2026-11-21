"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import Sidebar from "../../sidebar/components/Sidebar";
import HeaderBar from "./HeaderBar";
import { useAppFrameState } from "../hooks/useAppFrameState";
import { getShellPaddingClass } from "../utils/shellNav";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { cn } from "@/lib/utils/cn";
import { useCommandPaletteStore } from "@/lib/store/commandPaletteStore";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
  const { t } = useLanguage();
  const openPalette = useCommandPaletteStore((s) => s.open);

  const isImagesSection = f.section === "images";

  return (
    <div className="h-dvh w-full flex overflow-hidden relative font-sans bg-(--bg) text-(--text)">
      <Sidebar
        conversations={isImagesSection ? f.studioProjects : f.mainChats}
        conversationsLabel={isImagesSection ? t("studioProjectsLabel") : undefined}
        sectionActionLabel={isImagesSection ? t("studioNewProject") : undefined}
        onSectionAction={isImagesSection ? () => void f.handleCreateStudioProject() : undefined}
        allConversations={f.allConversations}
        onSelectConversation={(id) =>
          router.push(isImagesSection ? `/images?projectId=${id}` : `/?id=${id}`)
        }
        onNewChat={() => router.push("/")}
        onRenameChat={f.openRenameChat}
        onDeleteChat={(id) => void f.handleDeleteChat(id)}
        onSelectProject={f.handleSelectProject}
        onCreateProjectChat={f.handleCreateProjectChat}
        onRenameProjectConversation={f.openRenameChat}
        onDeleteProjectConversation={(id) => void f.handleDeleteChat(id)}
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

      <Dialog
        open={Boolean(f.renamingChatId)}
        onOpenChange={(open) => {
          if (!open) f.closeRenameChat();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("renameChat")}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void f.confirmRenameChat();
            }}
            className="space-y-4"
          >
            <Input
              value={f.renameValue}
              onChange={(e) => f.setRenameValue(e.target.value)}
              placeholder={t("renamePlaceholder")}
              autoFocus
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={f.closeRenameChat}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={!f.renameValue.trim()}>
                {t("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
