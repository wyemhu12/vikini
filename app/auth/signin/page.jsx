"use client";

import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { useLanguage } from "../../features/chat/hooks/useLanguage";

const THEME_COLORS = [
  { primary: "#79A9D9", bg: "#0f172a" }, // Blueprint
  { primary: "#d97706", bg: "#2b1800" }, // Amber
  { primary: "#6366f1", bg: "#0c0f33" }, // Indigo
  { primary: "#ef4444", bg: "#2a0000" }, // Red
  { primary: "#cc8899", bg: "#240c12" }, // Rose
  { primary: "#4b5563", bg: "#0f0f0f" }, // Charcoal
];

export default function SignInPage() {
  const { t, language, setLanguage } = useLanguage();
  const [colorIndex, setColorIndex] = useState(0);

  // Tự động chuyển màu mỗi 4 giây
  useEffect(() => {
    const interval = setInterval(() => {
      setColorIndex((prev) => (prev + 1) % THEME_COLORS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const currentColor = THEME_COLORS[colorIndex];

  return (
    <div 
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-6 text-white transition-colors duration-[2000ms] ease-in-out"
      style={{ 
        backgroundColor: currentColor.bg,
        "--primary": currentColor.primary 
      }}
    >
      {/* 🌊 Dynamic Mesh Gradient Layers */}
      <div className="absolute inset-0 z-0 opacity-40">
        <div 
          className="absolute -top-[20%] -left-[10%] h-[70%] w-[70%] rounded-full blur-[120px] transition-colors duration-[3000ms]"
          style={{ backgroundColor: currentColor.primary }}
        />
        <div 
          className="absolute -bottom-[20%] -right-[10%] h-[60%] w-[60%] rounded-full blur-[100px] transition-colors duration-[4000ms]"
          style={{ backgroundColor: currentColor.primary }}
        />
      </div>

      {/* 🌊 SVG Waves */}
      <div className="absolute bottom-0 left-0 w-full leading-[0] z-0 opacity-20">
        <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="relative block h-[150px] w-full fill-white">
          <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V120H0V95.8C58.23,113.13,145.51,123.99,222,112.1,280,103.11,321.39,78.29,321.39,56.44Z" className="animate-[wave_10s_infinite_linear]"></path>
        </svg>
      </div>

      {/* Top Controls (Language only) */}
      <div className="fixed top-6 right-6 z-20 flex items-center gap-4">
        <div className="flex rounded-full border border-white/10 bg-black/20 p-1 backdrop-blur-xl">
          <button
            onClick={() => setLanguage("vi")}
            className={`px-4 py-1.5 text-[10px] font-black rounded-full transition-all ${language === "vi" ? "bg-white text-black" : "text-white/40 hover:text-white"}`}
          >
            VI
          </button>
          <button
            onClick={() => setLanguage("en")}
            className={`px-4 py-1.5 text-[10px] font-black rounded-full transition-all ${language === "en" ? "bg-white text-black" : "text-white/40 hover:text-white"}`}
          >
            EN
          </button>
        </div>
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-12 text-center">
        {/* Brand Area */}
        <div className="space-y-4">
          <div 
            className="mx-auto h-20 w-20 rounded-[2.5rem] p-0.5 shadow-2xl transition-all duration-1000 rotate-12 flex items-center justify-center bg-white/10 backdrop-blur-sm border border-white/20"
          >
             <div 
                className="flex h-16 w-16 items-center justify-center rounded-[2rem] bg-white text-3xl font-black transition-colors duration-1000 -rotate-12"
                style={{ color: currentColor.bg }}
             >
               V
             </div>
          </div>
          <div className="space-y-3">
            <h1 className="text-5xl font-black tracking-tighter text-white">
              {t("appName") || "Vikini"}
            </h1>
            <div className="inline-block px-4 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-md">
                <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/60">
                {t("whitelistOnly")}
                </p>
            </div>
          </div>
        </div>

        {/* Action Card */}
        <div className="relative rounded-[3rem] border border-white/10 bg-white/5 p-2 backdrop-blur-2xl shadow-2xl">
          <div className="rounded-[2.8rem] bg-black/40 p-10 backdrop-blur-md border border-white/5">
            <p className="mb-10 text-sm font-medium leading-relaxed text-white/50">
              {language === "vi" 
                ? "Bắt đầu hành trình khám phá trí tuệ nhân tạo thế hệ mới cùng Vikini." 
                : "Start your journey of exploring next-gen AI with Vikini."}
            </p>

            <button
              onClick={() => signIn("google", { callbackUrl: "/" })}
              className="group relative flex w-full items-center justify-center gap-4 overflow-hidden rounded-full bg-white px-8 py-5 text-sm font-black text-black transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-white/10"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {language === "vi" ? "ĐĂNG NHẬP" : "LOG IN NOW"}
            </button>
          </div>
        </div>

        <div className="pt-8 text-[10px] font-bold text-white/20 tracking-widest uppercase">
           {t("whitelist")} • SECURE ACCESS
        </div>
      </div>

      <style jsx>{`
        @keyframes wave {
          0% { transform: translateX(0); }
          50% { transform: translateX(-25%); }
          100% { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
