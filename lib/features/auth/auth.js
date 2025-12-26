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

      const email = (user?.email || profile?.email || "")
        .trim()
        .toLowerCase();

      if (!email) return false;
      return whitelist.includes(email);
    },

    async jwt({ token, user, profile }) {
      if (user) {
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email;
        session.user.name = token.name;
        session.user.image = token.picture;
      }
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
});
