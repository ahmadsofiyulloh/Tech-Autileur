import "server-only";

import type { ExternalGenerationToolType } from "./contracts";

export type MagnificProviderErrorKind =
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "UPSTREAM"
  | "INVALID_PAYLOAD"
  | "MISSING_ASSET"
  | "UNSUPPORTED_MODEL"
  | "FILE_TOO_LARGE"
  | "SAFETY_REJECTION"
  | "INVALID_KEY"
  | "UNKNOWN";

export type MagnificProviderError = {
  kind: MagnificProviderErrorKind;
  message: string;
  httpStatus: number | null;
  retryable: boolean;
  retryAfterSeconds: number | null;
};

export type MagnificSubmitInput = {
  apiKey: string;
  toolType: ExternalGenerationToolType;
  modelName: string | null;
  inputPayload: Record<string, unknown>;
  sourceImageDriveItemRefId: string | null;
  sourceMotionDriveItemRefId: string | null;
};

export type MagnificSubmitResult =
  | { success: true; providerTaskId: string; raw: Record<string, unknown> }
  | { success: false; error: MagnificProviderError };

export type MagnificPollResult =
  | { success: true; done: true; output: Record<string, unknown>; raw: Record<string, unknown> }
  | { success: true; done: false; raw: Record<string, unknown> }
  | { success: false; error: MagnificProviderError };

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_BASE_URL = "https://api.magnific.com";

function getMagnificBaseUrl(): string {
  const value = process.env.MAGNIFIC_API_BASE_URL?.trim();
  return (value || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function getTimeoutMs(): number {
  const value = Number(process.env.MAGNIFIC_API_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_TIMEOUT_MS;
}

function buildUrl(path: string): string {
  return `${getMagnificBaseUrl()}${path}`;
}

function endpointForTool(toolType: ExternalGenerationToolType): string {
  if (toolType === "MOTION_CONTROL") return "/v1/ai/kling-v2.1-pro";
  if (toolType === "IMAGE_TO_VIDEO") return "/v1/ai/kling-v2.1-pro";
  return "/v1/ai/image-upscaler";
}

function authHeaders(apiKey: string): HeadersInit {
  return {
    "x-magnific-api-key": apiKey,
    "Content-Type": "application/json",
  };
}

function parseRetryAfter(headers: Headers): number | null {
  const raw = headers.get("retry-after");
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.floor(seconds);
  const dateMs = new Date(raw).getTime();
  if (!Number.isFinite(dateMs)) return null;
  return Math.max(0, Math.ceil((dateMs - Date.now()) / 1000));
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length ? value.trim() : null;
}

function classifyProviderError(status: number | null, message: string, retryAfterSeconds: number | null): MagnificProviderError {
  const text = message.toLowerCase();

  if (text.includes("ip") && (text.includes("block") || text.includes("banned"))) {
    return { kind: "RATE_LIMIT", message: "IP diblokir oleh Magnific. Coba lagi nanti atau gunakan koneksi berbeda.", httpStatus: status, retryable: true, retryAfterSeconds: retryAfterSeconds ?? 300 };
  }
  if (text.includes("suspicious activity")) {
    return { kind: "RATE_LIMIT", message: "IP diblokir oleh Magnific karena aktivitas mencurigakan. Coba lagi nanti.", httpStatus: status, retryable: true, retryAfterSeconds: retryAfterSeconds ?? 300 };
  }
  if (status === 401 || status === 403 || text.includes("invalid api key") || text.includes("unauthorized")) {
    return { kind: "INVALID_KEY", message, httpStatus: status, retryable: false, retryAfterSeconds };
  }
  if (status === 429 || text.includes("rate limit")) {
    return { kind: "RATE_LIMIT", message, httpStatus: status, retryable: true, retryAfterSeconds };
  }
  if (status === 408 || text.includes("timeout")) {
    return { kind: "TIMEOUT", message, httpStatus: status, retryable: true, retryAfterSeconds };
  }
  if (status !== null && status >= 500) {
    return { kind: "UPSTREAM", message, httpStatus: status, retryable: true, retryAfterSeconds };
  }
  if (text.includes("missing image") || text.includes("missing video") || text.includes("missing asset")) {
    return { kind: "MISSING_ASSET", message, httpStatus: status, retryable: false, retryAfterSeconds };
  }
  if (text.includes("unsupported model")) {
    return { kind: "UNSUPPORTED_MODEL", message, httpStatus: status, retryable: false, retryAfterSeconds };
  }
  if (text.includes("file too large")) {
    return { kind: "FILE_TOO_LARGE", message, httpStatus: status, retryable: false, retryAfterSeconds };
  }
  if (text.includes("safety")) {
    return { kind: "SAFETY_REJECTION", message, httpStatus: status, retryable: false, retryAfterSeconds };
  }
  if (status !== null && status >= 400 && status < 500) {
    return { kind: "INVALID_PAYLOAD", message, httpStatus: status, retryable: false, retryAfterSeconds };
  }

  return { kind: "UNKNOWN", message, httpStatus: status, retryable: false, retryAfterSeconds };
}

async function parseJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    const value = JSON.parse(text) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : { value };
  } catch {
    return { message: text.slice(0, 500) };
  }
}

async function requestJson(path: string, init: RequestInit): Promise<{ ok: true; status: number; data: Record<string, unknown>; headers: Headers } | { ok: false; error: MagnificProviderError }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const response = await fetch(buildUrl(path), { ...init, signal: controller.signal, cache: "no-store" });
    const data = await parseJsonResponse(response);
    if (!response.ok) {
      const message = readString(data.message) ?? readString(data.error) ?? `Magnific request failed (${response.status}).`;
      return { ok: false, error: classifyProviderError(response.status, message, parseRetryAfter(response.headers)) };
    }
    return { ok: true, status: response.status, data, headers: response.headers };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Magnific request failed.";
    return { ok: false, error: classifyProviderError(null, message, null) };
  } finally {
    clearTimeout(timer);
  }
}

function providerTaskIdFrom(data: Record<string, unknown>): string | null {
  return readString(data.id) ?? readString(data.task_id) ?? readString(data.taskId) ?? readString(data.generation_id);
}

function isDoneStatus(data: Record<string, unknown>): boolean {
  const status = readString(data.status)?.toLowerCase();
  return status === "success" || status === "succeeded" || status === "completed" || status === "done";
}

function isFailedStatus(data: Record<string, unknown>): boolean {
  const status = readString(data.status)?.toLowerCase();
  return status === "failed" || status === "error" || status === "cancelled";
}

export async function testMagnificApiKey(apiKey: string): Promise<{ success: true } | { success: false; error: MagnificProviderError }> {
  // Magnific has no dedicated /account endpoint. Use a lightweight GET to the
  // image upscaler endpoint — a 401/403 means invalid key, a 405/400 means the
  // key is valid but the method/payload is wrong (which proves auth works).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const response = await fetch(buildUrl("/v1/ai/image-upscaler"), {
      method: "GET",
      headers: { "x-magnific-api-key": apiKey },
      signal: controller.signal,
      cache: "no-store",
    });

    // 401/403 — could be invalid key OR IP block
    if (response.status === 401 || response.status === 403) {
      const text = await response.text().catch(() => "");
      const message = text.trim().slice(0, 200) || "API key tidak valid.";
      // Detect IP block vs actual auth failure
      const lowerMessage = message.toLowerCase();
      if (lowerMessage.includes("block") || lowerMessage.includes("suspicious") || lowerMessage.includes("banned")) {
        return {
          success: false,
          error: { kind: "RATE_LIMIT", message: "IP diblokir oleh Magnific. Key tersimpan, coba tes lagi nanti.", httpStatus: response.status, retryable: true, retryAfterSeconds: 300 },
        };
      }
      return {
        success: false,
        error: { kind: "INVALID_KEY", message, httpStatus: response.status, retryable: false, retryAfterSeconds: null },
      };
    }

    // Any other response (405, 400, 200, etc.) means the key authenticated successfully
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tes koneksi gagal.";
    return {
      success: false,
      error: classifyProviderError(null, message, null),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function submitMagnificTask(input: MagnificSubmitInput): Promise<MagnificSubmitResult> {
  const response = await requestJson(endpointForTool(input.toolType), {
    method: "POST",
    headers: authHeaders(input.apiKey),
    body: JSON.stringify({
      tool_type: input.toolType,
      model_name: input.modelName,
      source_image_drive_item_ref_id: input.sourceImageDriveItemRefId,
      source_motion_drive_item_ref_id: input.sourceMotionDriveItemRefId,
      ...input.inputPayload,
    }),
  });

  if (!response.ok) return { success: false, error: response.error };

  const providerTaskId = providerTaskIdFrom(response.data);
  if (!providerTaskId) {
    return {
      success: false,
      error: classifyProviderError(null, "Magnific response tidak menyertakan task id.", null),
    };
  }

  return { success: true, providerTaskId, raw: response.data };
}

export async function pollMagnificTask(apiKey: string, providerTaskId: string): Promise<MagnificPollResult> {
  const response = await requestJson(`/tasks/${encodeURIComponent(providerTaskId)}`, {
    method: "GET",
    headers: authHeaders(apiKey),
  });

  if (!response.ok) return { success: false, error: response.error };
  if (isFailedStatus(response.data)) {
    const message = readString(response.data.message) ?? readString(response.data.error) ?? "Magnific task failed.";
    return { success: false, error: classifyProviderError(null, message, null) };
  }
  if (!isDoneStatus(response.data)) {
    return { success: true, done: false, raw: response.data };
  }

  const output = response.data.output && typeof response.data.output === "object" && !Array.isArray(response.data.output)
    ? response.data.output as Record<string, unknown>
    : response.data;

  return { success: true, done: true, output, raw: response.data };
}
