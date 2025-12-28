// Script để kiểm tra các indexes trên Supabase
// Usage: ts-node scripts/check-indexes.ts hoặc npx tsx scripts/check-indexes.ts

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Load environment variables
function loadEnvFile(): void {
  const envFiles = [".env.local", "env.local", ".env"];

  for (const envFile of envFiles) {
    const envPath = path.join(process.cwd(), envFile);
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      const lines = content.split("\n");

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith("#")) continue;

        const equalIndex = trimmedLine.indexOf("=");
        if (equalIndex === -1) continue;

        const key = trimmedLine.substring(0, equalIndex).trim();
        let value = trimmedLine.substring(equalIndex + 1).trim();

        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }

        if (!process.env[key]) {
          process.env[key] = value;
        }
      }

      console.log(`📄 Loaded environment variables from ${envFile}\n`);
      break;
    }
  }
}

loadEnvFile();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase credentials!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

interface ExpectedIndex {
  name: string;
  columns: string[];
  desc?: boolean;
  partial?: string;
}

interface ExpectedIndexes {
  [tableName: string]: ExpectedIndex[];
}

// Expected indexes based on optimization recommendations
const expectedIndexes: ExpectedIndexes = {
  conversations: [
    { name: "idx_conversations_user_updated", columns: ["user_id", "updated_at"], desc: true },
    { name: "idx_conversations_gem_id", columns: ["gem_id"], partial: "gem_id IS NOT NULL" },
  ],
  messages: [
    { name: "idx_messages_conversation_created", columns: ["conversation_id", "created_at"] },
    {
      name: "idx_messages_conversation_role_created",
      columns: ["conversation_id", "role", "created_at"],
      desc: true,
    },
  ],
  gems: [
    { name: "idx_gems_user_id", columns: ["user_id"], partial: "user_id IS NOT NULL" },
    { name: "idx_gems_is_premade", columns: ["is_premade"], partial: "is_premade = true" },
    { name: "idx_gems_name", columns: ["name"] },
  ],
  gem_versions: [{ name: "idx_gem_versions_gem_version_desc", columns: ["gem_id", "version"], desc: true }],
  attachments: [
    { name: "idx_attachments_conversation_user", columns: ["conversation_id", "user_id"] },
    { name: "idx_attachments_expires_at", columns: ["expires_at"], partial: "expires_at IS NOT NULL" },
    { name: "idx_attachments_message_id", columns: ["message_id"], partial: "message_id IS NOT NULL" },
    {
      name: "idx_attachments_conversation_user_created",
      columns: ["conversation_id", "user_id", "created_at"],
      desc: true,
    },
  ],
};

async function checkIndexes(): Promise<void> {
  console.log("🔍 Checking database indexes...\n");
  console.log(`📡 Connected to: ${(supabaseUrl ?? "").replace(/https?:\/\//, "").split("/")[0] || "(unknown)"}\n`);

  console.log("⚠️  Note: Supabase JS client doesn't support direct SQL queries.");
  console.log("💡 To check indexes, run this SQL in Supabase SQL Editor:\n");
  console.log("─".repeat(60));

  const sqlQuery = `
-- Check existing indexes
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('conversations', 'messages', 'gems', 'gem_versions', 'attachments')
ORDER BY tablename, indexname;
  `;

  console.log(sqlQuery);
  console.log("─".repeat(60));

  console.log("\n📋 Expected indexes by table:\n");

  for (const [tableName, indexes] of Object.entries(expectedIndexes)) {
    console.log(`\n📊 ${tableName}:`);
    indexes.forEach((idx) => {
      const cols = idx.columns.join(", ") + (idx.desc ? " DESC" : "");
      const partial = idx.partial ? ` WHERE ${idx.partial}` : "";
      console.log(`   ✓ ${idx.name} ON (${cols})${partial}`);
    });
  }

  console.log("\n💡 To create missing indexes, see: database-optimizations.sql");
}

checkIndexes().catch(console.error);

