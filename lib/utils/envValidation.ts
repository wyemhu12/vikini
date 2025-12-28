// /lib/utils/envValidation.ts

import { z } from "zod";
import { logger } from "./logger";

const envLogger = logger.withContext("envValidation");

// Helper to pick first available env var (supports aliases)
function pickFirstEnv(keys: string[]): string | undefined {
  for (const k of keys) {
    const v = process.env[k];
    if (v && String(v).trim()) return String(v).trim();
  }
  return undefined;
}

// Schema for required environment variables
const requiredEnvSchema = z.object({
  // Supabase (accepts aliases)
  supabaseUrl: z.string().url(),
  supabaseServiceKey: z.string().min(1),

  // NextAuth
  nextAuthSecret: z.string().min(1),
  googleClientId: z.string().min(1),
  googleClientSecret: z.string().min(1),

  // Gemini API
  geminiApiKey: z.string().min(1),

  // Data Encryption (CRITICAL: Required for security)
  dataEncryptionKey: z.string().min(32, "DATA_ENCRYPTION_KEY must be at least 32 characters"),
});

// Schema for optional environment variables
const optionalEnvSchema = z.object({
  // NextAuth URL
  nextAuthUrl: z.string().url().optional(),

  // Whitelist
  whitelistEmails: z.string().optional(),

  // Redis (Upstash)
  upstashRedisUrl: z.string().url().optional(),
  upstashRedisToken: z.string().optional(),

  // App Environment
  appEnv: z.enum(["development", "production", "test"]).optional(),

  // Features
  webSearchEnabled: z.string().optional(),
  urlContextEnabled: z.string().optional(),

  // Attachments
  attachmentsBucket: z.string().optional(),
  attachmentsTtlHours: z.string().optional(),
  attachmentsCronSecret: z.string().optional(),

  // Attachment Limits
  attachMaxTextBytes: z.string().optional(),
  attachMaxImageBytes: z.string().optional(),
  attachMaxFilesPerConv: z.string().optional(),
  attachMaxTotalBytesPerConv: z.string().optional(),

  // Safety Settings
  geminiSafetySettingsJson: z.string().optional(),
}).passthrough(); // Allow other env vars

interface ValidatedEnv {
  // Required
  supabaseUrl: string;
  supabaseServiceKey: string;
  nextAuthSecret: string;
  googleClientId: string;
  googleClientSecret: string;
  geminiApiKey: string;
  dataEncryptionKey: string;

  // Optional
  nextAuthUrl?: string;
  whitelistEmails?: string;
  upstashRedisUrl?: string;
  upstashRedisToken?: string;
  appEnv?: "development" | "production" | "test";
  webSearchEnabled?: string;
  urlContextEnabled?: string;
  attachmentsBucket?: string;
  attachmentsTtlHours?: string;
  attachmentsCronSecret?: string;
  attachMaxTextBytes?: string;
  attachMaxImageBytes?: string;
  attachMaxFilesPerConv?: string;
  attachMaxTotalBytesPerConv?: string;
  geminiSafetySettingsJson?: string;
}

/**
 * Validates environment variables at app startup.
 * Throws error if required variables are missing or invalid.
 * 
 * @returns Validated environment variables
 * @throws Error if validation fails
 */
export function validateEnv(): ValidatedEnv {
  // Normalize env vars (support aliases)
  const normalizedEnv = {
    supabaseUrl: pickFirstEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"]),
    supabaseServiceKey: pickFirstEnv([
      "SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_SERVICE_KEY",
      "SUPABASE_SERVICE_ROLE",
      "SUPABASE_SERVICE",
    ]),
    nextAuthSecret: process.env.NEXTAUTH_SECRET,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    geminiApiKey: pickFirstEnv(["GEMINI_API_KEY", "GOOGLE_API_KEY"]),
    dataEncryptionKey: process.env.DATA_ENCRYPTION_KEY,
    nextAuthUrl: process.env.NEXTAUTH_URL,
    whitelistEmails: process.env.WHITELIST_EMAILS,
    upstashRedisUrl: process.env.UPSTASH_REDIS_REST_URL,
    upstashRedisToken: process.env.UPSTASH_REDIS_REST_TOKEN,
    appEnv: process.env.NEXT_PUBLIC_APP_ENV,
    webSearchEnabled: process.env.WEB_SEARCH_ENABLED,
    urlContextEnabled: process.env.URL_CONTEXT_ENABLED,
    attachmentsBucket: pickFirstEnv(["ATTACHMENTS_BUCKET", "SUPABASE_ATTACHMENTS_BUCKET"]),
    attachmentsTtlHours: pickFirstEnv(["ATTACHMENTS_TTL_HOURS", "ATTACH_TTL_HOURS"]),
    attachmentsCronSecret: process.env.ATTACHMENTS_CRON_SECRET,
    attachMaxTextBytes: process.env.ATTACH_MAX_TEXT_BYTES,
    attachMaxImageBytes: process.env.ATTACH_MAX_IMAGE_BYTES,
    attachMaxFilesPerConv: process.env.ATTACH_MAX_FILES_PER_CONV,
    attachMaxTotalBytesPerConv: process.env.ATTACH_MAX_TOTAL_BYTES_PER_CONV,
    geminiSafetySettingsJson: pickFirstEnv(["GEMINI_SAFETY_SETTINGS_JSON"]),
  };

  try {
    // Validate required vars
    const required = requiredEnvSchema.parse({
      supabaseUrl: normalizedEnv.supabaseUrl,
      supabaseServiceKey: normalizedEnv.supabaseServiceKey,
    nextAuthSecret: normalizedEnv.nextAuthSecret,
    googleClientId: normalizedEnv.googleClientId,
    googleClientSecret: normalizedEnv.googleClientSecret,
    geminiApiKey: normalizedEnv.geminiApiKey,
    dataEncryptionKey: normalizedEnv.dataEncryptionKey,
    });

    // Validate optional vars (won't throw if missing)
    const optional = optionalEnvSchema.parse(normalizedEnv);

    envLogger.info("Environment variables validated successfully");

    return {
      ...required,
      ...optional,
    };
  } catch (error) {
    const zodError = error as z.ZodError<unknown>;
    
    envLogger.error("Environment validation failed:", zodError);

    const missingVars: string[] = [];
    zodError.issues.forEach((err: z.ZodIssue) => {
      const field = err.path.join(".");
      missingVars.push(`  - ${field}: ${err.message}`);
    });

    const errorMessage = `Missing or invalid required environment variables:\n${missingVars.join("\n")}\n\nPlease check your .env.local file or environment configuration.`;
    
    throw new Error(errorMessage);
  }
}

/**
 * Validates environment variables and returns a boolean.
 * Useful for non-critical validation that shouldn't crash the app.
 * 
 * @returns true if validation passes, false otherwise
 */
export function validateEnvSafe(): boolean {
  try {
    validateEnv();
    return true;
  } catch {
    return false;
  }
}

