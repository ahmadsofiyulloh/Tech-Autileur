import type { JsonRecord, JsonValue } from "@/lib/intake/validation";

export const INTAKE_DEVICE_BUCKETS = ["mobile_pwa", "mobile_browser", "desktop_browser", "unknown"] as const;
export const INTAKE_ANALYSIS_PATHS = ["saved_capture", "live_upload", "unknown"] as const;
export const INTAKE_EVIDENCE_ORIGINS = ["saved_drive", "fresh_upload", "mixed", "unknown"] as const;
export const INTAKE_BROWSER_FAMILIES = ["chrome", "edge", "firefox", "safari", "android_webview", "other", "unknown"] as const;
export const INTAKE_VIEWPORT_BUCKETS = ["narrow", "medium", "wide", "unknown"] as const;
export const INTAKE_NETWORK_EFFECTIVE_TYPES = ["slow-2g", "2g", "3g", "4g", "5g", "unknown"] as const;
export const INTAKE_FAILURE_KINDS = [
  "MODEL_RESPONSE_SHAPE",
  "INPUT_LIMIT",
  "TRANSIENT_GEMINI",
  "AUTH_OR_SUPABASE",
  "DRIVE_UPLOAD",
  "UNKNOWN",
] as const;

export type IntakeDeviceBucket = (typeof INTAKE_DEVICE_BUCKETS)[number];
export type IntakeTelemetryBucket = IntakeDeviceBucket;
export type IntakeAnalysisPath = (typeof INTAKE_ANALYSIS_PATHS)[number];
export type IntakeEvidenceOrigin = (typeof INTAKE_EVIDENCE_ORIGINS)[number];
export type IntakeBrowserFamily = (typeof INTAKE_BROWSER_FAMILIES)[number];
export type IntakeViewportBucket = (typeof INTAKE_VIEWPORT_BUCKETS)[number];
export type IntakeNetworkEffectiveType = (typeof INTAKE_NETWORK_EFFECTIVE_TYPES)[number];
export type IntakeFailureKind = (typeof INTAKE_FAILURE_KINDS)[number];

export type IntakeClientContextInput = {
  is_mobile?: boolean | null;
  display_mode?: string | null;
  browser_family?: string | null;
  viewport_width?: number | null;
  viewport_height?: number | null;
  network_effective_type?: string | null;
  save_data?: boolean | null;
};

export type IntakeClientContext = {
  is_mobile: boolean | null;
  display_mode: "browser" | "fullscreen" | "minimal-ui" | "standalone" | "unknown";
  browser_family: IntakeBrowserFamily;
  viewport_bucket: IntakeViewportBucket;
  network_effective_type: IntakeNetworkEffectiveType;
  save_data: boolean | null;
};

export type IntakeTelemetryPayload = JsonRecord & {
  telemetry_version: number;
  client_context: IntakeClientContext;
  device_bucket: IntakeDeviceBucket;
  analysis_path: IntakeAnalysisPath;
  evidence_origin: IntakeEvidenceOrigin;
  fresh_evidence_count: number;
  saved_evidence_count: number;
  client_upload_bytes: number;
  total_upload_bytes: number;
  max_file_bytes: number;
  request_started_at: string | null;
  request_finished_at: string | null;
  request_duration_ms: number | null;
  repair_attempted: boolean;
  repair_success: boolean;
  failure_kind: IntakeFailureKind | null;
  upstream_status: number | null;
  upstream_retry_after_seconds: number | null;
  response_text_excerpt: string | null;
  repair_response_text_excerpt: string | null;
  model_name: string | null;
};

export type IntakeTelemetryTaskRow = {
  status: string;
  input_json: JsonValue | null;
  output_json: JsonValue | null;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  task_type?: string | null;
};

export type IntakeTelemetryBucketSummary = {
  bucket: IntakeDeviceBucket;
  total: number;
  success: number;
  failure: number;
  repair_attempted: number;
  repair_success: number;
  shape_failures: number;
  client_upload_bytes: number[];
  total_upload_bytes: number[];
  max_file_bytes: number[];
  request_duration_ms: number[];
};

export type IntakeTelemetrySummary = {
  total: number;
  success: number;
  failure: number;
  repair_attempted: number;
  repair_success: number;
  shape_failures: number;
  failure_kinds: Record<IntakeFailureKind, number>;
  buckets: Record<IntakeDeviceBucket, IntakeTelemetryBucketSummary>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function normalizeDisplayMode(value: string | null | undefined): IntakeClientContext["display_mode"] {
  const trimmed = readText(value).toLowerCase();

  if (trimmed === "browser" || trimmed === "fullscreen" || trimmed === "minimal-ui" || trimmed === "standalone") {
    return trimmed;
  }

  return "unknown";
}

function normalizeBrowserFamily(value: string | null | undefined): IntakeBrowserFamily {
  const trimmed = readText(value).toLowerCase();

  if (!trimmed) {
    return "unknown";
  }

  if (trimmed.includes("android_webview") || trimmed.includes("webview") || trimmed === "wv") {
    return "android_webview";
  }

  if (trimmed.includes("edge") || trimmed.includes("edg")) {
    return "edge";
  }

  if (trimmed.includes("firefox") || trimmed.includes("fxios")) {
    return "firefox";
  }

  if (trimmed.includes("safari") && !trimmed.includes("chrome") && !trimmed.includes("crios") && !trimmed.includes("edg")) {
    return "safari";
  }

  if (trimmed.includes("chrome") || trimmed.includes("chromium") || trimmed.includes("crios") || trimmed.includes("chrom")) {
    return "chrome";
  }

  if (trimmed.includes("opera") || trimmed.includes("opr")) {
    return "other";
  }

  return "other";
}

function normalizeViewportBucket(width: number | null | undefined): IntakeViewportBucket {
  if (typeof width !== "number" || !Number.isFinite(width) || width <= 0) {
    return "unknown";
  }

  if (width < 640) {
    return "narrow";
  }

  if (width < 1024) {
    return "medium";
  }

  return "wide";
}

function normalizeNetworkEffectiveType(value: string | null | undefined): IntakeNetworkEffectiveType {
  const normalized = readText(value).toLowerCase();

  if (normalized === "slow-2g" || normalized === "2g" || normalized === "3g" || normalized === "4g" || normalized === "5g") {
    return normalized;
  }

  return "unknown";
}

function normalizeAnalysisPath(value: string | null | undefined): IntakeAnalysisPath {
  const normalized = readText(value).toLowerCase();

  if (normalized === "saved_capture" || normalized === "live_upload") {
    return normalized;
  }

  return "unknown";
}

function normalizeEvidenceOrigin(value: string | null | undefined): IntakeEvidenceOrigin {
  const normalized = readText(value).toLowerCase();

  if (normalized === "saved_drive" || normalized === "fresh_upload" || normalized === "mixed") {
    return normalized;
  }

  return "unknown";
}

function normalizeFailureKind(value: string | null | undefined): IntakeFailureKind | null {
  const normalized = readText(value).toUpperCase();

  if (!normalized) {
    return null;
  }

  if ((INTAKE_FAILURE_KINDS as readonly string[]).includes(normalized)) {
    return normalized as IntakeFailureKind;
  }

  return "UNKNOWN";
}

function clampNonNegativeInteger(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.trunc(value));
}

function readRecord(value: unknown) {
  return isRecord(value) ? value : null;
}

function readTelemetryRecord(value: JsonValue | null | undefined) {
  const record = readRecord(value);

  if (!record) {
    return null;
  }

  if (readRecord(record.telemetry)) {
    return readRecord(record.telemetry);
  }

  if (
    "device_bucket" in record ||
    "client_context" in record ||
    "analysis_path" in record ||
    "evidence_origin" in record ||
    "client_upload_bytes" in record ||
    "total_upload_bytes" in record ||
    "max_file_bytes" in record
  ) {
    return record;
  }

  return null;
}

function readTelemetryDurationMs(value: unknown, startedAt: string | null, finishedAt: string | null) {
  const direct = readNumber(value);

  if (direct !== null) {
    return clampNonNegativeInteger(direct);
  }

  const start = startedAt ? new Date(startedAt).getTime() : Number.NaN;
  const finish = finishedAt ? new Date(finishedAt).getTime() : Number.NaN;

  if (Number.isFinite(start) && Number.isFinite(finish) && finish >= start) {
    return Math.max(0, Math.trunc(finish - start));
  }

  return null;
}

function readTelemetryNumber(value: unknown) {
  return clampNonNegativeInteger(readNumber(value));
}

export function normalizeIntakeClientContext(input?: IntakeClientContextInput | null): IntakeClientContext {
  return {
    is_mobile: readBoolean(input?.is_mobile),
    display_mode: normalizeDisplayMode(input?.display_mode),
    browser_family: normalizeBrowserFamily(input?.browser_family),
    viewport_bucket: normalizeViewportBucket(input?.viewport_width),
    network_effective_type: normalizeNetworkEffectiveType(input?.network_effective_type),
    save_data: readBoolean(input?.save_data),
  };
}

export function parseIntakeClientContextJson(value: string | null | undefined): IntakeClientContext | null {
  const trimmed = readText(value);

  if (!trimmed) {
    return null;
  }

  try {
    return normalizeIntakeClientContext(JSON.parse(trimmed) as IntakeClientContextInput);
  } catch {
    return null;
  }
}

export function classifyIntakeDeviceBucket(context?: IntakeClientContext | null): IntakeDeviceBucket {
  if (!context) {
    return "unknown";
  }

  if (context.is_mobile === true) {
    return context.display_mode === "standalone" || context.display_mode === "fullscreen" || context.display_mode === "minimal-ui"
      ? "mobile_pwa"
      : "mobile_browser";
  }

  if (context.is_mobile === false) {
    return "desktop_browser";
  }

  return "unknown";
}

export function classifyIntakeAnalysisPath(value: string | null | undefined): IntakeAnalysisPath {
  return normalizeAnalysisPath(value);
}

export function classifyIntakeEvidenceOrigin(input?: { freshEvidenceCount?: number | null; savedEvidenceCount?: number | null } | null): IntakeEvidenceOrigin {
  const freshCount = readTelemetryNumber(input?.freshEvidenceCount) ?? 0;
  const savedCount = readTelemetryNumber(input?.savedEvidenceCount) ?? 0;

  if (freshCount > 0 && savedCount > 0) {
    return "mixed";
  }

  if (freshCount > 0) {
    return "fresh_upload";
  }

  if (savedCount > 0) {
    return "saved_drive";
  }

  return "unknown";
}

export function classifyIntakeFailureKind(input?: {
  errorMessage?: string | null;
  upstreamStatus?: number | null;
  telemetryFailureKind?: string | null;
  responseText?: string | null;
  repairAttempted?: boolean | null;
  repairResponseText?: string | null;
} | null): IntakeFailureKind {
  const storedKind = normalizeFailureKind(input?.telemetryFailureKind);
  if (storedKind && storedKind !== "UNKNOWN") {
    return storedKind;
  }

  const status = readNumber(input?.upstreamStatus);
  if (status !== null) {
    if (status === 408 || status === 429 || status >= 500) {
      return "TRANSIENT_GEMINI";
    }

    if (status === 401 || status === 403 || status === 404) {
      return "AUTH_OR_SUPABASE";
    }
  }

  const message = readText(input?.errorMessage);
  if (message) {
    const lower = message.toLowerCase();

    if (
      lower.includes("must be a json object") ||
      lower.includes("did not contain valid json") ||
      lower.includes("contains unexpected keys") ||
      lower.includes("did not contain usable intake metadata") ||
      lower.includes("must be a string") ||
      lower.includes("json array") ||
      lower.includes("json string") ||
      lower.includes("single json object") ||
      lower.includes("schema mismatch")
    ) {
      return "MODEL_RESPONSE_SHAPE";
    }

    if (
      lower.includes("too large") ||
      lower.includes("payload too large") ||
      lower.includes("request entity too large") ||
      lower.includes("body size limit") ||
      lower.includes("file too large") ||
      lower.includes("upload terlalu besar")
    ) {
      return "INPUT_LIMIT";
    }

    if (
      lower.includes("authentication required") ||
      lower.includes("unauthorized") ||
      lower.includes("forbidden") ||
      lower.includes("access denied") ||
      lower.includes("permission denied") ||
      lower.includes("row level security") ||
      lower.includes("supabase") ||
      lower.includes("not found for the current user") ||
      lower.includes("current user")
    ) {
      return "AUTH_OR_SUPABASE";
    }

    if (
      lower.includes("google drive") ||
      lower.includes("drive upload") ||
      lower.includes("upload to drive") ||
      lower.includes("folder drive") ||
      lower.includes("drive item") ||
      lower.includes("failed to upload") ||
      lower.includes("upload failed") ||
      lower.includes("could not upload") ||
      (lower.includes("drive") && lower.includes("upload"))
    ) {
      return "DRIVE_UPLOAD";
    }

    if (
      lower.includes("timed out") ||
      lower.includes("temporarily unavailable") ||
      lower.includes("service is temporarily unavailable") ||
      lower.includes("rate limit") ||
      lower.includes("retry after") ||
      lower.includes("response did not include structured text")
    ) {
      return "TRANSIENT_GEMINI";
    }
  }

  if (readText(input?.responseText) && input?.repairAttempted && !readText(input?.repairResponseText)) {
    return "MODEL_RESPONSE_SHAPE";
  }

  return "UNKNOWN";
}

export function isFinalIntakeTaskStatus(status: string) {
  return status === "SUCCESS" || status === "FAILED";
}

function buildEmptyBucketSummary(bucket: IntakeDeviceBucket): IntakeTelemetryBucketSummary {
  return {
    bucket,
    total: 0,
    success: 0,
    failure: 0,
    repair_attempted: 0,
    repair_success: 0,
    shape_failures: 0,
    client_upload_bytes: [],
    total_upload_bytes: [],
    max_file_bytes: [],
    request_duration_ms: [],
  };
}

function readPayloadSource(value: JsonValue | null | undefined) {
  const record = readTelemetryRecord(value);

  if (!record) {
    return null;
  }

  const clientContext = normalizeIntakeClientContext(readRecord(record.client_context) as IntakeClientContextInput | null);
  const analysisPath = classifyIntakeAnalysisPath(record.analysis_path as string | null | undefined);
  const evidenceOrigin = normalizeEvidenceOrigin(record.evidence_origin as string | null | undefined);
  const deviceBucket = normalizeDeviceBucket(record.device_bucket as string | null | undefined) ?? classifyIntakeDeviceBucket(clientContext);
  const telemetryVersion = readTelemetryNumber(record.telemetry_version) ?? 1;
  const freshEvidenceCount = readTelemetryNumber(record.fresh_evidence_count) ?? 0;
  const savedEvidenceCount = readTelemetryNumber(record.saved_evidence_count) ?? 0;
  const clientUploadBytes = readTelemetryNumber(record.client_upload_bytes) ?? 0;
  const totalUploadBytes = readTelemetryNumber(record.total_upload_bytes) ?? 0;
  const maxFileBytes = readTelemetryNumber(record.max_file_bytes) ?? 0;
  const requestStartedAt = readText(record.request_started_at);
  const requestFinishedAt = readText(record.request_finished_at);
  const requestDurationMs = readTelemetryDurationMs(record.request_duration_ms, requestStartedAt || null, requestFinishedAt || null);
  const repairAttempted = readBoolean(record.repair_attempted) ?? false;
  const repairSuccess = readBoolean(record.repair_success) ?? false;
  const failureKind = normalizeFailureKind(record.failure_kind as string | null | undefined);
  const upstreamStatus = readTelemetryNumber(record.upstream_status);
  const upstreamRetryAfterSeconds = readTelemetryNumber(record.upstream_retry_after_seconds);
  const responseTextExcerpt = readText(record.response_text_excerpt);
  const repairResponseTextExcerpt = readText(record.repair_response_text_excerpt);
  const modelName = readText(record.model_name);

  return {
    telemetry_version: telemetryVersion,
    client_context: clientContext,
    device_bucket: deviceBucket,
    analysis_path: analysisPath,
    evidence_origin: evidenceOrigin,
    fresh_evidence_count: freshEvidenceCount,
    saved_evidence_count: savedEvidenceCount,
    client_upload_bytes: clientUploadBytes,
    total_upload_bytes: totalUploadBytes,
    max_file_bytes: maxFileBytes,
    request_started_at: requestStartedAt || null,
    request_finished_at: requestFinishedAt || null,
    request_duration_ms: requestDurationMs,
    repair_attempted: repairAttempted,
    repair_success: repairSuccess,
    failure_kind: failureKind,
    upstream_status: upstreamStatus,
    upstream_retry_after_seconds: upstreamRetryAfterSeconds,
    response_text_excerpt: responseTextExcerpt || null,
    repair_response_text_excerpt: repairResponseTextExcerpt || null,
    model_name: modelName || null,
  } satisfies IntakeTelemetryPayload;
}

function normalizeDeviceBucket(value: string | null | undefined): IntakeDeviceBucket | null {
  const normalized = readText(value).toLowerCase();

  if ((INTAKE_DEVICE_BUCKETS as readonly string[]).includes(normalized)) {
    return normalized as IntakeDeviceBucket;
  }

  return null;
}

export function buildIntakeTelemetryPayload(input: {
  clientContext?: IntakeClientContextInput | null;
  analysisPath?: string | null;
  freshEvidenceCount?: number | null;
  savedEvidenceCount?: number | null;
  clientUploadBytes?: number | null;
  totalUploadBytes?: number | null;
  maxFileBytes?: number | null;
  requestStartedAt?: string | null;
  requestFinishedAt?: string | null;
  requestDurationMs?: number | null;
  repairAttempted?: boolean | null;
  repairSuccess?: boolean | null;
  failureKind?: IntakeFailureKind | null;
  upstreamStatus?: number | null;
  upstreamRetryAfterSeconds?: number | null;
  responseTextExcerpt?: string | null;
  repairResponseTextExcerpt?: string | null;
  modelName?: string | null;
}): IntakeTelemetryPayload {
  const clientContext = normalizeIntakeClientContext(input.clientContext);
  const deviceBucket = classifyIntakeDeviceBucket(clientContext);
  const analysisPath = classifyIntakeAnalysisPath(input.analysisPath ?? null);
  const freshEvidenceCount = clampNonNegativeInteger(input.freshEvidenceCount) ?? 0;
  const savedEvidenceCount = clampNonNegativeInteger(input.savedEvidenceCount) ?? 0;
  const evidenceOrigin = classifyIntakeEvidenceOrigin({ freshEvidenceCount, savedEvidenceCount });
  const clientUploadBytes = clampNonNegativeInteger(input.clientUploadBytes) ?? 0;
  const totalUploadBytes = clampNonNegativeInteger(input.totalUploadBytes) ?? 0;
  const maxFileBytes = clampNonNegativeInteger(input.maxFileBytes) ?? 0;
  const requestStartedAt = readText(input.requestStartedAt);
  const requestFinishedAt = readText(input.requestFinishedAt);
  const requestDurationMs = readTelemetryDurationMs(input.requestDurationMs, requestStartedAt || null, requestFinishedAt || null);
  const repairAttempted = input.repairAttempted === true;
  const repairSuccess = input.repairSuccess === true;
  const failureKind = input.failureKind ?? null;
  const upstreamStatus = clampNonNegativeInteger(input.upstreamStatus) ?? null;
  const upstreamRetryAfterSeconds = clampNonNegativeInteger(input.upstreamRetryAfterSeconds) ?? null;
  const responseTextExcerpt = readText(input.responseTextExcerpt);
  const repairResponseTextExcerpt = readText(input.repairResponseTextExcerpt);
  const modelName = readText(input.modelName);

  return {
    telemetry_version: 1,
    client_context: clientContext,
    device_bucket: deviceBucket,
    analysis_path: analysisPath,
    evidence_origin: evidenceOrigin,
    fresh_evidence_count: freshEvidenceCount,
    saved_evidence_count: savedEvidenceCount,
    client_upload_bytes: clientUploadBytes,
    total_upload_bytes: totalUploadBytes,
    max_file_bytes: maxFileBytes,
    request_started_at: requestStartedAt || null,
    request_finished_at: requestFinishedAt || null,
    request_duration_ms: requestDurationMs,
    repair_attempted: repairAttempted,
    repair_success: repairSuccess,
    failure_kind: failureKind,
    upstream_status: upstreamStatus,
    upstream_retry_after_seconds: upstreamRetryAfterSeconds,
    response_text_excerpt: responseTextExcerpt || null,
    repair_response_text_excerpt: repairResponseTextExcerpt || null,
    model_name: modelName || null,
  };
}

export function readIntakeTelemetryPayloadFromRow(row: IntakeTelemetryTaskRow): IntakeTelemetryPayload | null {
  const payload = readPayloadSource(row.output_json) ?? readPayloadSource(row.input_json);

  if (payload) {
    if (isFinalIntakeTaskStatus(row.status) && row.status === "FAILED" && !payload.failure_kind) {
      return {
        ...payload,
        failure_kind: classifyIntakeFailureKind({
          errorMessage: row.error_message,
          upstreamStatus: payload.upstream_status,
          telemetryFailureKind: payload.failure_kind,
          responseText: payload.response_text_excerpt,
          repairAttempted: payload.repair_attempted,
          repairResponseText: payload.repair_response_text_excerpt,
        }),
      };
    }

    if (isFinalIntakeTaskStatus(row.status) && row.status === "SUCCESS") {
      return {
        ...payload,
        failure_kind: null,
      };
    }

    return payload;
  }

  const fallbackContext = normalizeIntakeClientContext(readRecord(readTelemetryRecord(row.input_json)?.client_context) as IntakeClientContextInput | null);
  const fallbackPayload = buildIntakeTelemetryPayload({
    clientContext: fallbackContext,
    analysisPath: "unknown",
    freshEvidenceCount: 0,
    savedEvidenceCount: 0,
    clientUploadBytes: 0,
    totalUploadBytes: 0,
    maxFileBytes: 0,
    requestStartedAt: row.started_at,
    requestFinishedAt: row.finished_at,
    requestDurationMs: null,
    repairAttempted: false,
    repairSuccess: false,
    failureKind: row.status === "FAILED"
      ? classifyIntakeFailureKind({
          errorMessage: row.error_message,
          upstreamStatus: null,
          telemetryFailureKind: null,
        })
      : null,
  });

  if (!fallbackPayload.client_context && fallbackPayload.device_bucket === "unknown") {
    return null;
  }

  return fallbackPayload;
}

export function summarizeIntakeTelemetryRows(rows: IntakeTelemetryTaskRow[]) {
  const summary: IntakeTelemetrySummary = {
    total: 0,
    success: 0,
    failure: 0,
    repair_attempted: 0,
    repair_success: 0,
    shape_failures: 0,
    failure_kinds: {
      MODEL_RESPONSE_SHAPE: 0,
      INPUT_LIMIT: 0,
      TRANSIENT_GEMINI: 0,
      AUTH_OR_SUPABASE: 0,
      DRIVE_UPLOAD: 0,
      UNKNOWN: 0,
    },
    buckets: {
      mobile_pwa: buildEmptyBucketSummary("mobile_pwa"),
      mobile_browser: buildEmptyBucketSummary("mobile_browser"),
      desktop_browser: buildEmptyBucketSummary("desktop_browser"),
      unknown: buildEmptyBucketSummary("unknown"),
    },
  };

  for (const row of rows) {
    if (!isFinalIntakeTaskStatus(row.status)) {
      continue;
    }

    const payload = readIntakeTelemetryPayloadFromRow(row);
    const bucket = payload?.device_bucket ?? "unknown";
    const bucketSummary = summary.buckets[bucket];
    const isSuccess = row.status === "SUCCESS";
    const failureKind = row.status === "FAILED" ? payload?.failure_kind ?? classifyIntakeFailureKind({ errorMessage: row.error_message, telemetryFailureKind: null, upstreamStatus: payload?.upstream_status }) : null;

    summary.total += 1;
    bucketSummary.total += 1;

    if (isSuccess) {
      summary.success += 1;
      bucketSummary.success += 1;
    } else {
      summary.failure += 1;
      bucketSummary.failure += 1;
      summary.failure_kinds[failureKind ?? "UNKNOWN"] += 1;

      if (failureKind === "MODEL_RESPONSE_SHAPE") {
        summary.shape_failures += 1;
        bucketSummary.shape_failures += 1;
      }
    }

    if (payload?.repair_attempted) {
      summary.repair_attempted += 1;
      bucketSummary.repair_attempted += 1;
    }

    if (payload?.repair_success) {
      summary.repair_success += 1;
      bucketSummary.repair_success += 1;
    }

    if (payload?.client_upload_bytes !== null && payload?.client_upload_bytes !== undefined) {
      bucketSummary.client_upload_bytes.push(payload.client_upload_bytes);
    }

    if (payload?.total_upload_bytes !== null && payload?.total_upload_bytes !== undefined) {
      bucketSummary.total_upload_bytes.push(payload.total_upload_bytes);
    }

    if (payload?.max_file_bytes !== null && payload?.max_file_bytes !== undefined) {
      bucketSummary.max_file_bytes.push(payload.max_file_bytes);
    }

    if (payload?.request_duration_ms !== null && payload?.request_duration_ms !== undefined) {
      bucketSummary.request_duration_ms.push(payload.request_duration_ms);
    }
  }

  return summary;
}
