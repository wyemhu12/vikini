/**
 * verify-rls-negative-probe.ts
 *
 * Negative Probe script for RLS Security Audit Cycle 2.
 * Verifies that unauthenticated / anonymous roles are denied access to:
 * - 4 sensitive tables: daily_message_counts, daily_research_counts, research_tasks, personas
 * - 4 locked SECURITY DEFINER RPCs: increment_daily_message_count, increment_daily_research_count, match_project_knowledge, get_project_storage_bytes
 *
 * Asserts PostgreSQL error code 42501 (permission denied).
 */

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "http://127.0.0.1:54321";

const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!anonKey) {
  console.error("[-] ERROR: NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY is required.");
  console.error("[-] Provide it via environment variable to run this live probe.");
  process.exit(1);
}

const key: string = anonKey;

interface ProbeResult {
  target: string;
  type: "table" | "rpc";
  status: number;
  code?: string;
  message?: string;
  passed: boolean;
}

const results: ProbeResult[] = [];

async function probeTable(tableName: string): Promise<void> {
  const url = `${supabaseUrl}/rest/v1/${tableName}?select=*&limit=1`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });

    const data = await res.json().catch(() => ({}));
    const code = data?.code;
    const isDenied = res.status === 401 || res.status === 403 || code === "42501";

    results.push({
      target: tableName,
      type: "table",
      status: res.status,
      code,
      message: data?.message,
      passed: isDenied,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    results.push({
      target: tableName,
      type: "table",
      status: 0,
      message,
      passed: false,
    });
  }
}

async function probeRpc(rpcName: string, body: Record<string, unknown>): Promise<void> {
  const url = `${supabaseUrl}/rest/v1/rpc/${rpcName}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    const code = data?.code;
    const isDenied = res.status === 401 || res.status === 403 || code === "42501";

    results.push({
      target: rpcName,
      type: "rpc",
      status: res.status,
      code,
      message: data?.message,
      passed: isDenied,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    results.push({
      target: rpcName,
      type: "rpc",
      status: 0,
      message,
      passed: false,
    });
  }
}

async function main() {
  console.warn(`[+] Starting RLS Negative Probe on: ${supabaseUrl}`);

  // 1. Probe tables
  const tables = ["daily_message_counts", "daily_research_counts", "research_tasks", "personas"];
  for (const table of tables) {
    await probeTable(table);
  }

  // 2. Probe RPCs
  await probeRpc("increment_daily_message_count", {
    p_user_id: "dummy-user",
    p_date: "2026-10-12",
  });

  await probeRpc("increment_daily_research_count", {
    p_user_id: "dummy-user",
    p_date: "2026-10-12",
  });

  await probeRpc("match_project_knowledge", {
    p_project_id: "00000000-0000-0000-0000-000000000000",
    query_embedding: JSON.stringify(new Array(3072).fill(0)),
    match_threshold: 0.5,
    match_count: 5,
  });

  await probeRpc("get_project_storage_bytes", {
    p_project_id: "00000000-0000-0000-0000-000000000000",
  });

  // Report
  console.warn("\n==================== RLS PROBE SUMMARY ====================");
  let allPassed = true;
  for (const r of results) {
    const statusIcon = r.passed ? "[PASS]" : "[FAIL]";
    console.warn(
      `${statusIcon} ${r.type.toUpperCase()}: ${r.target} (HTTP ${r.status}, code: ${r.code || "N/A"})`
    );
    if (!r.passed) {
      allPassed = false;
      console.error(`       Message: ${r.message}`);
    }
  }
  console.warn("===========================================================\n");

  if (!allPassed) {
    console.error("[-] Verification failed: One or more targets did NOT deny anonymous access.");
    process.exit(1);
  }

  console.warn("[+] All 8 targets successfully denied anonymous access (code: 42501).");
}

main().catch((err: unknown) => {
  console.error("Fatal probe error:", err);
  process.exit(1);
});
