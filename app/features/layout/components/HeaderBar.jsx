// /app/features/layout/components/HeaderBar.jsx
"use client";

import { useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { THEME_TONES } from "../../chat/hooks/useTheme";

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

export default function HeaderBar({
  t,
  language,
  onLanguageChange,
  theme,
  onThemeChange,
  onToggleSidebar,
}) {
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isThemeOpen, setIsThemeOpen] = useState(false);

  const themeOptions = [
    // --- GLASSMORPHISM ---
    { id: "nebula", label: t?.nebula ?? "Nebula Glass", swatch: "#22d3ee", group: "Glassmorphism" },
    { id: "orchid", label: t?.orchid ?? "Orchid Silk", swatch: "#c084fc", group: "Glassmorphism" },
    { id: "aqua", label: t?.aqua ?? "Aqua Glass", swatch: "#14b8a6", group: "Glassmorphism" },
    { id: "holo", label: t?.holo ?? "Holo Glass", swatch: "#22d3ee", group: "Glassmorphism" },
    { id: "sunset", label: t?.sunset ?? "Sunset Glass", swatch: "#f97316", group: "Glassmorphism" },
    // --- FOCUS ---
    { id: "blueprint", label: t?.blueprint ?? "Blueprint", swatch: "#3b82f6", group: "Focus" },
    { id: "amber", label: t?.amber ?? "Amber", swatch: "#d97706", group: "Focus" },
    { id: "indigo", label: t?.indigo ?? "Indigo", swatch: "#6366f1", group: "Focus" },
    { id: "charcoal", label: t?.charcoal ?? "Charcoal", swatch: "#4b5563", group: "Focus" },
    { id: "gold", label: t?.gold ?? "Metallic Gold", swatch: "#d4af37", group: "Focus" },
    { id: "red", label: t?.red ?? "Red", swatch: "#ef4444", group: "Focus" },
    { id: "rose", label: t?.rose ?? "Rose", swatch: "#cc8899", group: "Focus" },
    // --- RED ALERT 2 ---
    { id: "yuri", label: t?.yuri ?? "Yuri Purple", swatch: "#a855f7", group: "Red Alert 2" },
    { id: "allied", label: t?.allied ?? "Allied Blue", swatch: "#38bdf8", group: "Red Alert 2" },
    { id: "soviet", label: t?.soviet ?? "Soviet Red", swatch: "#ef4444", group: "Red Alert 2" },
  ].map((option) => ({
    ...option,
    tone: THEME_TONES[option.id] ?? "dark",
  }));

  const languageOptions = [
    { id: "vi", label: t?.vi ?? "Tiếng Việt" },
    { id: "en", label: t?.en ?? "English" },
  ];

  const currentTheme = themeOptions.find((x) => x.id === theme);

  return (
    <header
      className="
      sticky top-0 z-20
      flex items-center justify-between 
      bg-transparent text-[var(--text-primary)]
      px-4 py-4 sm:px-6
      transition-all duration-300
    "
    >
      <div className="flex items-center gap-4 min-w-0">
        {/* Mobile sidebar toggle */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="
            md:hidden rounded-lg p-2 -ml-2
            text-[var(--text-secondary)] hover:bg-[var(--control-bg-hover)]
            transition-colors active:scale-95
          "
          aria-label="Open sidebar"
        >
          <Bars3Icon />
        </button>

        {/* Chữ Vikini Chat được redesign */}
        <div className="min-w-0 flex flex-col">
          <div className="font-sans text-xl font-bold tracking-wide flex items-center gap-2 select-none text-[var(--text-primary)]">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[color-mix(in_srgb,var(--accent)_80%,black)] shadow-[0_0_15px_var(--glow)] text-black font-black text-lg">
              V
            </div>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[var(--text-primary)] via-[var(--text-primary)] to-[color-mix(in_srgb,var(--text-primary)_70%,transparent)]">
              Vikini Chat
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 ml-auto">
        {/* Language dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsLangOpen(!isLangOpen)}
            className="flex items-center gap-2 rounded-full bg-[var(--control-bg)] border border-[var(--control-border)] hover:border-[var(--border)] p-1 px-4 py-1.5 transition-all shadow-lg group backdrop-blur-md text-[var(--text-primary)]"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
              {language === "vi" ? "VN" : "EN"}
            </span>
            <ChevronDown
              className={`w-3 h-3 text-[var(--text-secondary)] transition-transform ${isLangOpen ? "rotate-180" : ""}`}
            />
          </button>

          {isLangOpen && (
            <>
              <div
                className="fixed inset-0 z-30 bg-transparent"
                onClick={() => setIsLangOpen(false)}
              />
              <div className="absolute top-full right-0 mt-2 w-32 bg-[var(--surface-muted)] border border-[var(--border)] rounded-xl shadow-2xl z-40 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                <div className="p-1 space-y-0.5">
                  {languageOptions.map((lang) => (
                    <button
                      key={lang.id}
                      onClick={() => {
                        onLanguageChange?.(lang.id);
                        setIsLangOpen(false);
                      }}
                      className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg transition-all text-[11px] font-bold uppercase tracking-wider ${
                        language === lang.id
                          ? "bg-[var(--control-bg-hover)] text-[var(--text-primary)]"
                          : "text-[var(--text-secondary)] hover:bg-[var(--control-bg)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      <span>{lang.id === "vi" ? "VN" : "EN"}</span>
                      {language === lang.id && <Check className="w-3 h-3 text-[var(--accent)]" />}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Theme dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsThemeOpen(!isThemeOpen)}
            className="flex items-center gap-2 rounded-full bg-[var(--control-bg)] border border-[var(--control-border)] hover:border-[var(--border)] p-1 pl-2 pr-4 py-1.5 transition-all shadow-lg group backdrop-blur-md text-[var(--text-primary)]"
          >
            <div
              className="h-4 w-4 rounded-full shadow-[0_0_8px_currentColor]"
              style={{
                backgroundColor: currentTheme?.swatch ?? "#d97706",
                color: currentTheme?.swatch ?? "#d97706",
              }}
            />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors max-w-[100px] truncate">
              {currentTheme?.label || "Theme"}
            </span>
            <ChevronDown
              className={`w-3 h-3 text-[var(--text-secondary)] transition-transform ${isThemeOpen ? "rotate-180" : ""}`}
            />
          </button>

          {isThemeOpen && (
            <>
              <div
                className="fixed inset-0 z-30 bg-transparent"
                onClick={() => setIsThemeOpen(false)}
              />
              <div className="absolute top-full right-0 mt-2 w-56 bg-[var(--surface-muted)] border border-[var(--border)] rounded-xl shadow-2xl z-40 overflow-hidden animate-in fade-in zoom-in-95 duration-100 max-h-[400px] overflow-y-auto custom-scrollbar">
                {["Glassmorphism", "Focus", "Red Alert 2"].map((group) => (
                  <div key={group}>
                    <div className="sticky top-0 bg-[var(--surface-muted)] z-10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                      {group}
                    </div>
                    <div className="p-1 space-y-0.5">
                      {themeOptions
                        .filter((t) => t.group === group)
                        .map((tItem) => (
                          <button
                            key={tItem.id}
                            onClick={() => {
                              onThemeChange?.(tItem.id);
                              setIsThemeOpen(false);
                            }}
                            data-theme-tone={tItem.tone}
                            className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg transition-all group/item ${
                              theme === tItem.id
                                ? "bg-[var(--control-bg-hover)] text-[var(--text-primary)]"
                                : "text-[var(--text-secondary)] hover:bg-[var(--control-bg)] hover:text-[var(--text-primary)]"
                            }`}
                          >
                            <div
                              className="h-3 w-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: tItem.swatch }}
                            />
                            <span className="flex-1 text-[11px] font-medium truncate">
                              {tItem.label}
                            </span>
                            {theme === tItem.id && <Check className="w-3 h-3 text-blue-400" />}
                          </button>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
