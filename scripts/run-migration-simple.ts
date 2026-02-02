// Simple migration runner using direct SQL execution
// This version reads the SQL file and executes it statement by statement
// Run with: tsx scripts/run-migration-simple.ts
/* eslint-disable no-console */

import { getSupabaseAdmin } from "@/lib/core/supabase.server";
import { readFileSync } from "fs";
import { join } from "path";

async function runMigration() {
  console.log("🚀 Starting database migration...\n");

  const supabase = getSupabaseAdmin();
  const sqlPath = join(__dirname, "..", "database-migrations", "001_admin_system.sql");

  console.log(`📂 Reading: ${sqlPath}\n`);
  const fullSql = readFileSync(sqlPath, "utf-8");

  // For PostgreSQL, we need to execute the entire SQL as one batch
  // But Supabase client doesn't directly support arbitrary SQL execution
  // We'll need to use the Supabase Management API or psql

  console.log("📋 SQL Content Preview:");
  console.log(fullSql.substring(0, 200) + "...\n");

  console.log("⚠️  Supabase client cannot execute arbitrary SQL directly.");
  console.log("Please use ONE of these methods:\n");

  console.log("METHOD 1: Supabase Dashboard (Recommended)");
  console.log("  1. Go to: https://otqhztwogsvsfeuwhrom.supabase.co/project/_/sql");
  console.log("  2. Copy the SQL from: database-migrations/001_admin_system.sql");
  console.log('  3. Paste and click "Run"\n');

  console.log("METHOD 2: Use psql directly");
  console.log(
    "  psql -h db.otqhztwogsvsfeuwhrom.supabase.co -U postgres -d postgres -f database-migrations/001_admin_system.sql\n"
  );

  console.log("METHOD 3: Use Supabase CLI");
  console.log("  npx supabase db reset (requires local setup)");
  console.log("  or link to remote and use supabase db push\n");

  // Try to at least verify connection
  console.log("🔍 Verifying Supabase connection...");
  const { data: _data, error } = await supabase.from("conversations").select("count").limit(1);

  if (error) {
    console.error("❌ Connection failed:", error.message);
    process.exit(1);
  }

  console.log("✅ Connection successful!\n");
  console.log("💡 Next step: Please run the SQL manually using METHOD 1 above.");
}

runMigration().catch(console.error);
