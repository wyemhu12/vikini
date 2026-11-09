"use client";

import React, { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { LayoutGrid } from "lucide-react";
import { CommandPalette, type CommandItem } from "../../chat/components/CommandPalette";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { useAppFrameState } from "../hooks/useAppFrameState";
import { RAIL_ITEMS, getSectionForPath } from "../utils/shellNav";
import { useCommandPaletteStore } from "@/lib/store/commandPaletteStore";

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

  const navCommands = useMemo<CommandItem[]>(() => {
    const go = (href: string) => () => {
      onClose();
      router.push(href);
    };
    const items: CommandItem[] = RAIL_ITEMS.map(({ id, href, icon: Icon, labelKey }) => ({
      id: `go-${id}`,
      title: `${t("commandGoTo")} ${t(labelKey)}`,
      category: "navigation",
      icon: <Icon className="w-4 h-4 text-(--accent)" />,
      perform: go(href),
    }));
    items.push({
      id: "go-gallery",
      title: `${t("commandGoTo")} ${t("gallery")}`,
      category: "navigation",
      icon: <LayoutGrid className="w-4 h-4 text-(--accent)" />,
      perform: go("/gallery"),
    });
    return items;
  }, [onClose, router, t]);

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
    status === "authenticated" &&
    !pathname.startsWith("/auth") &&
    getSectionForPath(pathname) !== "chat";

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
