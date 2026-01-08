"use client";

import { motion } from "framer-motion";

import React, { useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useTheme } from "next-themes";
import { THEME_CONFIG } from "@/lib/config/theme-config";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";

// Lazy load icons
const ChevronDown = dynamic(() => import("lucide-react").then((mod) => mod.ChevronDown), {
  ssr: false,
});
const Check = dynamic(() => import("lucide-react").then((mod) => mod.Check), { ssr: false });
const Settings = dynamic(() => import("lucide-react").then((mod) => mod.Settings), {
  ssr: false,
});

const Bars3Icon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="w-6 h-6"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
    />
  </svg>
);

interface HeaderBarProps {
  t: Record<string, string | any>; // Using flexible record for translations
  language: string;
  onLanguageChange?: (lang: string) => void;
  onToggleSidebar?: () => void;
  showMobileControls?: boolean;
}

const HeaderBar: React.FC<HeaderBarProps> = ({
  t,
  language,
  onLanguageChange,
  onToggleSidebar,
  showMobileControls = true,
}) => {
  const { theme, setTheme } = useTheme();

  // Group themes by category
  const groupedThemes = useMemo(() => {
    return THEME_CONFIG.reduce(
      (acc, theme) => {
        if (!acc[theme.group]) acc[theme.group] = [];
        acc[theme.group].push(theme);
        return acc;
      },
      {} as Record<string, typeof THEME_CONFIG>
    );
  }, []);

  const currentTheme = useMemo(() => THEME_CONFIG.find((x) => x.id === theme), [theme]);

  const languageOptions = useMemo(
    () => [
      { id: "vi", label: t?.vi ?? "Tiếng Việt" },
      { id: "en", label: t?.en ?? "English" },
    ],
    [t]
  );

  // Common styles for triggers
  const triggerButtonStyles =
    "flex items-center gap-2 rounded-full bg-[var(--control-bg)] border border-[var(--control-border)] hover:border-[var(--border)] p-1 px-4 py-1.5 transition-all shadow-lg group backdrop-blur-md text-[var(--text-primary)] cursor-pointer outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-opacity-50";
  const triggerLabelStyles =
    "text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors max-w-[100px] truncate";

  return (
    <motion.header
      initial={false}
      animate={{ y: showMobileControls ? 0 : "-100%" }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="
      fixed top-0 left-0 right-0 z-20 
      md:sticky md:top-0 md:translate-y-0
      flex items-center justify-between 
      bg-transparent text-[var(--text-primary)]
      px-4 py-4 sm:px-6
      transition-colors duration-300
    "
    >
      <div className="flex items-center gap-4 min-w-0">
        {/* Mobile sidebar toggle - HIDDEN in favor of Floating Bubble */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="
            hidden rounded-lg p-2 -ml-2
            text-[var(--text-secondary)] hover:bg-[var(--control-bg-hover)]
            transition-colors active:scale-95
          "
          aria-label={t?.openSidebar || "Open sidebar"}
        >
          <Bars3Icon />
        </button>

        {/* Chữ Vikini Chat được redesign */}
        <div className="min-w-0 flex flex-col">
          <Link
            href="/"
            className="font-sans text-xl font-bold tracking-wide flex items-center gap-2 select-none text-[var(--text-primary)] hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[color-mix(in_srgb,var(--accent)_80%,black)] shadow-[0_0_15px_var(--glow)] text-[var(--surface)] font-black text-lg">
              V
            </div>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[var(--text-primary)] via-[var(--text-primary)] to-[color-mix(in_srgb,var(--text-primary)_70%,transparent)]">
              Vikini Chat
            </span>
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-3 ml-auto">
        {/* DESKTOP: Separate Controls */}
        <div className="hidden md:flex items-center gap-3">
          {/* Language Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={triggerButtonStyles}
                aria-label={t?.selectLanguage || "Select Language"}
              >
                <span className={triggerLabelStyles}>{language === "vi" ? "VN" : "EN"}</span>
                <ChevronDown className="w-3 h-3 text-[var(--text-secondary)] transition-transform group-data-[state=open]:rotate-180" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              {languageOptions.map((lang) => (
                <DropdownMenuItem
                  key={lang.id}
                  onClick={() => onLanguageChange?.(lang.id)}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    {lang.id === "vi" ? "VN" : "EN"}
                  </span>
                  {language === lang.id && <Check className="w-3 h-3 text-[var(--accent)]" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Theme Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={triggerButtonStyles} aria-label={t?.selectTheme || "Select Theme"}>
                <div
                  className="h-4 w-4 rounded-full shadow-[0_0_8px_currentColor]"
                  style={{
                    backgroundColor: currentTheme?.swatch ?? "#d97706",
                    color: currentTheme?.swatch ?? "#d97706",
                  }}
                />
                <span className={triggerLabelStyles}>
                  {t?.[currentTheme?.labelKey || ""] || currentTheme?.id || "Theme"}
                </span>
                <ChevronDown className="w-3 h-3 text-[var(--text-secondary)] transition-transform group-data-[state=open]:rotate-180" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 max-h-[400px] overflow-y-auto custom-scrollbar"
            >
              {Object.entries(groupedThemes).map(([group, themes]) => (
                <DropdownMenuGroup key={group}>
                  <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] px-2 py-1.5">
                    {group}
                  </DropdownMenuLabel>
                  {themes.map((tItem) => (
                    <DropdownMenuItem
                      key={tItem.id}
                      onClick={() => setTheme(tItem.id)}
                      className="flex items-center gap-3 cursor-pointer"
                    >
                      <div
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tItem.swatch }}
                      />
                      <span className="flex-1 text-[11px] font-medium truncate">
                        {t?.[tItem.labelKey] ?? tItem.id}
                      </span>
                      {theme === tItem.id && <Check className="w-3 h-3 text-blue-400" />}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </DropdownMenuGroup>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* MOBILE: Consolidated Menu */}
        <div className="flex md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={`${triggerButtonStyles} px-2`}
                aria-label={t?.settings || "Settings"}
              >
                <Settings className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 overflow-y-auto max-h-[80vh]">
              {/* Language Section */}
              <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] px-2 py-1.5">
                {t?.language || "Language"}
              </DropdownMenuLabel>
              {languageOptions.map((lang) => (
                <DropdownMenuItem
                  key={`mobile-${lang.id}`}
                  onClick={() => onLanguageChange?.(lang.id)}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <span className="text-[11px] font-medium">
                    {lang.label} ({lang.id === "vi" ? "VN" : "EN"})
                  </span>
                  {language === lang.id && <Check className="w-3 h-3 text-[var(--accent)]" />}
                </DropdownMenuItem>
              ))}

              <DropdownMenuSeparator />

              {/* Theme Section */}
              <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] px-2 py-1.5">
                {t?.theme || "Theme"}
              </DropdownMenuLabel>
              {Object.entries(groupedThemes).map(([group, themes]) => (
                <DropdownMenuGroup key={`mobile-${group}`}>
                  <DropdownMenuLabel className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-secondary)]/70 px-2 py-1">
                    {group}
                  </DropdownMenuLabel>
                  {themes.map((tItem) => (
                    <DropdownMenuItem
                      key={`mobile-${tItem.id}`}
                      onClick={() => setTheme(tItem.id)}
                      className="flex items-center gap-3 cursor-pointer"
                    >
                      <div
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tItem.swatch }}
                      />
                      <span className="flex-1 text-[11px] font-medium truncate">
                        {t?.[tItem.labelKey] ?? tItem.id}
                      </span>
                      {theme === tItem.id && <Check className="w-3 h-3 text-blue-400" />}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator className="last:hidden" />
                </DropdownMenuGroup>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </motion.header>
  );
};

export default React.memo(HeaderBar);
