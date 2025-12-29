// Migration runner script to execute SQL migrations on Supabase
// Run with: node --loader tsx scripts/run-migration.ts
/* eslint-disable no-console */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

// Read env vars
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing Supabase credentials in environment variables");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runMigration(sqlFilePath: string) {
  console.log(`📂 Reading migration file: ${sqlFilePath}`);

  const sql = readFileSync(sqlFilePath, "utf-8");

  // Split by semicolons and filter out empty statements
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--") && !s.match(/^COMMENT/));

  console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.substring(0, 60).replace(/\n/g, " ");

    console.log(`[${i + 1}/${statements.length}] Executing: ${preview}...`);

    try {
      // Execute using Supabase RPC (requires exec_sql function in DB)
      // Alternative: use direct SQL execution if available
      const { data: _data, error } = await supabase.rpc("exec_sql", { sql: stmt + ";" });

      if (error) {
        // If exec_sql doesn't exist, we need to create tables differently
        console.log(`⚠️  RPC method not available, trying direct execution...`);
        throw error;
      }

      console.log(`✅ Success`);
      successCount++;
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`);
      errorCount++;
    }

    console.log("");
  }

  console.log("\n" + "=".repeat(60));
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log("=".repeat(60));

  if (errorCount > 0) {
    console.log("\n⚠️  Some statements failed. Check errors above.");
    process.exit(1);
  }
}

// Run migration
const migrationFile = join(__dirname, "..", "database-migrations", "001_admin_system.sql");
runMigration(migrationFile)
  .then(() => {
    console.log("\n✅ Migration completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  });
