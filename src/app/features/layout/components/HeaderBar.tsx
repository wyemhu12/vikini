"use client";

import { motion } from "framer-motion";

import React, { useMemo } from "react";
import Link from "next/link";
import { useLanguage } from "../../chat/hooks/useLanguage";
import { useTheme } from "../../chat/hooks/useTheme";
import { THEME_FAMILIES } from "@/lib/config/theme-config";
import ThemeMenuItems from "./ThemeMenuItems";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import { ChevronDown, Check, Settings, Menu } from "lucide-react";

interface HeaderBarProps {
  onToggleSidebar?: () => void;
  showMobileControls?: boolean;
  hideOnDesktop?: boolean;
}

const HeaderBar: React.FC<HeaderBarProps> = ({
  onToggleSidebar,
  showMobileControls = true,
  hideOnDesktop = false,
}) => {
  const { family, mode } = useTheme();
  const { t, language, setLanguage } = useLanguage();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []); // Hydration fix

  const currentFamily = useMemo(() => THEME_FAMILIES.find((x) => x.id === family), [family]);

  const languageOptions = useMemo(
    () => [
      { id: "vi", label: t("vi") },
      { id: "en", label: t("en") },
    ],
    [t]
  );

  // Common styles for triggers
  const triggerButtonStyles =
    "flex items-center gap-2 rounded-full bg-(--raised) border border-(--line) hover:border-(--line) p-1 px-4 py-1.5 transition-[border-color,box-shadow] duration-200 shadow-lg group backdrop-blur-md text-(--text) cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)";
  const triggerLabelStyles =
    "text-xs font-bold uppercase tracking-wider text-(--muted) group-hover:text-(--text) transition-colors max-w-[100px] truncate";

  return (
    <motion.header
      initial={false}
      animate={{ y: showMobileControls ? 0 : "-100%" }}
      transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
      className={`
      chat-header-bar
      fixed top-0 left-0 right-0 z-20 
      md:sticky md:top-0 md:translate-y-0
      ${hideOnDesktop ? "flex md:hidden" : "flex"} items-center justify-between 
      bg-(--bg)/85 backdrop-blur-md border-b border-(--line) text-(--text)
      pt-[calc(1rem+var(--sat,0px))] pb-4 pl-[calc(1rem+var(--sal,0px))] pr-[calc(1rem+var(--sar,0px))] sm:pl-[calc(1.5rem+var(--sal,0px))] sm:pr-[calc(1.5rem+var(--sar,0px))] md:px-6
      transition-colors duration-300
    `}
    >
      <div className="flex items-center gap-2 min-w-0">
        {/* Mobile navigation toggle: fixed 44px target that opens the sidebar drawer */}
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="md:hidden -ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-(--text) hover:bg-(--raised) transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
            aria-label={t("openMenu")}
          >
            <Menu className="w-6 h-6" />
          </button>
        )}

        {/* App Title with Logo */}
        <div className="min-w-0 flex flex-col">
          <Link
            href="/"
            className="font-sans text-xl font-bold tracking-wide flex items-center gap-2 select-none text-(--text) hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-linear-to-br from-(--accent) to-[color-mix(in_srgb,var(--accent)_80%,black)] shadow-[0_0_15px_var(--glow)] text-(--surface) font-black text-lg">
              V
            </div>
            <span className="bg-clip-text text-transparent bg-linear-to-r from-(--text) via-(--text) to-[color-mix(in_srgb,var(--text)_70%,transparent)]">
              {t("appName")}
            </span>
          </Link>
        </div>
      </div>

      <div className="hidden md:flex items-center gap-3 ml-auto">
        {/* DESKTOP: Separate Controls */}
        {/* Language Dropdown */}
        {mounted ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={triggerButtonStyles} aria-label={t("selectLanguage")}>
                <span className={triggerLabelStyles}>{language === "vi" ? "VN" : "EN"}</span>
                <ChevronDown className="w-3 h-3 text-(--muted) transition-transform group-data-[state=open]:rotate-180" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              {languageOptions.map((lang) => (
                <DropdownMenuItem
                  key={lang.id}
                  onClick={() => setLanguage(lang.id as "vi" | "en")}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {lang.id === "vi" ? "VN" : "EN"}
                  </span>
                  {language === lang.id && <Check className="w-3 h-3 text-(--accent)" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <button className={triggerButtonStyles} aria-label={t("selectLanguage")}>
            <span className={triggerLabelStyles}>{language === "vi" ? "VN" : "EN"}</span>
            <ChevronDown className="w-3 h-3 text-(--muted)" />
          </button>
        )}

        {/* Theme Dropdown */}
        {mounted ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={triggerButtonStyles} aria-label={t("selectTheme")}>
                <div
                  className="h-4 w-4 rounded-full shadow-[0_0_8px_currentColor]"
                  style={{
                    backgroundColor: currentFamily?.swatch[mode] ?? "var(--accent)",
                    color: currentFamily?.swatch[mode] ?? "var(--accent)",
                  }}
                />
                <span className={triggerLabelStyles}>
                  {currentFamily ? t(currentFamily.labelKey) : t("theme")}
                </span>
                <ChevronDown className="w-3 h-3 text-(--muted) transition-transform group-data-[state=open]:rotate-180" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 max-h-[400px] overflow-y-auto custom-scrollbar"
            >
              <ThemeMenuItems />
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <button className={triggerButtonStyles} aria-label={t("selectTheme")}>
            <div
              className="h-4 w-4 rounded-full shadow-[0_0_8px_currentColor]"
              style={{
                backgroundColor: "var(--accent)",
                color: "var(--accent)",
              }}
            />
            <span className={triggerLabelStyles}>{t("theme")}</span>
            <ChevronDown className="w-3 h-3 text-(--muted)" />
          </button>
        )}
      </div>

      {/* MOBILE: Consolidated Menu */}
      <div className="flex md:hidden">
        {mounted ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={`${triggerButtonStyles} px-2`} aria-label={t("settings")}>
                <Settings className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 overflow-y-auto max-h-[80vh]">
              {/* Language Section */}
              <DropdownMenuLabel className="text-xs font-bold uppercase tracking-widest text-(--muted) px-2 py-1.5">
                {t("language")}
              </DropdownMenuLabel>
              {languageOptions.map((lang) => (
                <DropdownMenuItem
                  key={`mobile-${lang.id}`}
                  onClick={() => setLanguage(lang.id as "vi" | "en")}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <span className="text-xs font-medium">
                    {lang.label} ({lang.id === "vi" ? "VN" : "EN"})
                  </span>
                  {language === lang.id && <Check className="w-3 h-3 text-(--accent)" />}
                </DropdownMenuItem>
              ))}

              <DropdownMenuSeparator />

              {/* Theme Section */}
              <ThemeMenuItems />
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <button className={`${triggerButtonStyles} px-2`} aria-label={t("settings")}>
            <Settings className="w-4 h-4" />
          </button>
        )}
      </div>
    </motion.header>
  );
};

export default React.memo(HeaderBar);
