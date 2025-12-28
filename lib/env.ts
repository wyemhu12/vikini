// /lib/env.ts
// This file validates environment variables when imported
// Import this file early in your app to ensure validation runs at startup

import { validateEnv } from "./utils/envValidation";

// Validate environment variables on import
// This will throw an error if required env vars are missing
let validatedEnv: ReturnType<typeof validateEnv> | null = null;

try {
  validatedEnv = validateEnv();
} catch (error) {
  // In development, log the error but don't crash
  // In production, this should fail fast
  if (process.env.NODE_ENV === "production") {
    throw error;
  }
  console.error("⚠️  Environment validation failed:", error);
  console.error("⚠️  App may not work correctly. Please fix your environment variables.");
}

export { validatedEnv };

