// /app/api/cron/attachments-cleanup/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAttachmentsConfig, getSupabaseAdmin } from "@/lib/features/attachments/attachments";

function pickFirstEnv(keys) {
  for (const k of keys) {
    const v = process.env[k];
    if (v && String(v).trim()) return String(v).trim();
  }
  return "";
}

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

async function runCleanup() {
  const supabase = getSupabaseAdmin();
  const cfg = getAttachmentsConfig();
  const now = new Date().toISOString();

  let deleted = 0;
  for (let i = 0; i < 10; i++) {
    const { data: rows, error } = await supabase
      .from("attachments")
      .select("id,bucket,storage_path")
      .lte("expires_at", now)
      .order("expires_at", { ascending: true })
      .limit(200);

    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) break;

    const byBucket = new Map();
    const ids = [];

    for (const r of rows) {
      if (!r?.id || !r?.storage_path) continue;
      ids.push(r.id);
      const bucket = r.bucket || cfg.bucket;
      const arr = byBucket.get(bucket) || [];
      arr.push(r.storage_path);
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

export async function GET(req) {
  try {
    const secret = pickFirstEnv(["ATTACHMENTS_CRON_SECRET", "CRON_SECRET"]);
    if (!secret) return unauthorized();

    const url = new URL(req.url);
    const provided = req.headers.get("x-cron-secret") || url.searchParams.get("secret") || "";
    if (provided !== secret) return unauthorized();

    const result = await runCleanup();
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("GET /api/cron/attachments-cleanup error:", err);
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}

export async function POST(req) {
  return GET(req);
}
