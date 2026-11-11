"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "../../features/chat/hooks/useLanguage";
import { AuthShell } from "../../features/layout/components/AuthShell";
import { handleGoogleSignIn } from "./actions";

/** Sign-in page. Follows the app theme (Vikini 3.0, audit H7 / C4). */
export default function SignInPage() {
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Language lives in client storage: render after mount to avoid a hydration mismatch.
  if (!mounted) return <div className="min-h-dvh bg-(--bg)" />;

  return (
    <AuthShell>
      <div className="space-y-5">
        <div
          aria-hidden="true"
          className="mx-auto flex h-16 w-16 select-none items-center justify-center rounded-2xl bg-(--text) font-serif text-4xl italic leading-none text-(--bg)"
        >
          v
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight text-(--text)">{t("appName")}</h1>
          <p className="text-sm text-(--muted)">{t("authorizedAccess")}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-(--line) bg-(--surface) p-8">
        <p className="mx-auto mb-6 max-w-[300px] text-base leading-relaxed text-(--muted)">
          {t("signinTagline")}
        </p>

        <button
          type="button"
          onClick={() => handleGoogleSignIn()}
          className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-(--line) bg-(--bg) px-6 text-sm font-semibold text-(--text) transition-colors hover:bg-(--raised) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring)"
        >
          <svg aria-hidden="true" focusable="false" className="h-5 w-5" viewBox="0 0 24 24">
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

      <p className="text-xs text-(--faint)">{t("encryptedAtRest")}</p>
    </AuthShell>
  );
}
