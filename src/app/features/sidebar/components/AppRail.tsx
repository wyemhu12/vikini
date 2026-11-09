"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Command, Loader2, PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RAIL_ITEMS } from "../../layout/utils/shellNav";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { rehydrateLayoutStore } from "@/lib/store/layoutStore";
import { cn } from "@/lib/utils/cn";
import {
  RAIL_BUTTON_CLASS,
  RailAccountMenu,
  RailSettingsMenu,
  type RailSessionUser,
} from "./RailMenus";

interface AppRailProps {
  onNewChat?: () => void;
  isCreatingChat?: boolean;
  onOpenCommandPalette?: () => void;
  panelCollapsed: boolean;
  onTogglePanel?: () => void;
  user?: RailSessionUser | null;
  onLogout?: () => void;
}

function RailTooltip({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

/** Desktop 64px icon rail: new chat, section links, quick commands, settings and account. */
export default function AppRail({
  onNewChat,
  isCreatingChat = false,
  onOpenCommandPalette,
  panelCollapsed,
  onTogglePanel,
  user,
  onLogout,
}: AppRailProps) {
  const { t } = useLanguage();
  const pathname = usePathname() ?? "/";

  // Persisted layout loads after hydration so SSR and the first client render match.
  React.useEffect(() => {
    rehydrateLayoutStore();
  }, []);

  return (
    <nav
      aria-label={t("railMain")}
      className="hidden md:flex fixed inset-y-0 left-0 z-30 w-[calc(4rem+var(--sal,0px))] pl-[var(--sal,0px)] flex-col items-center gap-1.5 py-3 bg-(--surface) border-r border-(--line)"
    >
      <RailTooltip label={t("newChat")}>
        <button
          type="button"
          aria-label={t("newChat")}
          onClick={onNewChat}
          disabled={isCreatingChat}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-(--accent) text-(--on-accent) hover:brightness-110 transition-[filter] disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
        >
          {isCreatingChat ? (
            <Loader2 aria-hidden className="h-5 w-5 animate-spin" />
          ) : (
            <Plus aria-hidden className="h-5 w-5" />
          )}
        </button>
      </RailTooltip>

      <div aria-hidden className="my-1 h-px w-8 bg-(--line)" />

      {RAIL_ITEMS.map(({ id, href, icon: Icon, labelKey, match }) => {
        const current = match(pathname);
        return (
          <RailTooltip key={id} label={t(labelKey)}>
            <Link
              href={href}
              aria-label={t(labelKey)}
              aria-current={current ? "page" : undefined}
              className={cn(RAIL_BUTTON_CLASS, current && "bg-(--soft) text-(--accent)")}
            >
              <Icon aria-hidden className="h-5 w-5" />
            </Link>
          </RailTooltip>
        );
      })}

      <div className="flex-1" />

      {onTogglePanel && (
        <RailTooltip label={panelCollapsed ? t("panelShow") : t("panelHide")}>
          <button
            type="button"
            aria-label={panelCollapsed ? t("panelShow") : t("panelHide")}
            aria-expanded={!panelCollapsed}
            onClick={onTogglePanel}
            className={RAIL_BUTTON_CLASS}
          >
            {panelCollapsed ? (
              <PanelLeftOpen aria-hidden className="h-5 w-5" />
            ) : (
              <PanelLeftClose aria-hidden className="h-5 w-5" />
            )}
          </button>
        </RailTooltip>
      )}
      {onOpenCommandPalette && (
        <RailTooltip label={t("railCommandPalette")}>
          <button
            type="button"
            aria-label={t("railCommandPalette")}
            onClick={onOpenCommandPalette}
            className={RAIL_BUTTON_CLASS}
          >
            <Command aria-hidden className="h-5 w-5" />
          </button>
        </RailTooltip>
      )}
      <RailSettingsMenu />
      <RailAccountMenu user={user} onLogout={onLogout} />
    </nav>
  );
}
