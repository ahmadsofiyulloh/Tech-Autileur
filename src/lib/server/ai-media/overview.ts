import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AiMediaProviderProjection,
  ExternalApiKeyRow,
  ExternalGenerationTaskRow,
} from "./contracts";
import { projectProviderStatus } from "./projections";

export type AiMediaOverviewSnapshot = {
  provider: AiMediaProviderProjection;
  recentTaskCount: number;
};

const RECENT_TASK_FIELDS =
  "id, user_id, provider, tool_type, status, created_at, archived_at";

const KEY_FIELDS =
  "id, user_id, provider, key_code, label, status, provider_account_label, project_label, model_name, purpose, rpm_limit, rpd_limit, tpm_limit, requests_today, last_used_at, cooldown_until, last_tested_at, last_error_message, metadata_json, created_at, updated_at";

/**
 * Build the AI Media overview snapshot for the authenticated user.
 * Reads only `external_api_keys` and recent rows from `external_generation_tasks`.
 * Never reads `external_api_key_secrets`.
 */
export async function getAiMediaOverviewSnapshot(): Promise<AiMediaOverviewSnapshot | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [keysResult, tasksResult] = await Promise.all([
    supabase
      .from("external_api_keys")
      .select(KEY_FIELDS)
      .eq("user_id", user.id)
      .eq("provider", "magnific"),
    supabase
      .from("external_generation_tasks")
      .select(RECENT_TASK_FIELDS)
      .eq("user_id", user.id)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (keysResult.error) {
    throw new Error(keysResult.error.message);
  }
  if (tasksResult.error) {
    throw new Error(tasksResult.error.message);
  }

  const keys = (keysResult.data ?? []) as ExternalApiKeyRow[];
  const tasks = (tasksResult.data ?? []) as Pick<
    ExternalGenerationTaskRow,
    "id" | "user_id" | "provider" | "tool_type" | "status" | "created_at" | "archived_at"
  >[];

  // Pad task rows with the unused fields the projection helper expects (it only reads .status).
  const tasksForProjection = tasks.map((t) => ({
    ...t,
    model_name: null,
    selected_key_id: null,
    last_attempted_key_id: null,
    fallback_attempts: 0,
    max_attempts: 3,
    provider_task_id: null,
    source_image_drive_item_ref_id: null,
    source_motion_drive_item_ref_id: null,
    output_drive_item_ref_id: null,
    input_json: {},
    output_json: null,
    log_json: [],
    error_code: null,
    error_message: null,
    http_status: null,
    retry_after_seconds: null,
    priority: 100,
    scheduled_at: t.created_at,
    started_at: null,
    finished_at: null,
    cancelled_at: null,
    updated_at: t.created_at,
  })) as ExternalGenerationTaskRow[];

  return {
    provider: projectProviderStatus(keys, tasksForProjection),
    recentTaskCount: tasks.length,
  };
}
