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
      sticky top-0 z-20
      flex items-center justify-between 
      bg-transparent
      px-4 py-4 sm:px-6
      transition-all duration-300
    ">
      <div className="flex items-center gap-4 min-w-0">
        {/* Mobile sidebar toggle */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="
            md:hidden rounded-lg p-2 -ml-2
            text-white/60 hover:text-white hover:bg-white/10
            transition-colors active:scale-95
          "
          aria-label="Open sidebar"
        >
          <Bars3Icon />
        </button>

        <div className="min-w-0 flex flex-col md:hidden">
          <div className="font-black text-base text-white tracking-tight truncate">
            {t?.appName ?? "Vikini"}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 ml-auto">
        {/* Language dropdown - Minimalist Glass */}
        <div className="relative group">
          <select
            value={language}
            onChange={(e) => onLanguageChange?.(e.target.value)}
            className="
              appearance-none
              rounded-full border border-white/5 
              bg-white/5 px-4 py-1.5 
              text-[10px] font-bold uppercase tracking-wider text-white/60
              outline-none focus:border-white/20
              hover:bg-white/10 hover:text-white transition-all
              cursor-pointer
              backdrop-blur-md
            "
          >
            {languageOptions.map((lang) => (
              <option key={lang.id} value={lang.id} className="bg-[#0f172a] text-white">
                {lang.id === 'vi' ? 'VN' : 'EN'}
              </option>
            ))}
          </select>
        </div>

        {/* Theme dropdown - Minimalist Glass */}
        <div className="flex items-center gap-2">
          <div className="relative">
             <span
               className="absolute left-2.5 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full shadow-[0_0_10px_currentColor] pointer-events-none"
               style={{
                 backgroundColor: themeOptions.find((x) => x.id === theme)?.swatch ?? "#d97706",
                 color: themeOptions.find((x) => x.id === theme)?.swatch ?? "#d97706"
               }}
               aria-hidden="true"
             />
             <select
               value={theme}
               onChange={(e) => onThemeChange?.(e.target.value)}
               className="
                 appearance-none
                 rounded-full border border-white/5 
                 bg-white/5 pl-7 pr-4 py-1.5 
                 text-[10px] font-bold uppercase tracking-wider text-white/60
                 outline-none focus:border-white/20
                 hover:bg-white/10 hover:text-white transition-all
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
