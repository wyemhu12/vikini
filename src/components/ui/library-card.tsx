"use client";

import React from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface LibraryCardMenuItem {
  label: string;
  onSelect: () => void;
  /** Destructive items are listed last, after a separator, in the danger color. */
  danger?: boolean;
}

export interface LibraryCardProps {
  icon?: React.ReactNode;
  title: string;
  badges?: readonly string[];
  description?: string;
  /** Pass a boolean when the card can be "in use"; omit it when selection does not apply. */
  selected?: boolean;
  primaryLabel: string;
  onPrimary: () => void;
  menuLabel?: string;
  menuItems?: readonly LibraryCardMenuItem[];
  className?: string;
}

/** Library item card (Gems, Personas): one primary action, secondary actions in a "⋯" menu. */
export function LibraryCard({
  icon,
  title,
  badges = [],
  description,
  selected,
  primaryLabel,
  onPrimary,
  menuLabel,
  menuItems = [],
  className,
}: LibraryCardProps) {
  const regular = menuItems.filter((item) => !item.danger);
  const destructive = menuItems.filter((item) => item.danger);

  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-(--surface) p-4 transition-colors",
        selected ? "border-(--accent)" : "border-(--line)",
        className
      )}
    >
      <div className="flex items-start gap-3">
        {icon && (
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--raised) text-(--accent)"
          >
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <h3
            className="line-clamp-2 text-[15px] font-semibold leading-snug text-(--text)"
            title={title}
          >
            {title}
          </h3>
          {badges.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {badges.map((badge) => (
                <span
                  key={badge}
                  className="rounded-md bg-(--raised) px-1.5 py-0.5 text-xs text-(--muted)"
                >
                  {badge}
                </span>
              ))}
            </div>
          )}
        </div>
        {menuItems.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={menuLabel}
                title={menuLabel}
                className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-(--muted) transition-colors hover:bg-(--raised) hover:text-(--text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
              >
                <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-40">
              {regular.map((item) => (
                <DropdownMenuItem key={item.label} onClick={item.onSelect} className="text-sm">
                  {item.label}
                </DropdownMenuItem>
              ))}
              {regular.length > 0 && destructive.length > 0 && <DropdownMenuSeparator />}
              {destructive.map((item) => (
                <DropdownMenuItem
                  key={item.label}
                  onClick={item.onSelect}
                  className="text-sm text-(--danger) focus:text-(--danger)"
                >
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {description && <p className="line-clamp-3 text-sm text-(--muted)">{description}</p>}

      <button
        type="button"
        aria-pressed={selected}
        onClick={onPrimary}
        className={cn(
          "mt-auto h-9 rounded-lg px-3 text-sm font-semibold transition-[filter,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)",
          selected === undefined
            ? "border border-(--line) text-(--text) hover:bg-(--raised)"
            : selected
              ? "border border-(--accent) bg-(--soft) text-(--accent)"
              : "bg-(--accent) text-(--on-accent) hover:brightness-110"
        )}
      >
        {primaryLabel}
      </button>
    </article>
  );
}
