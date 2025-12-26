import GoogleProvider from "next-auth/providers/google";
import { parseWhitelist } from "@/lib/core/whitelist";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],

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
      if (!token || typeof token !== "object") token = {};

      if (user && typeof user === "object") {
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
      }

      if (profile && typeof profile === "object") {
        token.email = profile.email || token.email;
        token.name = profile.name || token.name;
        token.picture = profile.picture || token.picture;
      }

      return token;
    },

    async session({ session, token }) {
      session.user = session.user || {};
      session.user.email = token.email;
      session.user.name = token.name;
      session.user.image = token.picture;
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};
