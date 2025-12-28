// /app/api/conversations/auth.ts

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/features/auth/auth";

export interface RequireUserResult {
  ok: false;
  response: NextResponse;
}

export interface RequireUserSuccess {
  ok: true;
  userId: string;
  session: unknown; // Session type from NextAuth (avoiding type conflicts)
}

export type RequireUserResponse = RequireUserResult | RequireUserSuccess;

/**
 * Centralized auth for /api/conversations.*
 *
 * Returns a uniform shape so route handlers can remain concise without changing behavior.
 */
export async function requireUser(req: NextRequest): Promise<RequireUserResponse> {
  const session = await auth();
  if (!session?.user?.email) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  // We've already checked session is not null and has user.email above
  return {
    ok: true,
    userId: session.user.email.toLowerCase(),
    session: session as unknown, // Type assertion to avoid NextAuth type conflicts
  };
}

