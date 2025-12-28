import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { parseWhitelist } from "@/lib/core/whitelist";

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
  },

  session: { strategy: "jwt" },

  callbacks: {
    async signIn({ user, profile }) {
      const whitelist = parseWhitelist(process.env.WHITELIST_EMAILS || "");
      if (!whitelist.length) return true;

      const email = (user?.email || (profile as { email?: string })?.email || "")
        .trim()
        .toLowerCase();

      if (!email) return false;
      return whitelist.includes(email);
    },

    async jwt({ token, user, profile }) {
      if (user) {
        token.email = user.email || undefined;
        token.name = user.name || undefined;
        token.picture = user.image || undefined;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        if (token.email) session.user.email = token.email as string;
        if (token.name) session.user.name = token.name as string;
        if (token.picture) session.user.image = token.picture as string;
      }
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
});

