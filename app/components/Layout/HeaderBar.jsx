"use client";

export default function HeaderBar({
  t,
  language,
  onLanguageChange,
  systemMode,
  onSystemModeChange,
  theme,
  onThemeChange,
}) {
  return (
    <header className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-4 py-3 text-xs">
      <div>
        <div className="font-semibold">{t.appName}</div>
        <div className="text-[11px] text-neutral-400">{t.whitelist}</div>
      </div>

      <div className="flex items-center gap-2">
        {/* Language toggle */}
        <div className="inline-flex rounded-lg border border-neutral-700 bg-neutral-900 text-[11px]">
          <button
            onClick={() => onLanguageChange("vi")}
            className={`px-2 py-1 ${
              language === "vi"
                ? "bg-[var(--primary)] text-black"
                : "text-neutral-300"
            }`}
          >
            VI
          </button>
          <button
            onClick={() => onLanguageChange("en")}
            className={`px-2 py-1 ${
              language === "en"
                ? "bg-[var(--primary)] text-black"
                : "text-neutral-300"
            }`}
          >
            EN
          </button>
        </div>

        {/* System mode */}
        <div className="hidden items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1 text-[11px] sm:flex">
          <span className="text-neutral-400">{t.systemPrompt}:</span>
          <select
            className="bg-transparent text-neutral-100 outline-none"
            value={systemMode}
            onChange={(e) => onSystemModeChange(e.target.value)}
          >
            <option value="default">{t.modeDefault}</option>
            <option value="dev">{t.modeDev}</option>
            <option value="friendly">{t.modeFriendly}</option>
            <option value="strict">{t.modeStrict}</option>
          </select>
        </div>

        {/* Theme dots */}
        <div className="flex gap-2">
          <button
            onClick={() => onThemeChange("amber")}
            className={`h-4 w-4 rounded-full ${
              theme === "amber" ? "ring-2 ring-[var(--primary-light)]" : ""
            }`}
            style={{ backgroundColor: "#d97706" }}
            aria-label="Amber theme"
          />
          <button
            onClick={() => onThemeChange("indigo")}
            className={`h-4 w-4 rounded-full ${
              theme === "indigo" ? "ring-2 ring-[var(--primary-light)]" : ""
            }`}
            style={{ backgroundColor: "#6366f1" }}
            aria-label="Indigo theme"
          />
          <button
            onClick={() => onThemeChange("charcoal")}
            className={`h-4 w-4 rounded-full ${
              theme === "charcoal" ? "ring-2 ring-[var(--primary-light)]" : ""
            }`}
            style={{ backgroundColor: "#4b5563" }}
            aria-label="Charcoal theme"
          />
        </div>
      </div>
    </header>
  );
}
