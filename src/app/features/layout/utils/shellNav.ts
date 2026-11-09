// App shell navigation model: rail items, section lookup and content padding.

import {
  BookOpen,
  Image as ImageIcon,
  MessageSquare,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { ShellSection } from "@/lib/store/layoutStore";
import type { TranslationKey } from "@/lib/utils/config";

export interface RailItem {
  id: "chat" | "gems" | "images" | "novelcrafter";
  href: string;
  icon: LucideIcon;
  labelKey: TranslationKey;
  match: (pathname: string) => boolean;
}

const startsWithAny = (pathname: string, prefixes: readonly string[]) =>
  prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

const IMAGE_ROUTES = ["/images", "/gallery", "/describe"] as const;

export const RAIL_ITEMS: readonly RailItem[] = [
  {
    id: "chat",
    href: "/",
    icon: MessageSquare,
    labelKey: "chat",
    match: (p) => p === "/" || startsWithAny(p, ["/projects", "/features/chat"]),
  },
  {
    id: "gems",
    href: "/gems",
    icon: Sparkles,
    labelKey: "railGemsPersonas",
    match: (p) => startsWithAny(p, ["/gems", "/features/gems", "/features/personas"]),
  },
  {
    id: "images",
    href: "/images",
    icon: ImageIcon,
    labelKey: "railImages",
    match: (p) => startsWithAny(p, IMAGE_ROUTES),
  },
  {
    id: "novelcrafter",
    href: "/novelcrafter",
    icon: BookOpen,
    labelKey: "novelcrafterStudio",
    match: (p) => startsWithAny(p, ["/novelcrafter"]),
  },
];

/** Which context panel a route belongs to (each section remembers its own collapsed state). */
export function getSectionForPath(pathname: string | null): ShellSection {
  const p = pathname ?? "/";
  if (p === "/" || startsWithAny(p, ["/projects", "/features/chat"])) return "chat";
  if (startsWithAny(p, IMAGE_ROUTES)) return "images";
  if (startsWithAny(p, ["/novelcrafter"])) return "novelcrafter";
  return "pages";
}

/** Desktop left padding for page content: rail (4rem) + context panel (17rem) when open. */
export function getShellPaddingClass(panelCollapsed: boolean): string {
  return panelCollapsed
    ? "md:pl-[calc(4rem+var(--sal,0px))]"
    : "md:pl-[calc(21rem+var(--sal,0px))]";
}
