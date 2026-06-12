"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "../../features/chat/hooks/useLanguage";

function AuthErrorContent() {
  const { language, setLanguage } = useLanguage();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="min-h-screen bg-[#020617]" />;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#020617] text-white">
      {/* 🌌 Multi-tone Flowing Background */}
      <div className="absolute inset-0 z-0">
        <div className="flowing-gradient absolute inset-0 opacity-30" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#020617_85%)]" />
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
      <div className="relative z-10 w-full max-w-md px-6 space-y-8 text-center">
        {/* Error Icon */}
        <div className="mx-auto h-24 w-24 relative flex items-center justify-center">
          <div className="absolute inset-0 bg-(--danger)/10 blur-3xl rounded-full" />
          <div className="relative flex h-full w-full items-center justify-center rounded-4xl border border-(--danger)/20 bg-(--danger)/5 backdrop-blur-sm overflow-hidden shadow-2xl">
            <svg
              className="h-12 w-12 text-(--danger)"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>

        {/* Error Message */}
        <div className="space-y-4">
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
            {language === "vi" ? "Truy Cập Bị Từ Chối" : "Access Denied"}
          </h1>

          <div className="rounded-4xl border border-(--danger)/20 bg-(--danger)/5 p-6 backdrop-blur-sm">
            <p className="text-base font-medium text-white/80 leading-relaxed mb-4">
              {language === "vi"
                ? "Email của bạn chưa được cấp phép truy cập ứng dụng này."
                : "Your email is not authorized to access this application."}
            </p>
            <p className="text-sm font-medium text-white/60 leading-relaxed">
              {language === "vi"
                ? "Chỉ những người dùng có trong whitelist mới được phép sử dụng dịch vụ này."
                : "Only whitelisted users are allowed to use this service."}
            </p>
          </div>

          <p className="text-sm text-white/40">
            {language === "vi"
              ? "Nếu bạn nghĩ đây là lỗi, vui lòng liên hệ với quản trị viên."
              : "If you believe this is an error, please contact the administrator."}
          </p>
        </div>

        {/* Back Button */}
        <div className="pt-4">
          <button
            onClick={() => router.push("/auth/signin")}
            className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-white/10 hover:scale-[1.02] active:scale-[0.98]"
          >
            {language === "vi" ? "Quay Lại Đăng Nhập" : "Back to Sign In"}
          </button>
        </div>
      </div>

      <style jsx>{`
        .flowing-gradient {
          background: linear-gradient(
            to left,
            #ef4444,
            /* red */ #dc2626,
            /* darker red */ #991b1b,
            /* dark red */ #dc2626,
            /* darker red */ #ef4444 /* red back */
          );
          background-size: 300% 100%;
          animation: flow 8s linear infinite;
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

export default function AuthErrorPage() {
  return <AuthErrorContent />;
}
