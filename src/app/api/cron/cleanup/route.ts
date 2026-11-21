/**
 * Cron API - Cleanup expired files & stuck processing documents
 * GET/POST /api/cron/cleanup - Delete files past their TTL and timeout stuck knowledge uploads
 *
 * Protected by x-cron-secret header. Called by Vercel Cron or external scheduler.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { cleanupExpiredFiles } from "@/lib/features/files/fileService.server";
import { cleanupStuckProcessingDocuments } from "@/lib/features/projects/knowledge.server";
import { error } from "@/lib/utils/apiResponse";
import { logger } from "@/lib/utils/logger";

const routeLogger = logger.withContext("/api/cron/cleanup");

function constantTimeEqual(a: string, b: string): boolean {
  const hashA = crypto.createHash("sha256").update(a).digest();
  const hashB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function verifyCronSecret(req: NextRequest): boolean {
  const secret = req.headers.get("x-cron-secret") || req.headers.get("authorization");
  const expected = process.env.CRON_SECRET || process.env.ATTACHMENTS_CRON_SECRET;
  if (!expected || !secret) return false;
  return constantTimeEqual(secret, expected) || constantTimeEqual(secret, `Bearer ${expected}`);
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [filesSettled, docsSettled] = await Promise.allSettled([
      cleanupExpiredFiles(),
      cleanupStuckProcessingDocuments(),
    ]);

    const fileResult =
      filesSettled.status === "fulfilled" ? filesSettled.value : { deleted: 0, errors: 1 };
    const stuckDocsCleaned = docsSettled.status === "fulfilled" ? docsSettled.value : 0;

    if (filesSettled.status === "rejected") {
      routeLogger.error("cleanupExpiredFiles failed", filesSettled.reason);
    }
    if (docsSettled.status === "rejected") {
      routeLogger.error("cleanupStuckProcessingDocuments failed", docsSettled.reason);
    }

    routeLogger.info(
      `Cleanup complete: deleted=${fileResult.deleted}, errors=${fileResult.errors}, stuck docs cleaned=${stuckDocsCleaned}`
    );
    return NextResponse.json({ ...fileResult, stuckDocsCleaned });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    routeLogger.error(`Cleanup failed: ${msg}`);
    return error("Cleanup failed", 500);
  }
}

// Also support POST for flexibility
export const POST = GET;
