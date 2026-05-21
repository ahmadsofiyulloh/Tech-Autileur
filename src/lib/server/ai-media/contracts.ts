import "server-only";

// =============================================================================
// AI Media Lab Backend Contracts
// Server-only types for provider keys, generation tasks, history, and usage.
// No raw API keys, encrypted secrets, or large asset bytes in projections.
// =============================================================================

// --- Enum-compatible string unions (match DB enums) ---

export type ExternalGenerationToolType = "MOTION_CONTROL" | "IMAGE_TO_VIDEO" | "UPSCALER";

export type ExternalKeyStatus = "ACTIVE" | "COOLDOWN" | "RATE_LIMITED" | "DISABLED" | "ERROR";

export type ExternalTaskStatus =
  | "QUEUED"
  | "RUNNING"
  | "SUCCESS"
  | "FAILED"
  | "RETRYING"
  | "WAITING_FOR_KEY"
  | "CANCELLED";

// --- Raw DB Row Types (server-only, never exposed to client) ---

export type ExternalApiKeyRow = {
  id: string;
  user_id: string;
  provider: string;
  key_code: string;
  label: string;
  status: ExternalKeyStatus;
  provider_account_label: string | null;
  project_label: string | null;
  model_name: string | null;
  purpose: string | null;
  rpm_limit: number | null;
  rpd_limit: number | null;
  tpm_limit: number | null;
  requests_today: number;
  last_used_at: string | null;
  cooldown_until: string | null;
  last_tested_at: string | null;
  last_error_message: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ExternalGenerationTaskRow = {
  id: string;
  user_id: string;
  provider: string;
  tool_type: ExternalGenerationToolType;
  model_name: string | null;
  status: ExternalTaskStatus;
  selected_key_id: string | null;
  last_attempted_key_id: string | null;
  fallback_attempts: number;
  max_attempts: number;
  provider_task_id: string | null;
  source_image_drive_item_ref_id: string | null;
  source_motion_drive_item_ref_id: string | null;
  output_drive_item_ref_id: string | null;
  input_json: Record<string, unknown>;
  output_json: Record<string, unknown> | null;
  log_json: unknown[];
  error_code: string | null;
  error_message: string | null;
  http_status: number | null;
  retry_after_seconds: number | null;
  priority: number;
  scheduled_at: string;
  started_at: string | null;
  finished_at: string | null;
  cancelled_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

// --- Client-Safe Projection Types ---

/**
 * Provider readiness projection for the AI Media overview page.
 * Shows aggregate key health and task activity without exposing secrets.
 */
export type AiMediaProviderProjection = {
  provider: string;
  state: "active" | "missing" | "error";
  activeKeyCount: number;
  rateLimitedKeyCount: number;
  disabledKeyCount: number;
  errorKeyCount: number;
  fallbackReady: boolean;
  requestsToday: number;
  activeTaskCount: number;
};

/**
 * Key metadata projection for usage/status display.
 * Never includes raw or encrypted key values.
 */
export type AiMediaKeyMetadataProjection = {
  id: string;
  label: string;
  provider: string;
  status: ExternalKeyStatus;
  requestsToday: number;
  lastUsedAt: string | null;
  lastTestedAt: string | null;
  lastErrorMessage: string | null;
  cooldownUntil: string | null;
  fallbackEligible: boolean;
};

/**
 * Generation task projection for history detail and task cards.
 * Excludes internal retry metadata and raw provider blobs.
 */
export type AiMediaGenerationTaskProjection = {
  id: string;
  provider: string;
  toolType: ExternalGenerationToolType;
  modelName: string | null;
  status: ExternalTaskStatus;
  providerTaskId: string | null;
  selectedKeyLabel: string | null;
  fallbackAttempts: number;
  sourceImageDriveItemRefId: string | null;
  sourceMotionDriveItemRefId: string | null;
  outputDriveItemRefId: string | null;
  outputDrive: AiMediaDriveOutputRefProjection | null;
  errorCode: string | null;
  errorMessage: string | null;
  logs: AiMediaTaskLogEntry[];
  scheduledAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
};

/**
 * Minimal safe Drive metadata reference attached to tasks that have a saved output.
 * No raw bytes, no signed URLs, no provider credentials.
 */
export type AiMediaDriveOutputRefProjection = {
  driveItemId: string;
  driveFileId: string | null;
  name: string;
  driveUrl: string;
  mimeType: string | null;
  sizeBytes: number | null;
};

/**
 * Result of saving a task output to Google Drive.
 * Includes an optional preview data URL for image outputs only — never persisted.
 */
export type AiMediaDriveOutputProjection = AiMediaDriveOutputRefProjection & {
  previewDataUrl: string | null;
};

/**
 * Sanitized log entry from task log_json.
 */
export type AiMediaTaskLogEntry = {
  time: string;
  message: string;
  level: "info" | "warn" | "error" | "success";
};

/**
 * Paginated history list projection.
 */
export type AiMediaHistoryListProjection = {
  tasks: AiMediaGenerationTaskProjection[];
  pagination: AiMediaPagination;
};

export type AiMediaPagination = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

/**
 * Usage snapshot for the AI Media usage page.
 * Derived from task and key metadata, no cost until pricing is confirmed.
 */
export type AiMediaUsageSnapshot = {
  requestsToday: number;
  successCount: number;
  failedCount: number;
  runningCount: number;
  waitingForKeyCount: number;
  cancelledCount: number;
  activeKeyCount: number;
  rateLimitedKeyCount: number;
  fallbackReady: boolean;
  lastUsedAt: string | null;
  recentErrors: AiMediaRecentErrorProjection[];
};

export type AiMediaRecentErrorProjection = {
  id: string;
  toolType: ExternalGenerationToolType;
  keyLabel: string | null;
  status: "FAILED" | "RATE_LIMITED";
  errorMessage: string | null;
  createdAt: string;
  retryable: boolean;
};

/**
 * Input contract for creating a new generation task.
 * Validated server-side before DB insert.
 */
export type AiMediaCreateTaskInput = {
  provider: "magnific";
  toolType: ExternalGenerationToolType;
  modelName?: string | null;
  selectedKeyId?: string | null;
  sourceImageDriveItemRefId?: string | null;
  sourceMotionDriveItemRefId?: string | null;
  inputPayload: Record<string, unknown>;
  priority?: number;
};

// --- History Query Input ---

export type AiMediaHistoryQueryInput = {
  page?: number;
  pageSize?: number;
  toolType?: ExternalGenerationToolType | null;
  status?: ExternalTaskStatus | null;
};
