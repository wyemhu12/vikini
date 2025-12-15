"use client";

export default function HeaderBar({
  t,
  language,
  onLanguageChange,
  systemMode,
  onSystemModeChange,
  theme,
  onThemeChange,
  onToggleSidebar,
}) {
  return (
    <header className="flex items-center justify-between border-b border-neutral-800 bg-[var(--bg-start)] px-4 py-3 text-sm">
      <div className="flex items-center gap-3 min-w-0">
        {/* ✅ Mobile sidebar toggle */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="md:hidden rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-800"
          aria-label="Open sidebar"
        >
          ☰
        </button>

        <div className="min-w-0">
          <div className="font-semibold text-[var(--primary-light)] truncate">
            {t.appName}
          </div>
          <div className="text-xs text-neutral-400 truncate">{t.whitelist}</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Language */}
        <div className="inline-flex rounded-lg border border-neutral-700 bg-neutral-900 text-xs overflow-hidden">
          {["vi", "en"].map((lng) => (
            <button
              key={lng}
              onClick={() => onLanguageChange(lng)}
              className={`px-3 py-1 ${
                language === lng
                  ? "bg-[var(--primary)] text-black font-semibold"
                  : "text-neutral-300 hover:text-white"
              }`}
            >
              {lng.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Mode */}
        <div className="hidden sm:flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs">
          <span className="text-neutral-400">{t.systemPrompt}:</span>

          <select
            className="bg-neutral-900 text-neutral-100 outline-none px-2 py-1 rounded-md border border-neutral-700 focus:border-[var(--primary)]"
            value={systemMode}
            onChange={(e) => onSystemModeChange(e.target.value)}
          >
            <option className="bg-neutral-900" value="default">
              {t.modeDefault}
            </option>
            <option className="bg-neutral-900" value="dev">
              {t.modeDev}
            </option>
            <option className="bg-neutral-900" value="friendly">
              {t.modeFriendly}
            </option>
            <option className="bg-neutral-900" value="strict">
              {t.modeStrict}
            </option>
          </select>
        </div>

        {/* Theme */}
        <div className="flex gap-2">
          {[
            { id: "amber", color: "#d97706" },
            { id: "indigo", color: "#6366f1" },
            { id: "charcoal", color: "#4b5563" },
          ].map((th) => (
            <button
              key={th.id}
              onClick={() => onThemeChange(th.id)}
              className={`h-4 w-4 rounded-full ${
                theme === th.id ? "ring-2 ring-[var(--primary-light)]" : ""
              }`}
              style={{ backgroundColor: th.color }}
            />
          ))}
        </div>
      </div>
    </header>
  );
}
