import React from "react";
import {
  BookOpen,
  Image as ImageIcon,
  LayoutGrid,
  MessageSquare,
  Search,
  Sparkles,
  UserCircle,
  type LucideIcon,
} from "lucide-react";
import type { CommandItem } from "../../chat/components/CommandPalette";

export interface BuildNavigationCommandsOptions {
  t: (key: string) => string;
  onNavigate: (href: string) => void;
}

interface NavCommandSpec {
  id: string;
  href: string;
  labelKey: string;
  icon: LucideIcon;
}

const NAV_COMMAND_SPECS: readonly NavCommandSpec[] = [
  { id: "go-chat", href: "/", labelKey: "chat", icon: MessageSquare },
  { id: "go-gems", href: "/features/gems", labelKey: "gemsTitle", icon: Sparkles },
  { id: "go-personas", href: "/features/personas", labelKey: "personasTitle", icon: UserCircle },
  { id: "go-images", href: "/images", labelKey: "imageTabCreate", icon: ImageIcon },
  { id: "go-gallery", href: "/gallery", labelKey: "imageTabLibrary", icon: LayoutGrid },
  { id: "go-describe", href: "/describe", labelKey: "imageTabDescribe", icon: Search },
  { id: "go-novelcrafter", href: "/novelcrafter", labelKey: "novelcrafterStudio", icon: BookOpen },
];

/** Shared navigation commands for both Chat CommandPalette and GlobalCommandPalette. */
export function buildNavigationCommands({
  t,
  onNavigate,
}: BuildNavigationCommandsOptions): CommandItem[] {
  const prefix = t("commandGoTo");
  return NAV_COMMAND_SPECS.map(({ id, href, labelKey, icon }) => ({
    id,
    title: `${prefix} ${t(labelKey)}`,
    category: "navigation",
    icon: React.createElement(icon, {
      className: "w-4 h-4 text-(--accent)",
      "aria-hidden": true,
    }),
    perform: () => onNavigate(href),
  }));
}
