"use client";

import React from "react";
import { Moon, Sun } from "lucide-react";
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { THEME_FAMILIES, isThemeFamilyId, isThemeMode } from "@/lib/config/theme-config";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { useTheme } from "../../chat/hooks/useTheme";

const LABEL_CLASS = "text-xs font-bold text-(--muted) px-2 py-1.5";

/** Shared theme picker body: 5 theme families + dark/light mode, as dropdown radio groups. */
export default function ThemeMenuItems() {
  const { t } = useLanguage();
  const { family, mode, setFamily, setMode } = useTheme();

  return (
    <>
      <DropdownMenuLabel className={LABEL_CLASS}>{t("themes")}</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={family}
        onValueChange={(value) => isThemeFamilyId(value) && setFamily(value)}
      >
        {THEME_FAMILIES.map((item) => (
          <DropdownMenuRadioItem
            key={item.id}
            value={item.id}
            className="gap-3 text-xs font-medium cursor-pointer"
          >
            <span
              aria-hidden
              className="h-3 w-3 rounded-full shrink-0 border border-(--line)"
              style={{ backgroundColor: item.swatch[mode] }}
            />
            <span className="flex-1 truncate">{t(item.labelKey)}</span>
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>

      <DropdownMenuSeparator />

      <DropdownMenuLabel className={LABEL_CLASS}>{t("themeMode")}</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={mode}
        onValueChange={(value) => isThemeMode(value) && setMode(value)}
      >
        <DropdownMenuRadioItem value="dark" className="gap-3 text-xs font-medium cursor-pointer">
          <Moon aria-hidden className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">{t("themeModeDark")}</span>
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="light" className="gap-3 text-xs font-medium cursor-pointer">
          <Sun aria-hidden className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">{t("themeModeLight")}</span>
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </>
  );
}
