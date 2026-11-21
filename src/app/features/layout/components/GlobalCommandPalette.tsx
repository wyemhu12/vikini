"use client";

import React, { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { CommandPalette, type CommandItem } from "../../chat/components/CommandPalette";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { useAppFrameState } from "../hooks/useAppFrameState";
import { buildNavigationCommands } from "../utils/navigationCommands";
import { useCommandPaletteStore } from "@/lib/store/commandPaletteStore";

/** True only on routes that mount ChatApp's dedicated CommandPalette. */
export function isChatAppRoute(pathname: string): boolean {
  return (
    pathname === "/" || pathname === "/features/chat" || pathname.startsWith("/features/chat/")
  );
}

/** Typing targets keep ⌘K for themselves (e.g. Novelcrafter Quick Edit, text fields). */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.closest("[contenteditable='true']") !== null
  );
}

/** Mounted only while open, so the conversation list is fetched on demand. */
function OpenPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { t } = useLanguage();
  const { mainChats } = useAppFrameState();

  const navCommands = useMemo<CommandItem[]>(
    () =>
      buildNavigationCommands({
        t,
        onNavigate: (href) => {
          onClose();
          router.push(href);
        },
      }),
    [onClose, router, t]
  );

  return (
    <CommandPalette
      isOpen={true}
      onClose={onClose}
      onNewChat={() => router.push("/")}
      extraCommands={navCommands}
      conversations={mainChats}
      onSelectConversation={(id) => router.push(`/?id=${id}`)}
    />
  );
}

/** App-wide command palette for signed-in pages outside Chat (Chat keeps its own palette). */
export default function GlobalCommandPalette() {
  const pathname = usePathname() ?? "/";
  const { status } = useSession();
  const isOpen = useCommandPaletteStore((s) => s.isOpen);
  const close = useCommandPaletteStore((s) => s.close);
  const toggle = useCommandPaletteStore((s) => s.toggle);
  const enabled =
    status === "authenticated" && !pathname.startsWith("/auth") && !isChatAppRoute(pathname);

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isEditableTarget(e.target)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, toggle]);

  useEffect(() => {
    if (!enabled) close();
  }, [enabled, close]);

  if (!enabled || !isOpen) return null;
  return <OpenPalette onClose={close} />;
}
