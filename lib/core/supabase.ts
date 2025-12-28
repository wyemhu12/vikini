// /lib/core/supabase.ts
// Validate environment variables on import
import "@/lib/env";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

function pickFirstEnv(keys: string[]): string {
  for (const k of keys) {
    const v = process.env[k];
    if (v && String(v).trim()) return String(v).trim();
  }
  return "";
}

export function getSupabaseAdmin(): SupabaseClient {
  // Accept common Supabase env aliases to avoid Vercel misconfig
  const url = pickFirstEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"]);
  const serviceKey = pickFirstEnv([
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SERVICE_KEY",
    "SUPABASE_SERVICE_ROLE",
    "SUPABASE_SERVICE",
  ]);

  if (!url) throw new Error("Missing Supabase URL env (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL)");
  if (!serviceKey) throw new Error("Missing Supabase service role key env (SUPABASE_SERVICE_ROLE_KEY)");

  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

