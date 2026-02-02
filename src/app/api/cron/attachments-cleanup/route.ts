// /app/api/cron/attachments-cleanup/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getAttachmentsConfig, getSupabaseAdmin } from "@/lib/features/attachments/attachments";
import { logger } from "@/lib/utils/logger";
import { UnauthorizedError, AppError } from "@/lib/utils/errors";
import { success, errorFromAppError, error } from "@/lib/utils/apiResponse";

const routeLogger = logger.withContext("/api/cron/attachments-cleanup");

interface AttachmentRow {
  id: string;
  bucket?: string;
  storage_path?: string;
  [key: string]: unknown;
}

interface CleanupResult {
  ok: boolean;
  deleted: number;
}

function pickFirstEnv(keys: string[]): string {
  for (const k of keys) {
    const v = process.env[k];
    if (v && String(v).trim()) return String(v).trim();
  }
  return "";
}

async function runCleanup(): Promise<CleanupResult> {
  const supabase = getSupabaseAdmin();
  const cfg = getAttachmentsConfig();
  const now = new Date().toISOString();

  let deleted = 0;
  for (let i = 0; i < 10; i++) {
    const { data: rows, error: fetchError } = await supabase
      .from("attachments")
      .select("id,bucket,storage_path")
      .lte("expires_at", now)
      .order("expires_at", { ascending: true })
      .limit(200);

    if (fetchError) throw new Error(fetchError.message);
    if (!rows || rows.length === 0) break;

    const byBucket = new Map<string, string[]>();
    const ids: string[] = [];

    for (const r of rows) {
      const row = r as AttachmentRow;
      if (!row?.id || !row?.storage_path) continue;
      ids.push(row.id);
      const bucket = (row.bucket || cfg.bucket) as string;
      const arr = byBucket.get(bucket) || [];
      arr.push(row.storage_path);
      byBucket.set(bucket, arr);
    }

    for (const [bucket, paths] of byBucket.entries()) {
      if (!paths.length) continue;
      const rm = await supabase.storage.from(bucket).remove(paths);
      if (rm.error) throw new Error(rm.error.message);
    }

    if (ids.length) {
      const del = await supabase.from("attachments").delete().in("id", ids);
      if (del.error) throw new Error(del.error.message);
      deleted += ids.length;
    }
  }

  return { ok: true, deleted };
}

export async function GET(req: NextRequest) {
  try {
    const secret = pickFirstEnv(["ATTACHMENTS_CRON_SECRET", "CRON_SECRET"]);
    if (!secret) throw new UnauthorizedError("Cron secret not configured");

    // SECURITY: Only use header, never query params (query params can be logged/exposed)
    const provided = req.headers.get("x-cron-secret") || "";
    if (!provided || provided !== secret) {
      throw new UnauthorizedError("Invalid cron secret");
    }

    const result = await runCleanup();
    return success(result);
  } catch (err: unknown) {
    routeLogger.error("GET error:", err);
    if (err instanceof AppError) return errorFromAppError(err);
    return error("Cleanup failed", 500);
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
