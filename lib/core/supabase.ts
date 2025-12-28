// /lib/core/supabase.ts
// Validate environment variables on import
import "@/lib/env";

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { trackQuery } from "@/lib/utils/performance";

/**
 * Picks the first available environment variable from a list of possible keys.
 * Useful for supporting multiple env var names (aliases).
 * 
 * @param keys - Array of environment variable keys to check in order
 * @returns The first non-empty value found, or empty string if none found
 */
function pickFirstEnv(keys: string[]): string {
  for (const k of keys) {
    const v = process.env[k];
    if (v && String(v).trim()) return String(v).trim();
  }
  return "";
}

/**
 * Returns a Supabase admin client with service role permissions.
 * 
 * This client has full database access and bypasses Row Level Security (RLS).
 * Use with caution - only for server-side operations.
 * 
 * **Environment Variables:**
 * - `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL` - Supabase project URL
 * - `SUPABASE_SERVICE_ROLE_KEY` (or aliases: `SUPABASE_SERVICE_KEY`, `SUPABASE_SERVICE_ROLE`, `SUPABASE_SERVICE`) - Service role key
 * 
 * **Aliases Supported:**
 * The function accepts multiple env var names to avoid configuration issues
 * (e.g., Vercel may use different naming conventions).
 * 
 * @returns Configured Supabase client with admin privileges
 * @throws {Error} If required environment variables are missing
 * 
 * @example
 * ```typescript
 * const supabase = getSupabaseAdmin();
 * const { data } = await supabase.from('conversations').select('*');
 * ```
 */
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

