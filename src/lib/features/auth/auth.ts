// Validate environment variables on import
import "@/lib/env";

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import { logger } from "@/lib/utils/logger";
import { getAuthVersion, refreshTokenFromDB } from "@/lib/features/auth/authRevocation";

const authLogger = logger.withContext("auth");

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],

  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // Update session every 24 hours
  },

  // SECURITY: Configure cookies for CSRF protection
  cookies: {
    sessionToken: {
      name: `${process.env.NODE_ENV === "production" ? "__Secure-" : ""}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    callbackUrl: {
      name: `${process.env.NODE_ENV === "production" ? "__Secure-" : ""}next-auth.callback-url`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    csrfToken: {
      name: `${process.env.NODE_ENV === "production" ? "__Host-" : ""}next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },

  callbacks: {
    async signIn({ user, account: _account }) {
      const email = (user?.email || "").trim().toLowerCase();
      if (!email) return false;

      const supabase = getSupabaseAdmin();

      // Check if user exists in profiles
      const { data: profile, error: fetchError } = await supabase
        .from("profiles")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (fetchError) {
        authLogger.warn("Error checking profile:", fetchError);
        return false;
      }

      // If profile exists, check if blocked
      if (profile) {
        if (profile.is_blocked) {
          authLogger.warn(`Blocked user attempted login: ${email}`);
          return false;
        }
        // Allow login for existing users (even if not_whitelisted - they can see pending message)
        return true;
      }

      // Auto-create profile for NEW user with "not_whitelisted" rank
      // Admin must manually approve by changing rank
      // CANONICAL IDENTITY: email (lowercased) is used as profile.id

      // Create profile with pending approval status
      const { error: insertError } = await supabase.from("profiles").insert({
        id: email, // Canonical userId = email
        email,
        rank: "not_whitelisted", // Manual approval required
        is_blocked: false,
      });

      if (insertError) {
        authLogger.warn("Error creating profile:", insertError);
        return false;
      }

      authLogger.info(`New user pending approval: ${email}`);
      return true; // Allow login but restrict access via rank
    },

    async jwt({ token, user, account }) {
      // Initial sign-in: populate token with user data
      if (user) {
        token.email = user.email || undefined;
        token.name = user.name || undefined;
        token.picture = user.image || undefined;

        // Store Google providerAccountId for reference (legacy)
        if (account?.providerAccountId) {
          token.profileId = account.providerAccountId;
        }

        // Fetch user rank from profiles
        const email = (user.email || "").trim().toLowerCase();
        if (email) {
          const supabase = getSupabaseAdmin();
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, rank, is_blocked")
            .eq("email", email)
            .maybeSingle();

          if (profile) {
            if (profile.is_blocked) {
              authLogger.warn(`Blocked user signed in: ${email}`);
              return { blocked: true } as typeof token;
            }
            token.rank = profile.rank;
            // CANONICAL: userId = email (lowercased)
            token.userId = email;
            token.rankVersion = Date.now();
            token.rankRefreshedAt = Date.now();
          }
        }
        return token;
      }

      // Subsequent requests: check if rank/block status changed
      if (token.userId && token.email) {
        const userId = token.userId as string;
        const email = (token.email as string).trim().toLowerCase();
        let needsRefresh = false;

        // Strategy 1: Redis version check (instant, O(1))
        const currentVersion = await getAuthVersion(userId);
        if (currentVersion !== null) {
          const tokenVersion = (token.rankVersion as number) || 0;
          if (currentVersion > tokenVersion) {
            needsRefresh = true;
          }
        } else {
          // Strategy 2: Time-based fallback when Redis unavailable (2 min)
          const lastRefresh = (token.rankRefreshedAt as number) || 0;
          const FALLBACK_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
          if (Date.now() - lastRefresh > FALLBACK_INTERVAL_MS) {
            needsRefresh = true;
          }
        }

        if (needsRefresh) {
          const fresh = await refreshTokenFromDB(email);
          if (fresh) {
            if (fresh.isBlocked) {
              authLogger.warn(`Blocked user detected during JWT refresh: ${email}`);
              return { blocked: true } as typeof token;
            }
            token.rank = fresh.rank;
            token.userId = fresh.userId;
            token.rankVersion = Date.now();
            token.rankRefreshedAt = Date.now();
          }
        }
      }

      return token;
    },

    async session({ session, token }) {
      // If token is marked as blocked, signal session to redirect
      if (token.blocked) {
        session.user.rank = "__blocked__";
        return session;
      }

      if (session.user) {
        if (token.email) session.user.email = token.email as string;
        if (token.name) session.user.name = token.name as string;
        if (token.picture) session.user.image = token.picture as string;
        if (token.rank) session.user.rank = token.rank as string;
        if (token.userId) session.user.id = token.userId as string;
      }
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
});
