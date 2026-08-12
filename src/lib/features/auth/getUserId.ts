// Canonical userId extraction — single source of truth
// All routes should use this instead of inline session extraction.

import { auth } from "./auth";
import { UnauthorizedError } from "@/lib/utils/errors";

/**
 * Extract the canonical userId (email, lowercased) from the current session.
 * @throws UnauthorizedError if no valid session or email
 */
export async function getUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.email) {
    throw new UnauthorizedError();
  }
  return session.user.email.toLowerCase();
}

/**
 * Extract the canonical userId and full session.
 * Use when you need both the userId and other session data (rank, name, etc.).
 * @throws UnauthorizedError if no valid session or email
 */
export async function getUserSession() {
  const session = await auth();
  if (!session?.user?.email) {
    throw new UnauthorizedError();
  }
  return {
    userId: session.user.email.toLowerCase(),
    session,
  };
}
