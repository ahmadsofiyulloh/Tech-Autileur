import { createClient } from "@supabase/supabase-js";

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`[ENV_BLOCKER] Missing required environment variable: ${name}`);
  }

  return value;
}

export function createSmokeServiceClient() {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function getSmokeBaseUrl() {
  return process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
}

export function getSmokeEmail() {
  return process.env.E2E_SMOKE_EMAIL ?? "codex.smoke@example.com";
}

export function getSmokePassword() {
  return process.env.E2E_SMOKE_PASSWORD ?? "SmokePass!12345";
}

