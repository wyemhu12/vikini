// /lib/core/supabase.ts
// Validate environment variables on import
import "@/lib/env";

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Global cache for Supabase admin client to implement Singleton pattern.
 */
let cachedAdminClient: SupabaseClient<Database> | null = null;

/**
 * Picks the first available environment variable from a list of possible keys.
 */
function pickFirstEnv(keys: string[]): string {
  for (const k of keys) {
    const v = process.env[k];
    if (v && String(v).trim()) return String(v).trim();
  }
  return "";
}

function initAdminClient(): SupabaseClient<Database> {
  if (cachedAdminClient) return cachedAdminClient;

  const url = pickFirstEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"]);
  const serviceKey = pickFirstEnv([
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SERVICE_KEY",
    "SUPABASE_SERVICE_ROLE",
    "SUPABASE_SERVICE",
  ]);

  if (!url) throw new Error("Missing Supabase URL");
  if (!serviceKey) throw new Error("Missing Supabase service role key");

  cachedAdminClient = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false },
  });

  return cachedAdminClient;
}

/**
 * Returns a singleton instance of Supabase admin client with service role permissions.
 * Untyped SupabaseClient for backward compatibility.
 */
export function getSupabaseAdmin(): SupabaseClient {
  return initAdminClient();
}

/**
 * Returns a singleton instance of Supabase admin client with full Database type safety.
 */
export function getTypedSupabaseAdmin(): SupabaseClient<Database> {
  return initAdminClient();
}
