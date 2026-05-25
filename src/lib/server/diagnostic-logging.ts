import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";

export type DiagnosticContext = "prompt_generation" | "share_generation" | "key_routing" | "recovery";
export type DiagnosticLevel = "debug" | "info" | "warn" | "error";

export async function logDiagnostic({
  userId,
  context,
  level = "info",
  message,
  metadata = {},
}: {
  userId: string;
  context: DiagnosticContext;
  level?: DiagnosticLevel;
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = createSupabaseServiceRoleClient();
    await supabase.from("diagnostic_logs").insert({
      user_id: userId,
      context,
      level,
      message,
      metadata,
    });
  } catch (error) {
    // Silent fail — logging must never block workflow
    // Optionally log to console in development
    if (process.env.NODE_ENV === "development") {
      console.warn("[diagnostic-logging] Failed to log:", error);
    }
  }
}
