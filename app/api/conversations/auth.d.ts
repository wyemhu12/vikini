// Type definitions for auth helper
import { NextRequest, NextResponse } from "next/server";

export interface RequireUserResult {
  ok: false;
  response: NextResponse;
}

export interface RequireUserSuccess {
  ok: true;
  userId: string;
  session: Awaited<ReturnType<typeof import("@/lib/features/auth/auth").auth>>;
}

export type RequireUserResponse = RequireUserResult | RequireUserSuccess;

export function requireUser(req: NextRequest): Promise<RequireUserResponse>;

