"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { Lock, TriangleAlert } from "lucide-react";
import { useLanguage } from "../../features/chat/hooks/useLanguage";
import { AuthShell } from "../../features/layout/components/AuthShell";

function AuthErrorContent() {
  const { language } = useLanguage();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);

  const error = searchParams.get("error");
  const isBlocked = error === "blocked";

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="min-h-dvh bg-(--bg)" />;

  const vi = language === "vi";
  const handleBackToSignIn = () => {
    void signOut({ callbackUrl: "/auth/signin" });
  };
  const Icon = isBlocked ? Lock : TriangleAlert;

  return (
    <AuthShell>
      <div
        aria-hidden="true"
        className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-(--danger)/30 bg-(--danger)/10 text-(--danger)"
      >
        <Icon className="h-9 w-9" />
      </div>

      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight text-(--text) sm:text-4xl">
          {isBlocked
            ? vi
              ? "Tài khoản đã bị khóa"
              : "Account blocked"
            : vi
              ? "Truy cập bị từ chối"
              : "Access denied"}
        </h1>

        <div
          role="alert"
          className="rounded-3xl border border-(--danger)/30 bg-(--danger)/10 p-6 text-left"
        >
          <p className="text-base leading-relaxed text-(--text)">
            {isBlocked
              ? vi
                ? "Tài khoản của bạn đã bị quản trị viên vô hiệu hóa. Vui lòng liên hệ quản trị viên để biết thêm chi tiết."
                : "Your account has been disabled by an administrator. Please contact the admin for more information."
              : vi
                ? "Email của bạn chưa được cấp phép truy cập ứng dụng này."
                : "Your email is not authorized to access this application."}
          </p>
          {!isBlocked && (
            <p className="mt-3 text-sm leading-relaxed text-(--muted)">
              {vi
                ? "Chỉ những người dùng có trong danh sách được cấp phép mới dùng được dịch vụ này."
                : "Only users on the allowlist can use this service."}
            </p>
          )}
        </div>

        {!isBlocked && (
          <p className="text-sm text-(--muted)">
            {vi
              ? "Nếu bạn nghĩ đây là lỗi, vui lòng liên hệ với quản trị viên."
              : "If you believe this is an error, please contact the administrator."}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={handleBackToSignIn}
        className="flex h-12 w-full items-center justify-center rounded-full border border-(--line) bg-(--surface) px-6 text-sm font-semibold text-(--text) transition-colors hover:bg-(--raised) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
      >
        {vi ? "Quay lại đăng nhập" : "Back to sign in"}
      </button>
    </AuthShell>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-(--bg)" />}>
      <AuthErrorContent />
    </Suspense>
  );
}
