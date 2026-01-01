// /app/features/layout/components/HeaderBar.jsx
"use client";

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
  const themeOptions = [
    { id: "blueprint", label: t?.blueprint ?? "Blueprint", swatch: "#3b82f6" },
    { id: "amber", label: t?.amber ?? "Amber", swatch: "#d97706" },
    { id: "indigo", label: t?.indigo ?? "Indigo", swatch: "#6366f1" },
    { id: "charcoal", label: t?.charcoal ?? "Charcoal", swatch: "#4b5563" },
    { id: "gold", label: t?.gold ?? "Metallic Gold", swatch: "#d4af37" },
    { id: "red", label: t?.red ?? "Red", swatch: "#ef4444" },
    { id: "rose", label: t?.rose ?? "Rose", swatch: "#cc8899" },
    { id: "yuri", label: t?.yuri ?? "Yuri Purple", swatch: "#a855f7" },
    { id: "allied", label: t?.allied ?? "Allied Blue", swatch: "#38bdf8" },
    { id: "soviet", label: t?.soviet ?? "Soviet Red", swatch: "#ef4444" },
    { id: "amethyst", label: t?.amethyst ?? "Amethyst Glass", swatch: "#8b5cf6" },
    { id: "aurora", label: t?.aurora ?? "Aurora Glass", swatch: "#22d3ee" },
    { id: "aqua", label: t?.aqua ?? "Aqua Glass", swatch: "#2dd4bf" },
    { id: "holo", label: t?.holo ?? "Holo Glass", swatch: "#22d3ee" },
    { id: "sunset", label: t?.sunset ?? "Sunset Glass", swatch: "#f97316" },
  ];

  const languageOptions = [
    { id: "vi", label: t?.vi ?? "Tiếng Việt" },
    { id: "en", label: t?.en ?? "English" },
  ];

  return (
    <header
      className="
      sticky top-0 z-20
      flex items-center justify-between 
      bg-transparent
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
            text-white hover:bg-white/10
            transition-colors active:scale-95
          "
          aria-label="Open sidebar"
        >
          <Bars3Icon />
        </button>

        {/* Chữ Vikini Chat được redesign */}
        <div className="min-w-0 flex flex-col">
          <div className="font-sans text-xl font-bold text-white tracking-wide flex items-center gap-2 select-none">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] shadow-[0_0_15px_var(--primary)] text-black font-black text-lg">
              V
            </div>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/70">
              Vikini Chat
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 ml-auto">
        {/* Language dropdown */}
        <div className="relative group">
          <select
            value={language}
            onChange={(e) => onLanguageChange?.(e.target.value)}
            className="
              appearance-none
              rounded-full border border-white/10
              bg-white/5 px-4 py-1.5 
              text-[10px] font-bold uppercase tracking-wider text-white
              outline-none focus:border-white/30
              hover:bg-white/10 transition-all
              cursor-pointer
              backdrop-blur-md
            "
          >
            {languageOptions.map((lang) => (
              <option key={lang.id} value={lang.id} className="bg-[#0f172a] text-white">
                {lang.id === "vi" ? "VN" : "EN"}
              </option>
            ))}
          </select>
        </div>

        {/* Theme dropdown */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <span
              className="absolute left-2.5 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full shadow-[0_0_8px_currentColor] pointer-events-none"
              style={{
                backgroundColor: themeOptions.find((x) => x.id === theme)?.swatch ?? "#d97706",
                color: themeOptions.find((x) => x.id === theme)?.swatch ?? "#d97706",
              }}
              aria-hidden="true"
            />
            <select
              value={theme}
              onChange={(e) => onThemeChange?.(e.target.value)}
              className="
                 appearance-none
                 rounded-full border border-white/10
                 bg-white/5 pl-7 pr-4 py-1.5 
                 text-[10px] font-bold uppercase tracking-wider text-white
                 outline-none focus:border-white/30
                 hover:bg-white/10 transition-all
                 cursor-pointer
                 backdrop-blur-md
               "
            >
              {themeOptions.map((th) => (
                <option key={th.id} value={th.id} className="bg-[#0f172a] text-white">
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
