// Type definitions for NextAuth to include custom fields in session
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      rank: string;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    rank?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    profileId?: string; // Google providerAccountId (legacy, for reference only)
    rank?: string;
    rankVersion?: number;
    rankRefreshedAt?: number;
    blocked?: boolean;
  }
}
