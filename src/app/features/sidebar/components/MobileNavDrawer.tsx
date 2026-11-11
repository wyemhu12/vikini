"use client";

import React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import { LogOut, Plus, Shield, X } from "lucide-react";
import { shouldCloseDrawer } from "../utils/drawerGesture";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { RAIL_ITEMS } from "../../layout/utils/shellNav";
import { SidebarButton } from "./ContextPanelContent";

interface MobileNavDrawerProps {
  open: boolean;
  onClose?: () => void;
  onLogoClick?: () => void;
  pathname: string;
  onNewChat: () => void;
  isCreatingChat?: boolean;
  /** Present only for admins. */
  onAdmin?: () => void;
  onLogout?: () => void;
  /** Renders the section content with the drawer nav (leading) and account actions (footer). */
  renderContent: (leading: React.ReactNode, footer: React.ReactNode) => React.ReactNode;
}

/** Mobile navigation drawer (Radix Dialog: focus trap + ESC; swipe left to close). */
export default function MobileNavDrawer({
  open,
  onClose,
  onLogoClick,
  pathname,
  onNewChat,
  isCreatingChat = false,
  onAdmin,
  onLogout,
  renderContent,
}: MobileNavDrawerProps) {
  const { t } = useLanguage();

  const leading = (
    <div className="space-y-1">
      <SidebarButton
        onClick={onNewChat}
        icon={Plus}
        label={t("newChat")}
        variant="primary"
        isLoading={isCreatingChat}
      />
      {RAIL_ITEMS.map((item) => (
        <SidebarButton
          key={item.id}
          href={item.href}
          onClick={onClose}
          icon={item.icon}
          label={t(item.labelKey)}
          current={item.match(pathname)}
        />
      ))}
      <div className="h-px bg-(--line)/60 my-2 mx-2" />
    </div>
  );

  const footer = (
    <>
      {onAdmin && <SidebarButton onClick={onAdmin} icon={Shield} label={t("adminManagement")} />}
      {onLogout && (
        <SidebarButton
          onClick={() => {
            onLogout();
            onClose?.();
          }}
          icon={LogOut}
          label={t("signOut")}
          variant="destructive"
        />
      )}
    </>
  );

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose?.();
      }}
    >
      <Dialog.Portal forceMount>
        <AnimatePresence>
          {open && (
            <>
              <Dialog.Overlay asChild forceMount>
                <motion.div
                  className="fixed inset-0 z-(--z-drawer) bg-(--raised)/80 backdrop-blur-sm md:hidden"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                />
              </Dialog.Overlay>
              <Dialog.Content asChild forceMount>
                <motion.nav
                  aria-label={t("navigation")}
                  className="fixed top-0 left-0 bottom-0 z-(--z-drawer) w-[85vw] max-w-sm border-r border-(--line) bg-(--raised) p-5 pt-[calc(1.25rem+var(--sat,0px))] pb-[calc(4rem+var(--sab,0px))] pl-[calc(1.25rem+var(--sal,0px))] shadow-2xl flex flex-col md:hidden"
                  initial={{ x: "-100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "-100%" }}
                  transition={{ duration: 0.25, ease: [0.0, 0.0, 0.2, 1.0] }}
                  drag="x"
                  dragDirectionLock
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={{ left: 0.5, right: 0 }}
                  dragSnapToOrigin
                  onDragEnd={(_, info) => {
                    if (shouldCloseDrawer(info)) onClose?.();
                  }}
                >
                  <Dialog.Title className="sr-only">{t("navigation")}</Dialog.Title>
                  <div className="mb-4 flex items-center justify-between shrink-0">
                    <Link
                      href="/"
                      className="text-lg font-black tracking-tighter text-(--text) flex items-center gap-3 active:opacity-70 transition-opacity"
                      onClick={() => {
                        onLogoClick?.();
                        onClose?.();
                      }}
                    >
                      <div className="h-8 w-8 rounded-lg bg-(--raised) flex items-center justify-center border border-(--line) text-(--accent)">
                        V
                      </div>
                      {t("appName")}
                    </Link>
                    <Dialog.Close asChild>
                      <button
                        aria-label={t("closeSidebar")}
                        className="p-2 rounded-full text-(--muted) hover:bg-(--raised) hover:text-(--text) transition-colors focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:outline-none"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </Dialog.Close>
                  </div>
                  {renderContent(leading, footer)}
                </motion.nav>
              </Dialog.Content>
            </>
          )}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
