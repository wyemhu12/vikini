// Validate environment variables on import
import "@/lib/env";

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getSupabaseAdmin } from "@/lib/core/supabase.server";

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
    async signIn({ user, account }) {
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
        console.warn("Error checking profile:", fetchError);
        return false;
      }

      // If profile exists, check if blocked
      if (profile) {
        if (profile.is_blocked) {
          console.warn(`Blocked user attempted login: ${email}`);
          return false;
        }
        // Allow login for existing users (even if not_whitelisted - they can see pending message)
        return true;
      }

      // Auto-create profile for NEW user with "not_whitelisted" rank
      // Admin must manually approve by changing rank
      const userId = account?.providerAccountId || user?.id;

      if (!userId) {
        console.warn("No user ID available for profile creation");
        return false;
      }

      // Create profile with pending approval status
      const { error: insertError } = await supabase.from("profiles").insert({
        id: userId,
        email,
        rank: "not_whitelisted", // Manual approval required
        is_blocked: false,
      });

      if (insertError) {
        console.warn("Error creating profile:", insertError);
        return false;
      }

      console.warn(`New user pending approval: ${email}`);
      return true; // Allow login but restrict access via rank
    },

    async jwt({ token, user, account: _account }) {
      if (user) {
        token.email = user.email || undefined;
        token.name = user.name || undefined;
        token.picture = user.image || undefined;

        // Fetch user rank from profiles
        const email = (user.email || "").trim().toLowerCase();
        if (email) {
          const supabase = getSupabaseAdmin();
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, rank")
            .eq("email", email)
            .maybeSingle();

          if (profile) {
            token.rank = profile.rank;
            token.userId = profile.id;
          }
        }
      }
      return token;
    },

    async session({ session, token }) {
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
