"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "../../features/chat/hooks/useLanguage";
import { handleGoogleSignIn } from "./actions";

/**
 * 🌑 Warm Noir Login Page
 * Deep charcoal with a single amber/gold glow point.
 * Luxury editorial feel — no rainbow, no AI clichés.
 */

export default function SignInPage() {
  const { language, setLanguage, t } = useLanguage();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="min-h-screen bg-[#0a0a0a]" />;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0a0a0a] text-white">
      {/* 🌑 Warm Noir Background — single amber glow */}
      <div className="absolute inset-0 z-0">
        {/* Primary warm glow — top center */}
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.15)_0%,transparent_70%)] blur-3xl" />
        {/* Secondary subtle glow — bottom right */}
        <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.06)_0%,transparent_65%)]" />
        {/* Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#0a0a0a_85%)]" />
      </div>

      {/* Language Toggle */}
      <div className="fixed top-8 right-8 z-20">
        <div className="flex rounded-full border border-white/5 bg-white/5 p-1 backdrop-blur-3xl shadow-2xl">
          <button
            onClick={() => setLanguage("vi")}
            className={`px-4 py-1.5 text-[10px] font-bold rounded-full transition-colors duration-300 ${
              language === "vi" ? "bg-white text-black shadow-lg" : "text-white/40 hover:text-white"
            }`}
          >
            VI
          </button>
          <button
            onClick={() => setLanguage("en")}
            className={`px-4 py-1.5 text-[10px] font-bold rounded-full transition-colors duration-300 ${
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
          {/* Large Logo V — gold gradient */}
          <div className="mx-auto h-32 w-32 relative flex items-center justify-center">
            {/* Warm glow behind logo */}
            <div className="absolute inset-0 bg-[#d4af37]/8 blur-3xl rounded-full" />

            {/* The "V" with gold gradient */}
            <div className="relative flex h-full w-full items-center justify-center rounded-[2.5rem] border border-[#d4af37]/15 bg-white/[0.02] backdrop-blur-sm overflow-hidden shadow-2xl">
              <span className="text-7xl font-black text-transparent bg-clip-text warm-gradient-text select-none">
                V
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <h1
              className="text-5xl font-black text-white sm:text-6xl font-sans"
              style={{ letterSpacing: "-0.03em" }}
            >
              {t("appName")}
            </h1>
            <p className="text-xs font-bold uppercase tracking-[0.6em] text-white/30">
              {t("authorizedAccess")}
            </p>
          </div>
        </div>

        {/* Action Area */}
        <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
          <div className="rounded-[3rem] border border-[#d4af37]/8 bg-white/[0.02] p-10 backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <p className="mb-10 text-base font-medium tracking-tight text-white/50 max-w-[300px] mx-auto leading-relaxed">
              {t("signinTagline")}
            </p>

            <button
              onClick={() => handleGoogleSignIn()}
              className="group relative flex w-full items-center justify-center gap-4 overflow-hidden rounded-full bg-white px-8 py-5 text-sm font-bold text-black transition-colors hover:bg-[#F0F4F7] hover:scale-[1.02] active:scale-[0.98] shadow-2xl"
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
              {t("signInWithGoogle")}
            </button>
          </div>
        </div>

        {/* Footer Info */}
        <div className="pt-12 animate-in fade-in duration-1000 delay-500">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/5 bg-white/[0.03] text-[10px] font-bold text-white/20 tracking-[0.3em] uppercase">
            {t("encryptedE2E")}
          </div>
        </div>
      </div>

      <style jsx>{`
        .warm-gradient-text {
          background-image: linear-gradient(
            135deg,
            #d4af37,
            /* gold */ #f5deb3,
            /* wheat/champagne */ #d4af37
          );
          background-size: 200% 200%;
          animation: warm-shimmer 6s ease-in-out infinite;
        }

        @keyframes warm-shimmer {
          0%,
          100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
      `}</style>
    </div>
  );
}
