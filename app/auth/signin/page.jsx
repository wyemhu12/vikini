"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "../../features/chat/hooks/useLanguage";
import { handleGoogleSignIn } from "./actions";

/**
 * 🌠 Advanced Flowing Gradient Login Page
 * Features a seamless right-to-left color flow through a hollow logo.
 */

export default function SignInPage() {
  const { language, setLanguage } = useLanguage();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="min-h-screen bg-[#020617]" />;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#020617] text-white">
      {/* 🌌 Multi-tone Flowing Background */}
      <div className="absolute inset-0 z-0">
        <div className="flowing-gradient absolute inset-0 opacity-50" />
        {/* Vignette effect for focus */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_#020617_85%)]" />
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
        <div className="space-y-8 animate-in fade-in slide-in-from-top-8 duration-1000">
          {/* Large Hollow Logo V */}
          <div className="mx-auto h-32 w-32 relative flex items-center justify-center">
            {/* Glow behind logo */}
            <div className="absolute inset-0 bg-white/5 blur-3xl rounded-full" />

            {/* The "V" with background clip for transparency effect */}
            <div className="relative flex h-full w-full items-center justify-center rounded-[2.5rem] border border-white/10 bg-black/20 backdrop-blur-sm overflow-hidden shadow-2xl">
              <span className="text-7xl font-black text-transparent bg-clip-text flowing-gradient-text select-none">
                V
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-5xl font-black tracking-tight text-white sm:text-6xl bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50 font-sans">
              Vikini Chat
            </h1>
            <p className="text-[11px] font-bold uppercase tracking-[0.6em] text-white/40">
              {language === "vi" ? "TRUY CẬP ĐƯỢC CẤP PHÉP" : "AUTHORIZED ACCESS ONLY"}
            </p>
          </div>
        </div>

        {/* Action Area */}
        <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
          <div className="rounded-[3rem] border border-white/5 bg-white/[0.02] p-10 backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <p className="mb-10 text-base font-medium tracking-tight text-white/60 max-w-[300px] mx-auto leading-relaxed">
              {language === "vi"
                ? "Ít kiểm duyệt hơn. AI được mã hóa."
                : "Less censored. Encrypted AI."}
            </p>

            <button
              onClick={() => handleGoogleSignIn()}
              className="group relative flex w-full items-center justify-center gap-4 overflow-hidden rounded-full bg-white px-8 py-5 text-sm font-bold text-black transition-all hover:bg-[#F0F4F7] hover:scale-[1.02] active:scale-[0.98] shadow-2xl"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              {language === "vi" ? "ĐĂNG NHẬP VỚI GOOGLE" : "SIGN IN WITH GOOGLE"}
            </button>
          </div>
        </div>

        {/* Footer Info */}
        <div className="pt-12 animate-in fade-in duration-1000 delay-500">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/5 bg-white/5 text-[10px] font-bold text-white/20 tracking-[0.3em] uppercase">
            ENCRYPTED END-TO-END
          </div>
        </div>
      </div>

      <style jsx>{`
        .flowing-gradient {
          background: linear-gradient(
            to left,
            #6366f1,
            /* indigo */ #d4af37,
            /* metallic gold */ #ef4444,
            /* red */ #ec4899,
            /* rose */ #f59e0b,
            /* amber */ #3b82f6,
            /* blue/blueprint */ #6366f1 /* indigo back */
          );
          background-size: 300% 100%;
          animation: flow 12s linear infinite;
        }

        .flowing-gradient-text {
          background-image: linear-gradient(
            to left,
            #6366f1,
            #d4af37,
            #ef4444,
            #ec4899,
            #f59e0b,
            #3b82f6,
            #6366f1
          );
          background-size: 300% 100%;
          animation: flow 12s linear infinite;
        }

        @keyframes flow {
          0% {
            background-position: 0% 0%;
          }
          100% {
            background-position: 300% 0%;
          }
        }
      `}</style>
    </div>
  );
}
