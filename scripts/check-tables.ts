// Script để kiểm tra các tables trên Supabase
// Usage: ts-node scripts/check-tables.ts hoặc npx tsx scripts/check-tables.ts

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

interface KnownTable {
  name: string;
  description: string;
}

interface CheckTableResult {
  exists: boolean;
  error: string | null;
  count: number | null;
}

// Load environment variables from env.local or .env.local
function loadEnvFile(): void {
  const envFiles = [".env.local", "env.local", ".env"];

  for (const envFile of envFiles) {
    const envPath = path.join(process.cwd(), envFile);
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      const lines = content.split("\n");

      for (const line of lines) {
        const trimmedLine = line.trim();
        // Skip comments and empty lines
        if (!trimmedLine || trimmedLine.startsWith("#")) continue;

        const equalIndex = trimmedLine.indexOf("=");
        if (equalIndex === -1) continue;

        const key = trimmedLine.substring(0, equalIndex).trim();
        let value = trimmedLine.substring(equalIndex + 1).trim();

        // Remove quotes if present
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }

        // Only set if not already in process.env
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }

      console.log(`📄 Loaded environment variables from ${envFile}\n`);
      break;
    }
  }
}

// Load env file first
loadEnvFile();

// Lấy credentials từ environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase credentials!");
  console.error("Required environment variables:");
  console.error("  - NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL");
  console.error("  - SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY");
  console.error("\n💡 Create a .env.local file with these variables or export them in your shell");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

// List các tables đã biết trong project
const knownTables: KnownTable[] = [
  { name: "conversations", description: "Lưu thông tin các cuộc hội thoại" },
  { name: "messages", description: "Lưu các tin nhắn trong conversations" },
  { name: "gems", description: "Lưu các custom instructions/prompts" },
  { name: "gem_versions", description: "Lưu các phiên bản của gems" },
  { name: "attachments", description: "Lưu thông tin các file đính kèm" },
];

async function checkTable(tableName: string): Promise<CheckTableResult> {
  try {
    // Test query để kiểm tra table có tồn tại và có thể query được không
    const { data, error, count } = await supabase
      .from(tableName)
      .select("*", { count: "exact", head: true });

    if (error) {
      const err = error as { code?: string; message?: string };
      if (err.code === "42P01") {
        return { exists: false, error: "Table does not exist", count: 0 };
      } else if (err.code === "42501") {
        return { exists: true, error: "Permission denied", count: null };
      } else {
        return { exists: false, error: err.message || "Unknown error", count: 0 };
      }
    }

    return { exists: true, error: null, count: count || 0 };
  } catch (err) {
    const error = err as Error;
    return { exists: false, error: error.message, count: 0 };
  }
}

async function listTables(): Promise<void> {
  console.log("🔍 Checking tables on Supabase...\n");
  console.log(`📡 Connected to: ${supabaseUrl.replace(/https?:\/\//, "").split("/")[0]}\n`);

  console.log("📊 Checking known tables:\n");

  let existingCount = 0;
  let missingCount = 0;

  for (const table of knownTables) {
    const result = await checkTable(table.name);

    if (result.exists && !result.error) {
      console.log(`✅ ${table.name}`);
      console.log(`   ${table.description}`);
      console.log(`   Rows: ${result.count}`);
      existingCount++;
    } else if (result.exists && result.error) {
      console.log(`⚠️  ${table.name}`);
      console.log(`   ${table.description}`);
      console.log(`   Status: ${result.error}`);
      existingCount++;
    } else {
      console.log(`❌ ${table.name}`);
      console.log(`   ${table.description}`);
      console.log(`   Error: ${result.error}`);
      missingCount++;
    }
    console.log();
  }

  console.log("─".repeat(50));
  console.log(`\n📈 Summary: ${existingCount} existing, ${missingCount} missing\n`);

  if (missingCount > 0) {
    console.log("💡 Missing tables need to be created. Check database-schema.md for schema details.");
  }

  console.log("💡 To see full schema details, use:");
  console.log("   - Supabase Dashboard: https://supabase.com/dashboard");
  console.log("   - Supabase CLI: npx supabase db pull");
}

// Test connection và list tables
async function main(): Promise<void> {
  try {
    await listTables();
  } catch (error) {
    const err = error as Error;
    console.error("❌ Failed to check tables:", err.message);
    console.error("\n💡 Make sure your environment variables are set correctly");
    process.exit(1);
  }
}

main();

