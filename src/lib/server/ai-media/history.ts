import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AiMediaDriveOutputRefProjection,
  AiMediaHistoryListProjection,
  AiMediaHistoryQueryInput,
  ExternalApiKeyRow,
  ExternalGenerationTaskRow,
  ExternalGenerationToolType,
  ExternalTaskStatus,
} from "./contracts";
import { projectHistoryList } from "./projections";

const TASK_FIELDS =
  "id, user_id, provider, tool_type, model_name, status, selected_key_id, last_attempted_key_id, fallback_attempts, max_attempts, provider_task_id, source_image_drive_item_ref_id, source_motion_drive_item_ref_id, output_drive_item_ref_id, input_json, output_json, log_json, error_code, error_message, http_status, retry_after_seconds, priority, scheduled_at, started_at, finished_at, cancelled_at, archived_at, created_at, updated_at";

function clampPage(value: number | undefined): number {
  return Math.max(1, Math.floor(value ?? 1));
}

function clampPageSize(value: number | undefined): number {
  return Math.min(Math.max(Math.floor(value ?? 20), 1), 100);
}

/**
 * Read paginated history rows for the authenticated owner.
 * Returns a safe history projection — no raw secrets, no provider blobs.
 */
export async function listAiMediaHistory(
  input: AiMediaHistoryQueryInput,
): Promise<AiMediaHistoryListProjection | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const page = clampPage(input.page);
  const pageSize = clampPageSize(input.pageSize);
  const offset = (page - 1) * pageSize;

  let countQuery = supabase
    .from("external_generation_tasks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("archived_at", null);

  let listQuery = supabase
    .from("external_generation_tasks")
    .select(TASK_FIELDS)
    .eq("user_id", user.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (input.toolType) {
    countQuery = countQuery.eq("tool_type", input.toolType as ExternalGenerationToolType);
    listQuery = listQuery.eq("tool_type", input.toolType as ExternalGenerationToolType);
  }

  if (input.status) {
    countQuery = countQuery.eq("status", input.status as ExternalTaskStatus);
    listQuery = listQuery.eq("status", input.status as ExternalTaskStatus);
  }

  const [countResult, listResult] = await Promise.all([countQuery, listQuery]);

  if (countResult.error) {
    throw new Error(countResult.error.message);
  }
  if (listResult.error) {
    throw new Error(listResult.error.message);
  }

  const rows = (listResult.data ?? []) as ExternalGenerationTaskRow[];
  const totalCount = countResult.count ?? 0;

  // Build key label map for selected_key_id resolution
  const keyIds = Array.from(
    new Set(
      rows
        .map((r) => r.selected_key_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  );

  const keyLabelMap = new Map<string, string>();
  if (keyIds.length) {
    const { data: keyRows } = await supabase
      .from("external_api_keys")
      .select("id, label")
      .eq("user_id", user.id)
      .in("id", keyIds);

    for (const row of (keyRows ?? []) as Pick<ExternalApiKeyRow, "id" | "label">[]) {
      keyLabelMap.set(row.id, row.label);
    }
  }

  // Build a safe Drive output ref map for tasks that already have a saved output.
  const driveItemIds = Array.from(
    new Set(
      rows
        .map((r) => r.output_drive_item_ref_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  );

  const driveOutputMap = new Map<string, AiMediaDriveOutputRefProjection>();
  if (driveItemIds.length) {
    const { data: driveRows } = await supabase
      .from("drive_items")
      .select("id, drive_item_id, name, drive_url, mime_type, size_bytes")
      .eq("user_id", user.id)
      .in("id", driveItemIds);

    for (const item of (driveRows ?? []) as Array<{
      id: string;
      drive_item_id: string | null;
      name: string;
      drive_url: string;
      mime_type: string | null;
      size_bytes: number | null;
    }>) {
      driveOutputMap.set(item.id, {
        driveItemId: item.id,
        driveFileId: item.drive_item_id,
        name: item.name,
        driveUrl: item.drive_url,
        mimeType: item.mime_type,
        sizeBytes: item.size_bytes,
      });
    }
  }

  return projectHistoryList(rows, keyLabelMap, { page, pageSize }, totalCount, driveOutputMap);
}
