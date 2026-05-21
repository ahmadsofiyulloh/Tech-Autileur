import "server-only";

import type {
  AiMediaCreateTaskInput,
  AiMediaDriveOutputRefProjection,
  AiMediaGenerationTaskProjection,
  AiMediaHistoryListProjection,
  AiMediaHistoryQueryInput,
  AiMediaKeyMetadataProjection,
  AiMediaProviderProjection,
  AiMediaRecentErrorProjection,
  AiMediaTaskLogEntry,
  AiMediaUsageSnapshot,
  ExternalApiKeyRow,
  ExternalGenerationTaskRow,
  ExternalTaskStatus,
} from "./contracts";

// =============================================================================
// Helpers
// =============================================================================

const ACTIVE_TASK_STATUSES = new Set<ExternalTaskStatus>([
  "QUEUED",
  "RUNNING",
  "RETRYING",
  "WAITING_FOR_KEY",
]);

const RETRYABLE_ERROR_CODES = new Set([
  "RATE_LIMITED",
  "TIMEOUT",
  "SERVER_ERROR",
  "COOLDOWN",
  "NETWORK_ERROR",
]);

function safeTimestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? value : null;
}

function clampPage(value: number | undefined): number {
  return Math.max(1, Math.floor(value ?? 1));
}

function clampPageSize(value: number | undefined): number {
  return Math.min(Math.max(Math.floor(value ?? 20), 1), 100);
}

/**
 * Parse log_json from a task row into safe display entries.
 * Drops any entry that is not a plain object with a message string.
 * Never surfaces raw API keys, encrypted values, or provider blobs.
 */
function parseLogEntries(logJson: unknown): AiMediaTaskLogEntry[] {
  if (!Array.isArray(logJson)) return [];

  const entries: AiMediaTaskLogEntry[] = [];

  for (const item of logJson) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;

    const entry = item as Record<string, unknown>;
    const message = typeof entry.message === "string" ? entry.message.trim() : null;
    if (!message) continue;

    const rawLevel = typeof entry.level === "string" ? entry.level.toLowerCase() : "info";
    const level = (["info", "warn", "error", "success"] as const).includes(
      rawLevel as "info" | "warn" | "error" | "success",
    )
      ? (rawLevel as AiMediaTaskLogEntry["level"])
      : "info";

    const time =
      typeof entry.time === "string"
        ? entry.time
        : typeof entry.timestamp === "string"
          ? new Date(entry.timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
          : "";

    entries.push({ time, message, level });
  }

  return entries;
}

function isRetryableTask(task: ExternalGenerationTaskRow): boolean {
  if (!task.error_code) return false;
  return RETRYABLE_ERROR_CODES.has(task.error_code.toUpperCase());
}

// =============================================================================
// Key Projections
// =============================================================================

/**
 * Project a single external_api_keys row into a client-safe key metadata shape.
 * Never includes raw key material, encrypted values, or internal key_code.
 */
export function projectKeyMetadata(row: ExternalApiKeyRow): AiMediaKeyMetadataProjection {
  return {
    id: row.id,
    label: row.label,
    provider: row.provider,
    status: row.status,
    requestsToday: row.requests_today,
    lastUsedAt: safeTimestamp(row.last_used_at),
    lastTestedAt: safeTimestamp(row.last_tested_at),
    lastErrorMessage: row.last_error_message ?? null,
    cooldownUntil: safeTimestamp(row.cooldown_until),
    fallbackEligible:
      row.status === "ACTIVE" &&
      (!row.cooldown_until || new Date(row.cooldown_until).getTime() <= Date.now()),
  };
}

/**
 * Project a list of key rows into a provider readiness summary.
 * Combines key health and active task count into a single overview shape.
 */
export function projectProviderStatus(
  keys: ExternalApiKeyRow[],
  tasks: ExternalGenerationTaskRow[],
): AiMediaProviderProjection {
  const magnificKeys = keys.filter((k) => k.provider === "magnific");
  const activeKeys = magnificKeys.filter(
    (k) =>
      k.status === "ACTIVE" &&
      (!k.cooldown_until || new Date(k.cooldown_until).getTime() <= Date.now()),
  );
  const rateLimitedKeys = magnificKeys.filter((k) => k.status === "RATE_LIMITED");
  const disabledKeys = magnificKeys.filter((k) => k.status === "DISABLED");
  const errorKeys = magnificKeys.filter((k) => k.status === "ERROR");
  const activeTaskCount = tasks.filter((t) => ACTIVE_TASK_STATUSES.has(t.status)).length;
  const requestsToday = magnificKeys.reduce((sum, k) => sum + k.requests_today, 0);

  let state: AiMediaProviderProjection["state"] = "missing";
  if (activeKeys.length > 0) {
    state = "active";
  } else if (magnificKeys.length > 0) {
    state = "error";
  }

  return {
    provider: "Magnific",
    state,
    activeKeyCount: activeKeys.length,
    rateLimitedKeyCount: rateLimitedKeys.length,
    disabledKeyCount: disabledKeys.length,
    errorKeyCount: errorKeys.length,
    fallbackReady: activeKeys.length >= 2,
    requestsToday,
    activeTaskCount,
  };
}

// =============================================================================
// Task Projections
// =============================================================================

/**
 * Project a single external_generation_tasks row into a client-safe task shape.
 * Resolves selected key label from a key map. Excludes internal retry metadata,
 * raw provider blobs, base64 bytes, and signed URL secrets.
 *
 * Optionally accepts a Drive output ref map (`output_drive_item_ref_id` -> safe
 * Drive metadata) so the projection exposes the saved Drive link/name/mime to
 * the UI without leaking raw bytes or signed URLs.
 */
export function projectGenerationTask(
  row: ExternalGenerationTaskRow,
  keyLabelMap: ReadonlyMap<string, string>,
  driveOutputMap?: ReadonlyMap<string, AiMediaDriveOutputRefProjection>,
): AiMediaGenerationTaskProjection {
  const outputDriveRefId = row.output_drive_item_ref_id ?? null;
  const outputDrive =
    outputDriveRefId && driveOutputMap ? (driveOutputMap.get(outputDriveRefId) ?? null) : null;

  return {
    id: row.id,
    provider: row.provider,
    toolType: row.tool_type,
    modelName: row.model_name ?? null,
    status: row.status,
    providerTaskId: row.provider_task_id ?? null,
    selectedKeyLabel: row.selected_key_id ? (keyLabelMap.get(row.selected_key_id) ?? null) : null,
    fallbackAttempts: row.fallback_attempts,
    sourceImageDriveItemRefId: row.source_image_drive_item_ref_id ?? null,
    sourceMotionDriveItemRefId: row.source_motion_drive_item_ref_id ?? null,
    outputDriveItemRefId: outputDriveRefId,
    outputDrive,
    errorCode: row.error_code ?? null,
    errorMessage: row.error_message ?? null,
    logs: parseLogEntries(row.log_json),
    scheduledAt: row.scheduled_at,
    startedAt: safeTimestamp(row.started_at),
    finishedAt: safeTimestamp(row.finished_at),
    cancelledAt: safeTimestamp(row.cancelled_at),
    createdAt: row.created_at,
  };
}

/**
 * Project a paginated list of task rows into a history list projection.
 */
export function projectHistoryList(
  rows: ExternalGenerationTaskRow[],
  keyLabelMap: ReadonlyMap<string, string>,
  input: AiMediaHistoryQueryInput,
  totalCount: number,
  driveOutputMap?: ReadonlyMap<string, AiMediaDriveOutputRefProjection>,
): AiMediaHistoryListProjection {
  const page = clampPage(input.page);
  const pageSize = clampPageSize(input.pageSize);
  const totalPages = Math.max(Math.ceil(totalCount / pageSize), 1);

  return {
    tasks: rows.map((row) => projectGenerationTask(row, keyLabelMap, driveOutputMap)),
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

// =============================================================================
// Usage Snapshot
// =============================================================================

/**
 * Derive a usage snapshot from task rows and key rows.
 * No cost fields — deferred until reliable provider pricing is confirmed.
 */
export function projectUsageSnapshot(
  tasks: ExternalGenerationTaskRow[],
  keys: ExternalApiKeyRow[],
  keyLabelMap: ReadonlyMap<string, string>,
): AiMediaUsageSnapshot {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartIso = todayStart.toISOString();

  const todayTasks = tasks.filter(
    (t) => t.created_at >= todayStartIso && t.archived_at === null,
  );

  const successCount = todayTasks.filter((t) => t.status === "SUCCESS").length;
  const failedCount = todayTasks.filter((t) => t.status === "FAILED").length;
  const runningCount = todayTasks.filter((t) => t.status === "RUNNING").length;
  const waitingForKeyCount = todayTasks.filter((t) => t.status === "WAITING_FOR_KEY").length;
  const cancelledCount = todayTasks.filter((t) => t.status === "CANCELLED").length;

  const magnificKeys = keys.filter((k) => k.provider === "magnific");
  const activeKeyCount = magnificKeys.filter(
    (k) =>
      k.status === "ACTIVE" &&
      (!k.cooldown_until || new Date(k.cooldown_until).getTime() <= Date.now()),
  ).length;
  const rateLimitedKeyCount = magnificKeys.filter((k) => k.status === "RATE_LIMITED").length;

  const lastUsedKey = magnificKeys
    .filter((k) => k.last_used_at !== null)
    .sort((a, b) => {
      const aTime = a.last_used_at ? new Date(a.last_used_at).getTime() : 0;
      const bTime = b.last_used_at ? new Date(b.last_used_at).getTime() : 0;
      return bTime - aTime;
    })[0];

  const recentErrorTasks = todayTasks
    .filter((t) => t.status === "FAILED" || t.status === "WAITING_FOR_KEY")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const recentErrors: AiMediaRecentErrorProjection[] = recentErrorTasks.map((t) => ({
    id: t.id,
    toolType: t.tool_type,
    keyLabel: t.selected_key_id ? (keyLabelMap.get(t.selected_key_id) ?? null) : null,
    status: t.status === "WAITING_FOR_KEY" ? "RATE_LIMITED" : "FAILED",
    errorMessage: t.error_message ?? null,
    createdAt: t.created_at,
    retryable: isRetryableTask(t),
  }));

  return {
    requestsToday: todayTasks.length,
    successCount,
    failedCount,
    runningCount,
    waitingForKeyCount,
    cancelledCount,
    activeKeyCount,
    rateLimitedKeyCount,
    fallbackReady: activeKeyCount >= 2,
    lastUsedAt: safeTimestamp(lastUsedKey?.last_used_at ?? null),
    recentErrors,
  };
}

// =============================================================================
// Create Task Input Validation
// =============================================================================

const VALID_TOOL_TYPES = new Set(["MOTION_CONTROL", "IMAGE_TO_VIDEO", "UPSCALER"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AiMediaCreateTaskValidationResult =
  | { valid: true; input: AiMediaCreateTaskInput }
  | { valid: false; error: string };

/**
 * Validate a create task input before DB insert.
 * Ensures required fields are present and no unsafe payload fields are passed.
 */
export function validateCreateTaskInput(
  raw: unknown,
): AiMediaCreateTaskValidationResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { valid: false, error: "Input tidak valid." };
  }

  const input = raw as Record<string, unknown>;

  if (input.provider !== "magnific") {
    return { valid: false, error: "Provider tidak didukung." };
  }

  if (typeof input.toolType !== "string" || !VALID_TOOL_TYPES.has(input.toolType)) {
    return { valid: false, error: "Tool type tidak valid." };
  }

  if (
    input.inputPayload === null ||
    typeof input.inputPayload !== "object" ||
    Array.isArray(input.inputPayload)
  ) {
    return { valid: false, error: "Input payload tidak valid." };
  }

  if (typeof input.selectedKeyId === "string" && !UUID_PATTERN.test(input.selectedKeyId)) {
    return { valid: false, error: "Selected key tidak valid." };
  }

  return {
    valid: true,
    input: {
      provider: "magnific",
      toolType: input.toolType as AiMediaCreateTaskInput["toolType"],
      modelName: typeof input.modelName === "string" ? input.modelName : null,
      selectedKeyId: typeof input.selectedKeyId === "string" ? input.selectedKeyId : null,
      sourceImageDriveItemRefId:
        typeof input.sourceImageDriveItemRefId === "string"
          ? input.sourceImageDriveItemRefId
          : null,
      sourceMotionDriveItemRefId:
        typeof input.sourceMotionDriveItemRefId === "string"
          ? input.sourceMotionDriveItemRefId
          : null,
      inputPayload: input.inputPayload as Record<string, unknown>,
      priority: typeof input.priority === "number" ? Math.max(0, Math.floor(input.priority)) : 100,
    },
  };
}
