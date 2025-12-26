"use client";

import { signIn } from "next-auth/react";
import { useLanguage } from "../../features/chat/hooks/useLanguage";
import { useTheme } from "../../features/chat/hooks/useTheme";

export default function SignInPage() {
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();

  const themeOptions = [
    { id: "blueprint", swatch: "#79A9D9" },
    { id: "amber", swatch: "#d97706" },
    { id: "indigo", swatch: "#6366f1" },
    { id: "charcoal", swatch: "#4b5563" },
    { id: "gold", swatch: "#d4af37" },
    { id: "red", swatch: "#ef4444" },
    { id: "rose", swatch: "#cc8899" },
  ];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 p-6 text-white transition-colors duration-500 chat-gradient">
      
      {/* Top Controls (Language & Theme) */}
      <div className="fixed top-6 right-6 flex items-center gap-4">
        {/* Language Toggle */}
        <div className="flex rounded-lg border border-neutral-800 bg-neutral-900/50 p-1 backdrop-blur-md">
          <button
            onClick={() => setLanguage("vi")}
            className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${language === "vi" ? "bg-[var(--primary)] text-black" : "text-neutral-500 hover:text-white"}`}
          >
            VI
          </button>
          <button
            onClick={() => setLanguage("en")}
            className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${language === "en" ? "bg-[var(--primary)] text-black" : "text-neutral-500 hover:text-white"}`}
          >
            EN
          </button>
        </div>

        {/* Theme Dots */}
        <div className="flex gap-2 rounded-lg border border-neutral-800 bg-neutral-900/50 p-2 backdrop-blur-md">
          {themeOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setTheme(opt.id)}
              style={{ backgroundColor: opt.swatch }}
              className={`h-4 w-4 rounded-full transition-transform hover:scale-125 ${theme === opt.id ? "ring-2 ring-white ring-offset-2 ring-offset-neutral-950 scale-110" : ""}`}
              title={t(opt.id)}
            />
          ))}
        </div>
      </div>

      <div className="w-full max-w-sm space-y-12 text-center">
        {/* Brand Area */}
        <div className="space-y-4">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-[var(--primary)] p-0.5 shadow-2xl shadow-[var(--primary)]/20 rotate-3">
             <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-neutral-950 text-2xl font-black text-[var(--primary)] -rotate-3">
               V
             </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
              {t("appName") || "Vikini"}
            </h1>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-[var(--primary)] opacity-80">
              {t("whitelistOnly")}
            </p>
          </div>
        </div>

        {/* Action Card */}
        <div className="group relative rounded-[2rem] border border-neutral-800 bg-neutral-900/40 p-1 transition-all hover:border-[var(--primary)]/30">
          <div className="rounded-[1.9rem] bg-neutral-950 p-8 shadow-inner">
            <p className="mb-8 text-sm leading-relaxed text-neutral-400">
              {language === "vi" 
                ? "Chào mừng bạn quay trở lại. Vui lòng xác thực tài khoản Google của bạn để truy cập hệ thống." 
                : "Welcome back. Please authenticate with your Google account to access the system."}
            </p>

            <button
              onClick={() => signIn("google", { callbackUrl: "/" })}
              className="group relative flex w-full items-center justify-center gap-4 overflow-hidden rounded-2xl bg-white px-6 py-4 text-sm font-bold text-black transition-all hover:pr-8 active:scale-95"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {language === "vi" ? "ĐĂNG NHẬP VỚI GOOGLE" : "SIGN IN WITH GOOGLE"}
              <span className="absolute right-4 translate-x-4 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100">→</span>
            </button>
          </div>
        </div>

        {/* Footer Disclaimer */}
        <div className="pt-8 text-[10px] font-medium text-neutral-600">
           © 2025 {t("appName")} • {t("whitelist")}
        </div>
      </div>
    </div>
  );
}
