// /app/features/chat/components/hooks/useAuthGate.ts
"use client";

import { useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

/** Extended session user with rank */
interface SessionUser {
  email?: string | null;
  name?: string | null;
  image?: string | null;
  rank?: string;
  id?: string;
}

/**
 * Session gate for the chat shell: signs blocked users out and
 * redirects unauthenticated visitors to sign in.
 */
export function useAuthGate() {
  const { data: session, status } = useSession();
  const isAuthLoading = status === "loading";
  const isAuthed = status === "authenticated" && !!session?.user?.email;

  // SECURITY: If user has been blocked, force sign out and redirect
  useEffect(() => {
    if (session?.user?.rank === "__blocked__") {
      void signOut({ callbackUrl: "/auth/error?error=blocked" });
    }
  }, [session?.user?.rank]);

  // Auto sign in
  useEffect(() => {
    if (!isAuthLoading && !isAuthed) void signIn();
  }, [isAuthed, isAuthLoading]);

  const isPendingAccess =
    isAuthed && (session?.user as SessionUser | undefined)?.rank === "not_whitelisted";

  return { session, isAuthLoading, isAuthed, isPendingAccess };
}
