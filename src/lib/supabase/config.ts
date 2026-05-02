type SupabaseEnvName =
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  | "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  | "NEXT_PUBLIC_APP_URL";

function readEnv(name: SupabaseEnvName): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getSupabaseConfig() {
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!publishableKey) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

  return {
    url: readEnv("NEXT_PUBLIC_SUPABASE_URL"),
    publishableKey,
  };
}

export function getAppUrl() {
  return readEnv("NEXT_PUBLIC_APP_URL");
}
