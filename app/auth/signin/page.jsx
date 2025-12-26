"use client";

import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { useLanguage } from "../../features/chat/hooks/useLanguage";

/**
 * 🌠 Professional Flowing Gradient Login Page
 * Features a smooth, horizontal color flow from right to left.
 * Designed for a premium and modern feel.
 */

export default function SignInPage() {
  const { t, language, setLanguage } = useLanguage();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="min-h-screen bg-[#020617]" />;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#020617] text-white">
      
      {/* 🌌 Smooth Flowing Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[#020617]" />
        <div className="flowing-gradient absolute inset-0 opacity-60" />
        {/* Vignette effect for focus */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_#020617_90%)]" />
      </div>

      {/* Language Toggle */}
      <div className="fixed top-8 right-8 z-20">
        <div className="flex rounded-full border border-white/5 bg-white/5 p-1 backdrop-blur-3xl shadow-2xl">
          <button
            onClick={() => setLanguage("vi")}
            className={`px-4 py-1.5 text-[10px] font-bold rounded-full transition-all duration-300 ${
              language === "vi" ? "bg-white text-black shadow-lg" : "text-white/40 hover:text-white"
            }`}
          >
            VI
          </button>
          <button
            onClick={() => setLanguage("en")}
            className={`px-4 py-1.5 text-[10px] font-bold rounded-full transition-all duration-300 ${
              language === "en" ? "bg-white text-black shadow-lg" : "text-white/40 hover:text-white"
            }`}
          >
            EN
          </button>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="relative z-10 w-full max-w-md px-6 space-y-12 text-center">
        
        {/* Brand Identity */}
        <div className="space-y-6 animate-in fade-in slide-in-from-top-8 duration-1000">
          <div className="mx-auto h-20 w-20 relative">
             <div className="absolute inset-0 bg-blue-500/20 blur-3xl animate-pulse" />
             <div className="relative flex h-full w-full items-center justify-center rounded-[2rem] border border-white/20 bg-white/5 backdrop-blur-xl shadow-2xl transition-transform hover:scale-105 duration-500">
                <span className="text-3xl font-black text-white tracking-tighter">V</span>
             </div>
          </div>
          
          <div className="space-y-3">
            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
              {t("appName") || "Vikini"}
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-[0.5em] text-blue-400/70">
              {t("whitelistOnly") || "White Listed Only"}
            </p>
          </div>
        </div>

        {/* Action Area */}
        <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
          <div className="rounded-[2.5rem] border border-white/10 bg-white/5 p-8 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <p className="mb-8 text-sm font-medium leading-relaxed text-white/40 max-w-[280px] mx-auto">
              {language === "vi" 
                ? "Bước vào kỷ nguyên trí tuệ nhân tạo cá nhân hóa dành riêng cho bạn." 
                : "Step into the era of personalized AI intelligence tailored for you."}
            </p>

            <button
              onClick={() => signIn("google", { callbackUrl: "/" })}
              className="group relative flex w-full items-center justify-center gap-4 overflow-hidden rounded-full bg-white px-8 py-4 text-sm font-bold text-black transition-all hover:bg-[#F0F4F7] hover:scale-[1.02] active:scale-[0.98] shadow-2xl"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {language === "vi" ? "ĐĂNG NHẬP VỚI GOOGLE" : "SIGN IN WITH GOOGLE"}
            </button>
          </div>
        </div>

        {/* Footer Info */}
        <div className="pt-12 animate-in fade-in duration-1000 delay-500">
           <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/5 bg-white/5 text-[9px] font-bold text-white/30 tracking-[0.2em] uppercase">
              {t("whitelist") || "Whitelist"} • ENCRYPTED ACCESS
           </div>
        </div>
      </div>

      <style jsx>{`
        .flowing-gradient {
          background: linear-gradient(
            to left,
            #020617,
            #0f172a,
            #1e1b4b,
            #312e81,
            #1e1b4b,
            #0f172a,
            #020617
          );
          background-size: 200% 100%;
          animation: flow 15s linear infinite;
        }

        @keyframes flow {
          0% {
            background-position: 200% 0%;
          }
          100% {
            background-position: 0% 0%;
          }
        }
      `}</style>
    </div>
  );
}
