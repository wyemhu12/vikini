import { defineConfig, devices } from "@playwright/test";

const E2E_PORT = 3100;
const E2E_BASE_URL = `http://127.0.0.1:${E2E_PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "html",
  grepInvert: /@online/,
  use: {
    baseURL: E2E_BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: process.env.CI ? "npm run build && npm run start" : "npm run dev",
    url: E2E_BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      PORT: String(E2E_PORT),
      NEXTAUTH_URL: E2E_BASE_URL,
      AUTH_URL: E2E_BASE_URL,
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_SERVICE_ROLE_KEY: "dummy-e2e-service-key",
      UPSTASH_REDIS_REST_URL: "http://127.0.0.1:8079",
      UPSTASH_REDIS_REST_TOKEN: "dummy-redis-token",
      AUTH_SECRET: "dummy-auth-secret-for-e2e-testing-32-chars-minimum",
      NEXTAUTH_SECRET: "dummy-auth-secret-for-e2e-testing-32-chars-minimum",
      AUTH_TRUST_HOST: "true",
      GOOGLE_CLIENT_ID: "dummy-google-client-id.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "dummy-google-client-secret",
      GEMINI_API_KEY: "dummy-gemini-key-for-e2e",
      DATA_ENCRYPTION_KEY: "dummy-encryption-key-32-chars-long",
      OPENROUTER_API_KEY: "",
      ANTHROPIC_API_KEY: "",
      DEEPSEEK_API_KEY: "",
      WHITELIST_EMAILS: "",
      ATTACHMENTS_CRON_SECRET: "dummy-cron-secret",
    },
  },
});
