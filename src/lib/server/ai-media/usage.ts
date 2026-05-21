import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AiMediaKeyMetadataProjection,
  AiMediaUsageSnapshot,
  ExternalApiKeyRow,
  ExternalGenerationTaskRow,
} from "./contracts";
import { projectKeyMetadata, projectUsageSnapshot } from "./projections";

const KEY_FIELDS =
  "id, user_id, provider, key_code, label, status, provider_account_label, project_label, model_name, purpose, rpm_limit, rpd_limit, tpm_limit, requests_today, last_used_at, cooldown_until, last_tested_at, last_error_message, metadata_json, created_at, updated_at";

const USAGE_TASK_FIELDS =
  "id, user_id, provider, tool_type, model_name, status, selected_key_id, last_attempted_key_id, fallback_attempts, max_attempts, provider_task_id, source_image_drive_item_ref_id, source_motion_drive_item_ref_id, output_drive_item_ref_id, input_json, output_json, log_json, error_code, error_message, http_status, retry_after_seconds, priority, scheduled_at, started_at, finished_at, cancelled_at, archived_at, created_at, updated_at";

export type AiMediaUsageReadModel = {
  snapshot: AiMediaUsageSnapshot;
  keys: AiMediaKeyMetadataProjection[];
};

/**
 * Build the AI Media usage read model for the authenticated owner.
 * Combines key metadata projections and a derived usage snapshot.
 * Reads only `external_api_keys` and `external_generation_tasks`.
 */
export async function getAiMediaUsageReadModel(): Promise<AiMediaUsageReadModel | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Today boundary in Asia/Jakarta (UTC+7) as documented fallback
  const dayWindowStart = new Date();
  dayWindowStart.setUTCHours(0, 0, 0, 0);
  // Pull a wider window than today so client-side day boundaries can still apply.
  const taskWindowStart = new Date(Date.now() - 36 * 60 * 60 * 1000);

  const [keysResult, tasksResult] = await Promise.all([
    supabase
      .from("external_api_keys")
      .select(KEY_FIELDS)
      .eq("user_id", user.id)
      .eq("provider", "magnific")
      .order("updated_at", { ascending: false }),
    supabase
      .from("external_generation_tasks")
      .select(USAGE_TASK_FIELDS)
      .eq("user_id", user.id)
      .gte("created_at", taskWindowStart.toISOString())
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  if (keysResult.error) {
    throw new Error(keysResult.error.message);
  }
  if (tasksResult.error) {
    throw new Error(tasksResult.error.message);
  }

  const keys = (keysResult.data ?? []) as ExternalApiKeyRow[];
  const tasks = (tasksResult.data ?? []) as ExternalGenerationTaskRow[];

  const keyLabelMap = new Map<string, string>();
  for (const k of keys) keyLabelMap.set(k.id, k.label);

  const snapshot = projectUsageSnapshot(tasks, keys, keyLabelMap);
  const keyProjections = keys.map(projectKeyMetadata);

  return { snapshot, keys: keyProjections };
}
