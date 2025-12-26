// /app/features/layout/components/HeaderBar.jsx
"use client";

const Bars3Icon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
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
  const themeOptions = [
    { id: "blueprint", label: t?.blueprint ?? "Blueprint", swatch: "#79A9D9" },
    { id: "amber", label: t?.amber ?? "Amber", swatch: "#d97706" },
    { id: "indigo", label: t?.indigo ?? "Indigo", swatch: "#6366f1" },
    { id: "charcoal", label: t?.charcoal ?? "Charcoal", swatch: "#4b5563" },
    { id: "gold", label: t?.gold ?? "Metallic Gold", swatch: "#d4af37" },
    { id: "red", label: t?.red ?? "Red", swatch: "#ef4444" },
    { id: "rose", label: t?.rose ?? "Rose", swatch: "#cc8899" },
  ];

  const languageOptions = [
    { id: "vi", label: t?.vi ?? "Tiếng Việt" },
    { id: "en", label: t?.en ?? "English" },
  ];

  return (
    <header className="
      sticky top-0 z-10
      flex items-center justify-between 
      border-b border-neutral-800 bg-[var(--bg-start)]/95 backdrop-blur-md 
      px-4 py-3 sm:px-6
    ">
      <div className="flex items-center gap-4 min-w-0">
        {/* Mobile sidebar toggle */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="
            md:hidden rounded-lg p-2 -ml-2
            text-neutral-400 hover:text-white hover:bg-neutral-800
            transition-colors active:scale-95
          "
          aria-label="Open sidebar"
        >
          <Bars3Icon />
        </button>

        <div className="min-w-0 flex flex-col">
          <div className="font-bold text-lg text-[var(--primary)] tracking-tight truncate">
            {t?.appName ?? "Vikini AI"}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Language dropdown */}
        <select
          value={language}
          onChange={(e) => onLanguageChange?.(e.target.value)}
          className="
            rounded-lg border border-neutral-700 
            bg-neutral-900 px-2 py-1.5 
            text-sm text-neutral-300 font-medium
            outline-none focus:border-[var(--primary)]
            hover:border-neutral-600 transition-colors
            cursor-pointer
          "
        >
          {languageOptions.map((lang) => (
            <option key={lang.id} value={lang.id}>
              {lang.id === 'vi' ? '🇻🇳 VI' : '🇺🇸 EN'}
            </option>
          ))}
        </select>

        {/* Theme dropdown */}
        <div className="flex items-center gap-2 pl-2 border-l border-neutral-800">
          <span
            className="h-4 w-4 rounded-full shadow-sm ring-1 ring-white/10"
            style={{
              backgroundColor: themeOptions.find((x) => x.id === theme)?.swatch ?? "#d97706",
            }}
            aria-hidden="true"
          />
          <select
            value={theme}
            onChange={(e) => onThemeChange?.(e.target.value)}
            className="
              rounded-lg border border-neutral-700 
              bg-neutral-900 px-2 py-1.5 
              text-sm text-neutral-300
              outline-none focus:border-[var(--primary)]
              hover:border-neutral-600 transition-colors
              cursor-pointer
            "
          >
            {themeOptions.map((th) => (
              <option key={th.id} value={th.id}>
                {th.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
}
