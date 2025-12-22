"use client";

export default function HeaderBar({
  t,
  language,
  onLanguageChange,
  theme,
  onThemeChange,
  onToggleSidebar,
}) {
  // Theme options với translations từ t
  const themeOptions = [
    { id: "amber", label: t?.amber ?? "Amber", swatch: "#d97706" },
    { id: "indigo", label: t?.indigo ?? "Indigo", swatch: "#6366f1" },
    { id: "charcoal", label: t?.charcoal ?? "Charcoal", swatch: "#4b5563" },
    { id: "gold", label: t?.gold ?? "Metallic Gold", swatch: "#d4af37" },
    { id: "red", label: t?.red ?? "Red", swatch: "#ef4444" },
    { id: "rose", label: t?.rose ?? "Rose", swatch: "#cc8899" },
  ];

  // Language options với translations từ t
  const languageOptions = [
    { id: "vi", label: t?.vi ?? "Tiếng Việt" },
    { id: "en", label: t?.en ?? "English" },
  ];

  return (
    <header className="flex items-center justify-between border-b border-neutral-800 bg-[var(--bg-start)] px-5 py-4 text-base">
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile sidebar toggle */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="md:hidden rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-sm text-neutral-200 hover:bg-neutral-800"
          aria-label="Open sidebar"
        >
          ☰
        </button>

        <div className="min-w-0">
          <div className="font-semibold text-[var(--primary-light)] truncate">
            {t?.appName ?? "Vikini"}
          </div>
          <div className="text-sm text-neutral-400 truncate">{t?.whitelist ?? ""}</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Language dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-400 hidden sm:inline">
            {t?.language ?? "Ngôn ngữ"}
          </span>
          <select
            value={language}
            onChange={(e) => onLanguageChange?.(e.target.value)}
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-100 outline-none focus:border-[var(--primary-light)]"
          >
            {languageOptions.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.id.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        {/* Theme dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-400 hidden sm:inline">
            {t?.themes ?? "Giao diện"}
          </span>

          <div className="flex items-center gap-2">
            <span
              className="h-5 w-5 rounded-full ring-1 ring-neutral-700"
              style={{
                backgroundColor:
                  themeOptions.find((x) => x.id === theme)?.swatch ?? "#d97706",
              }}
              aria-hidden="true"
            />
            <select
              value={theme}
              onChange={(e) => onThemeChange?.(e.target.value)}
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-100 outline-none focus:border-[var(--primary-light)]"
            >
              {themeOptions.map((th) => (
                <option key={th.id} value={th.id}>
                  {th.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </header>
  );
}
