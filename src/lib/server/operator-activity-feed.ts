import "server-only";

import {
  normalizeOperatorActivityFeedLimit,
  type ActivityFeedItem,
  type ActivityFeedTone,
} from "@/lib/operator-activity-feed-contract";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type AiTaskActivityRecord = {
  id: string;
  task_type: string;
  status: string;
  error_message: string | null;
  retry_count: number | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

type PromptPackActivityRecord = {
  id: string;
  prompt_code: string;
  version: number;
  status: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type BulkImportLogActivityRecord = {
  id: string;
  job_id: string;
  level: string;
  title: string;
  message: string;
  created_at: string;
};

type GeminiUsageActivityRecord = {
  id: string;
  project_label: string | null;
  model_name: string;
  role: string;
  task_type: string;
  request_started_at: string;
  request_finished_at: string | null;
  status: string;
  http_status: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type GeminiKeyStatusRecord = {
  id: string;
  label: string;
  project_label: string | null;
  model_name: string;
  role: string;
  status: string;
  last_used_at: string | null;
  cooldown_until: string | null;
  created_at: string;
  updated_at: string;
};

type GoogleDriveConnectionStatusRecord = {
  id: string;
  google_account_email: string | null;
  google_account_label: string | null;
  status: string;
  last_connected_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

const AI_TASK_TYPE_LABELS: Record<string, string> = {
  VISION_ANALYSIS: "Analisis metadata",
  I2I_PROMPT: "Prompt I2I",
  I2V_PROMPT: "Prompt I2V",
  CONSISTENCY_CHECK: "Cek konsistensi",
  PROMPT_REPAIR: "Perbaikan prompt",
  FALLBACK: "Fallback AI",
  PROMPT_PACK_GENERATION: "Paket prompt",
};

const AI_TASK_STATUS_LABELS: Record<string, string> = {
  QUEUED: "masuk antrean",
  RUNNING: "berjalan",
  SUCCESS: "selesai",
  FAILED: "gagal",
  RETRYING: "dicoba ulang",
  WAITING_FOR_KEY: "menunggu key",
  CANCELLED: "dibatalkan",
};

const GEMINI_KEY_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "aktif",
  COOLDOWN: "cooldown",
  RATE_LIMITED: "rate limit",
  DISABLED: "nonaktif",
  ERROR: "bermasalah",
};

function queryErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
    ? error.message
    : "Activity feed query failed.";
}

function queryErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : "";
}

function isMissingRelationError(error: unknown, relationName: string) {
  const message = queryErrorMessage(error).toLowerCase();

  return (
    queryErrorCode(error) === "42P01" ||
    queryErrorCode(error) === "PGRST205" ||
    (message.includes(relationName) && (message.includes("does not exist") || message.includes("schema cache")))
  );
}

async function requireActivityUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Authentication required.");
  }

  return { supabase, userId: user.id };
}

function cleanText(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim().replace(/\s+/g, " ") : null;
}

function redactSensitiveText(value: string) {
  return value
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[redacted]")
    .replace(/sk-[0-9A-Za-z_-]{20,}/g, "[redacted]")
    .replace(/(Bearer\s+)[0-9A-Za-z._-]+/gi, "$1[redacted]");
}

function activityMessage(value: string | null | undefined, fallback: string) {
  const normalized = redactSensitiveText(cleanText(value) ?? fallback);

  if (normalized.length <= 180) {
    return normalized;
  }

  return `${normalized.slice(0, 177).trimEnd()}...`;
}

function labelFromEnum(value: string | null | undefined) {
  return cleanText(value)?.replaceAll("_", " ").toLowerCase() ?? "-";
}

function occurrenceTimestamp(...values: Array<string | null | undefined>) {
  return values.find((value) => cleanText(value)) ?? new Date(0).toISOString();
}

function compareActivityItems(left: ActivityFeedItem, right: ActivityFeedItem) {
  return new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime();
}

function toneForAiTaskStatus(status: string): ActivityFeedTone {
  if (status === "FAILED") {
    return "error";
  }

  if (status === "SUCCESS") {
    return "success";
  }

  if (status === "RETRYING" || status === "WAITING_FOR_KEY" || status === "CANCELLED") {
    return "warning";
  }

  return "info";
}

function toneForBulkImportLog(level: string): ActivityFeedTone {
  if (level === "ERROR") {
    return "error";
  }

  if (level === "WARNING") {
    return "warning";
  }

  if (level === "SUCCESS") {
    return "success";
  }

  return "info";
}

function toneForGeminiUsageStatus(status: string): ActivityFeedTone {
  if (status === "FAILED") {
    return "error";
  }

  if (status === "RATE_LIMITED") {
    return "warning";
  }

  if (status === "SUCCESS") {
    return "success";
  }

  return "info";
}

function toneForGeminiKeyStatus(status: string): ActivityFeedTone {
  if (status === "ERROR") {
    return "error";
  }

  if (status === "COOLDOWN" || status === "RATE_LIMITED" || status === "DISABLED") {
    return "warning";
  }

  return "success";
}

function toneForDriveStatus(status: string): ActivityFeedTone {
  if (status === "ERROR") {
    return "error";
  }

  if (status === "DISCONNECTED") {
    return "warning";
  }

  return "success";
}

function hrefForAiTask(taskType: string) {
  if (taskType === "PROMPT_PACK_GENERATION" || taskType === "I2I_PROMPT" || taskType === "I2V_PROMPT") {
    return "/prompts";
  }

  if (taskType === "VISION_ANALYSIS") {
    return "/products/new";
  }

  return "/dashboard";
}

function mapAiTaskActivity(row: AiTaskActivityRecord): ActivityFeedItem {
  const typeLabel = AI_TASK_TYPE_LABELS[row.task_type] ?? labelFromEnum(row.task_type);
  const statusLabel = AI_TASK_STATUS_LABELS[row.status] ?? labelFromEnum(row.status);
  const retryCopy = row.retry_count && row.retry_count > 0 ? ` Percobaan ${row.retry_count}.` : "";

  return {
    id: `ai-task:${row.id}`,
    occurredAt: occurrenceTimestamp(row.finished_at, row.updated_at, row.started_at, row.created_at),
    tone: toneForAiTaskStatus(row.status),
    category: "AI Task",
    title: `${typeLabel} ${statusLabel}`,
    message: activityMessage(row.error_message, `Status ${statusLabel}.${retryCopy}`),
    href: hrefForAiTask(row.task_type),
  };
}

function mapPromptPackActivity(row: PromptPackActivityRecord): ActivityFeedItem | null {
  if (row.status !== "ERROR" && !cleanText(row.error_message)) {
    return null;
  }

  return {
    id: `prompt-pack:${row.id}`,
    occurredAt: occurrenceTimestamp(row.updated_at, row.created_at),
    tone: row.status === "ERROR" ? "error" : "warning",
    category: "Prompt",
    title: "Paket prompt gagal",
    message: activityMessage(row.error_message, `${row.prompt_code} v${row.version} membutuhkan perhatian.`),
    href: `/prompts?detail=${encodeURIComponent(row.id)}`,
  };
}

function mapBulkImportLogActivity(row: BulkImportLogActivityRecord): ActivityFeedItem {
  return {
    id: `bulk-log:${row.id}`,
    occurredAt: occurrenceTimestamp(row.created_at),
    tone: toneForBulkImportLog(row.level),
    category: "Bulk Import",
    title: activityMessage(row.title, "Bulk import"),
    message: activityMessage(row.message, "Log bulk import diperbarui."),
    href: "/products/new",
  };
}

function geminiUsageTitle(status: string) {
  if (status === "FAILED") {
    return "Gemini request gagal";
  }

  if (status === "RATE_LIMITED") {
    return "Gemini rate limit";
  }

  if (status === "SUCCESS") {
    return "Gemini request selesai";
  }

  return "Gemini request dimulai";
}

function mapGeminiUsageActivity(row: GeminiUsageActivityRecord): ActivityFeedItem {
  const modelLabel = cleanText(row.project_label) ? `${row.project_label} / ${row.model_name}` : row.model_name;
  const statusCopy = row.http_status ? `${row.status} ${row.http_status}` : row.status;

  return {
    id: `gemini-usage:${row.id}`,
    occurredAt: occurrenceTimestamp(row.request_finished_at, row.updated_at, row.request_started_at, row.created_at),
    tone: toneForGeminiUsageStatus(row.status),
    category: "Gemini",
    title: geminiUsageTitle(row.status),
    message: activityMessage(row.error_message, `${labelFromEnum(row.task_type)} - ${modelLabel} - ${statusCopy}`),
    href: "/settings/gemini",
  };
}

function mapGeminiKeyStatus(row: GeminiKeyStatusRecord): ActivityFeedItem {
  const statusLabel = GEMINI_KEY_STATUS_LABELS[row.status] ?? labelFromEnum(row.status);
  const modelLabel = cleanText(row.project_label) ? `${row.project_label} / ${row.model_name}` : row.model_name;
  const cooldownCopy = row.cooldown_until && (row.status === "COOLDOWN" || row.status === "RATE_LIMITED") ? ` Cooldown sampai ${row.cooldown_until}.` : "";

  return {
    id: `gemini-key:${row.id}`,
    occurredAt: occurrenceTimestamp(row.updated_at, row.last_used_at, row.created_at),
    tone: toneForGeminiKeyStatus(row.status),
    category: "Gemini",
    title: `Gemini key ${statusLabel}`,
    message: activityMessage(`${row.label} - ${modelLabel}.${cooldownCopy}`, "Status Gemini key tersedia."),
    href: "/settings/gemini",
  };
}

function mapGoogleDriveConnectionStatus(row: GoogleDriveConnectionStatusRecord): ActivityFeedItem {
  const accountLabel = cleanText(row.google_account_label) ?? cleanText(row.google_account_email) ?? "Google Drive";
  const title =
    row.status === "ERROR"
      ? "Google Drive bermasalah"
      : row.status === "DISCONNECTED"
        ? "Google Drive terputus"
        : "Google Drive terhubung";

  return {
    id: `drive-connection:${row.id}`,
    occurredAt: occurrenceTimestamp(row.updated_at, row.last_connected_at, row.created_at),
    tone: toneForDriveStatus(row.status),
    category: "Drive",
    title,
    message: activityMessage(row.last_error, accountLabel),
    href: "/settings",
  };
}

async function listAiTaskActivities(input: { limit: number; supabase: SupabaseServerClient; userId: string }) {
  const { data, error } = await input.supabase
    .from("ai_tasks")
    .select("id, task_type, status, error_message, retry_count, started_at, finished_at, created_at, updated_at")
    .eq("user_id", input.userId)
    .order("updated_at", { ascending: false })
    .limit(input.limit);

  if (error) {
    if (isMissingRelationError(error, "google_drive_connections")) {
      return [];
    }

    throw new Error(queryErrorMessage(error));
  }

  return ((data ?? []) as AiTaskActivityRecord[]).map(mapAiTaskActivity);
}

async function listPromptPackActivities(input: { limit: number; supabase: SupabaseServerClient; userId: string }) {
  const { data, error } = await input.supabase
    .from("prompt_packs")
    .select("id, prompt_code, version, status, error_message, created_at, updated_at")
    .eq("user_id", input.userId)
    .order("updated_at", { ascending: false })
    .limit(input.limit);

  if (error) {
    throw new Error(queryErrorMessage(error));
  }

  return ((data ?? []) as PromptPackActivityRecord[]).map(mapPromptPackActivity).filter((item): item is ActivityFeedItem => Boolean(item));
}

async function listBulkImportLogActivities(input: { limit: number; supabase: SupabaseServerClient; userId: string }) {
  const { data, error } = await input.supabase
    .from("bulk_import_job_logs")
    .select("id, job_id, level, title, message, created_at")
    .eq("user_id", input.userId)
    .order("created_at", { ascending: false })
    .limit(input.limit);

  if (error) {
    throw new Error(queryErrorMessage(error));
  }

  return ((data ?? []) as BulkImportLogActivityRecord[]).map(mapBulkImportLogActivity);
}

async function listGeminiUsageActivities(input: { limit: number; supabase: SupabaseServerClient; userId: string }) {
  const { data, error } = await input.supabase
    .from("gemini_api_usage_events")
    .select(
      "id, project_label, model_name, role, task_type, request_started_at, request_finished_at, status, http_status, error_message, created_at, updated_at",
    )
    .eq("user_id", input.userId)
    .order("request_started_at", { ascending: false })
    .limit(input.limit);

  if (error) {
    throw new Error(queryErrorMessage(error));
  }

  return ((data ?? []) as GeminiUsageActivityRecord[]).map(mapGeminiUsageActivity);
}

async function listGeminiKeyStatusActivities(input: { limit: number; supabase: SupabaseServerClient; userId: string }) {
  const { data, error } = await input.supabase
    .from("gemini_api_keys")
    .select("id, label, project_label, model_name, role, status, last_used_at, cooldown_until, created_at, updated_at")
    .eq("user_id", input.userId)
    .order("updated_at", { ascending: false })
    .limit(Math.min(input.limit, 8));

  if (error) {
    throw new Error(queryErrorMessage(error));
  }

  return ((data ?? []) as GeminiKeyStatusRecord[]).map(mapGeminiKeyStatus);
}

async function listConnectionStatusActivities(input: { supabase: SupabaseServerClient; userId: string }) {
  const { data, error } = await input.supabase
    .from("google_drive_connections")
    .select("id, google_account_email, google_account_label, status, last_connected_at, last_error, created_at, updated_at")
    .eq("user_id", input.userId)
    .maybeSingle();

  if (error) {
    throw new Error(queryErrorMessage(error));
  }

  return data ? [mapGoogleDriveConnectionStatus(data as GoogleDriveConnectionStatusRecord)] : [];
}

export async function getOperatorActivityFeed(input?: { limit?: number }) {
  const limit = normalizeOperatorActivityFeedLimit(input?.limit);
  const sourceLimit = Math.min(Math.max(limit * 2, 10), 50);
  const { supabase, userId } = await requireActivityUser();
  const [aiTasks, promptPacks, bulkImportLogs, geminiUsage, geminiKeys, connectionStatus] = await Promise.all([
    listAiTaskActivities({ limit: sourceLimit, supabase, userId }),
    listPromptPackActivities({ limit: sourceLimit, supabase, userId }),
    listBulkImportLogActivities({ limit: sourceLimit, supabase, userId }),
    listGeminiUsageActivities({ limit: sourceLimit, supabase, userId }),
    listGeminiKeyStatusActivities({ limit: sourceLimit, supabase, userId }),
    listConnectionStatusActivities({ supabase, userId }),
  ]);

  return [...aiTasks, ...promptPacks, ...bulkImportLogs, ...geminiUsage, ...geminiKeys, ...connectionStatus]
    .sort(compareActivityItems)
    .slice(0, limit);
}
