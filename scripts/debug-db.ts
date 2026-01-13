/* eslint-disable no-console */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// Use standard URL if NEXT_PUBLIC is missing, as detected before
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLastMessage() {
  console.log("Checking last assistant messages...");
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(2); // Check last 2 to be sure

  if (error) {
    console.error("Error:", error);
    return;
  }

  data.forEach((msg, idx) => {
    console.log(`[Message ${idx}] Content: ${msg.content.substring(0, 50)}...`);
    console.log(`[Message ${idx}] Meta:`, JSON.stringify(msg.meta, null, 2));
  });
}

checkLastMessage();
