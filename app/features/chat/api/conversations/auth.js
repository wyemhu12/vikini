// /app/api/conversations/auth.js

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/features/auth/auth";

/**
 * Centralized auth for /api/conversations.*
 *
 * Returns a uniform shape so route handlers can remain concise without changing behavior.
 */
export async function requireUser(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return {
    ok: true,
    userId: session.user.email.toLowerCase(),
    session,
  };
}
