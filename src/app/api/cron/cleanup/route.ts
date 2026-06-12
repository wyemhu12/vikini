/**
 * Cron API — Cleanup expired files
 * GET/POST /api/cron/cleanup — Delete files past their TTL
 *
 * Protected by x-cron-secret header. Called by Vercel Cron or external scheduler.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { cleanupExpiredFiles } from "@/lib/features/files/fileService.server";
import { logger } from "@/lib/utils/logger";

const routeLogger = logger.withContext("/api/cron/cleanup");

function verifyCronSecret(req: NextRequest): boolean {
  const secret = req.headers.get("x-cron-secret") || req.headers.get("authorization");
  const expected = process.env.CRON_SECRET || process.env.ATTACHMENTS_CRON_SECRET;
  if (!expected) return false;
  return secret === expected || secret === `Bearer ${expected}`;
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await cleanupExpiredFiles();
    routeLogger.info(`Cleanup complete: deleted=${result.deleted}, errors=${result.errors}`);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    routeLogger.error(`Cleanup failed: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Also support POST for flexibility
export const POST = GET;
