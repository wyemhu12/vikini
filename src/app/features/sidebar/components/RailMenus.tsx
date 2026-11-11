"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { LogOut, Settings, Shield, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import ThemeMenuItems from "../../layout/components/ThemeMenuItems";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { cn } from "@/lib/utils/cn";

export const RAIL_BUTTON_CLASS =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-(--muted) hover:bg-(--raised) hover:text-(--text) transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)";

const LABEL_CLASS = "text-xs font-bold uppercase tracking-widest text-(--muted) px-2 py-1.5";

export interface RailSessionUser {
  name?: string | null;
  email?: string | null;
  rank?: string;
}

/** Icon-only trigger with a right-side tooltip carrying its accessible name. */
const RailMenuTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }
>(function RailMenuTrigger({ label, className, children, ...props }, ref) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={ref}
          type="button"
          aria-label={label}
          className={cn(RAIL_BUTTON_CLASS, className)}
          {...props}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
});

/** Rail settings: interface language + theme family/mode. */
export function RailSettingsMenu() {
  const { t, language, setLanguage } = useLanguage();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <RailMenuTrigger label={t("railSettings")}>
          <Settings aria-hidden className="h-5 w-5" />
        </RailMenuTrigger>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" className="w-56">
        <DropdownMenuLabel className={LABEL_CLASS}>{t("language")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={language}
          onValueChange={(value) => (value === "vi" || value === "en") && setLanguage(value)}
        >
          <DropdownMenuRadioItem value="vi" className="text-xs font-medium cursor-pointer">
            {t("vi")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="en" className="text-xs font-medium cursor-pointer">
            {t("en")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <ThemeMenuItems />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface RailAccountMenuProps {
  user?: RailSessionUser | null;
  onLogout?: () => void;
}

/** Rail account menu: identity, admin console (admins only) and sign out. */
export function RailAccountMenu({ user, onLogout }: RailAccountMenuProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const isAdmin = user?.rank === "admin";
  if (!user && !onLogout) return null;

  const initial = (user?.name || user?.email || "").trim().charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <RailMenuTrigger label={t("railAccount")} className="rounded-full">
          {initial ? (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-(--soft) text-sm font-semibold text-(--accent)">
              {initial}
            </span>
          ) : (
            <User aria-hidden className="h-5 w-5" />
          )}
        </RailMenuTrigger>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" className="w-60">
        {(user?.name || user?.email) && (
          <DropdownMenuLabel className="font-normal">
            {user?.name && <p className="text-sm font-semibold truncate">{user.name}</p>}
            {user?.email && <p className="text-xs text-(--muted) truncate">{user.email}</p>}
          </DropdownMenuLabel>
        )}
        {isAdmin && (
          <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => router.push("/admin")}>
            <Shield aria-hidden className="h-4 w-4" />
            {t("adminManagement")}
          </DropdownMenuItem>
        )}
        {onLogout && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 cursor-pointer text-(--danger) focus:text-(--danger)"
              onClick={onLogout}
            >
              <LogOut aria-hidden className="h-4 w-4" />
              {t("signOut")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
