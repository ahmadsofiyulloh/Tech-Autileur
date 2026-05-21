import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import type {
  AiMediaCreateTaskInput,
  AiMediaGenerationTaskProjection,
  ExternalApiKeyRow,
  ExternalGenerationTaskRow,
  ExternalGenerationToolType,
  ExternalKeyStatus,
} from "./contracts";
import { decryptExternalApiKey } from "./keys";
import { pollMagnificTask, submitMagnificTask, type MagnificProviderError } from "./magnific-client";
import { projectGenerationTask, validateCreateTaskInput } from "./projections";

// =============================================================================
// AI Media Task Creation (owner-scoped, live Magnific lifecycle)
// =============================================================================

type ToolDriveRequirements = {
  requiresSourceImage: boolean;
  requiresSourceMotion: boolean;
};

type MagnificKeyCandidate = ExternalApiKeyRow & { rawApiKey: string };

const MAX_ATTEMPTS = 3;
const POLL_ATTEMPTS = 3;
const POLL_DELAY_MS = 1_000;

const TOOL_REQUIREMENTS: Record<ExternalGenerationToolType, ToolDriveRequirements> = {
  MOTION_CONTROL: { requiresSourceImage: true, requiresSourceMotion: true },
  IMAGE_TO_VIDEO: { requiresSourceImage: true, requiresSourceMotion: false },
  UPSCALER: { requiresSourceImage: true, requiresSourceMotion: false },
};

function nowIsoTime(): string {
  const d = new Date();
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function logEntry(level: "info" | "warn" | "error" | "success", message: string) {
  return { time: nowIsoTime(), level, message };
}

function buildWaitingLog(): unknown[] {
  return [
    logEntry("info", "Submit request"),
    logEntry("warn", "Tidak ada key aktif."),
    logEntry("warn", "Task menunggu key."),
  ];
}

function validateDriveRefs(input: AiMediaCreateTaskInput): string | null {
  const reqs = TOOL_REQUIREMENTS[input.toolType];
  if (reqs.requiresSourceImage && !input.sourceImageDriveItemRefId) {
    return "Source image Drive ref diperlukan.";
  }
  if (reqs.requiresSourceMotion && !input.sourceMotionDriveItemRefId) {
    return "Source motion Drive ref diperlukan.";
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function keyStatusForError(error: MagnificProviderError): ExternalKeyStatus {
  if (error.kind === "RATE_LIMIT") return "RATE_LIMITED";
  if (error.kind === "TIMEOUT" || error.kind === "UPSTREAM") return "COOLDOWN";
  if (error.kind === "INVALID_KEY") return "ERROR";
  return "ACTIVE";
}

function taskErrorCode(error: MagnificProviderError): string {
  return `MAGNIFIC_${error.kind}`;
}

async function loadEligibleMagnificKeys(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  preferredKeyId: string | null,
): Promise<MagnificKeyCandidate[]> {
  const { data, error } = await supabase
    .from("external_api_keys")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "magnific")
    .eq("status", "ACTIVE")
    .order("requests_today", { ascending: true })
    .order("last_used_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true })
    .limit(10);
  if (error) return [];

  const now = Date.now();
  const metadataRows = ((data ?? []) as ExternalApiKeyRow[]).filter(
    (row) => !row.cooldown_until || new Date(row.cooldown_until).getTime() <= now,
  );

  const sortedRows = preferredKeyId
    ? metadataRows.sort((a, b) => (a.id === preferredKeyId ? -1 : b.id === preferredKeyId ? 1 : 0))
    : metadataRows;

  if (!sortedRows.length) return [];

  const serviceClient = createSupabaseServiceRoleClient();
  const { data: secretRows, error: secretError } = await serviceClient
    .from("external_api_key_secrets")
    .select("external_api_key_id, encrypted_api_key")
    .eq("user_id", userId)
    .in("external_api_key_id", sortedRows.map((row) => row.id));

  if (secretError) return [];

  const secretMap = new Map<string, string>();
  for (const row of secretRows ?? []) {
    const keyId = typeof row.external_api_key_id === "string" ? row.external_api_key_id : null;
    const encrypted = typeof row.encrypted_api_key === "string" ? row.encrypted_api_key : null;
    if (keyId && encrypted) secretMap.set(keyId, encrypted);
  }

  const candidates: MagnificKeyCandidate[] = [];
  for (const row of sortedRows) {
    const encrypted = secretMap.get(row.id);
    if (!encrypted) continue;
    try {
      candidates.push({ ...row, rawApiKey: decryptExternalApiKey(encrypted) });
    } catch {
      await supabase
        .from("external_api_keys")
        .update({ status: "ERROR", last_error_message: "Dekripsi gagal. Simpan ulang API key." })
        .eq("id", row.id)
        .eq("user_id", userId);
    }
  }

  return candidates.slice(0, MAX_ATTEMPTS);
}

async function insertWaitingTask(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  input: AiMediaCreateTaskInput,
  safeInputJson: Record<string, unknown>,
): Promise<CreateAiMediaTaskResult> {
  const { data: insertData, error: insertError } = await supabase
    .from("external_generation_tasks")
    .insert({
      user_id: userId,
      provider: "magnific",
      tool_type: input.toolType,
      model_name: input.modelName ?? null,
      status: "WAITING_FOR_KEY",
      selected_key_id: null,
      last_attempted_key_id: null,
      fallback_attempts: 0,
      max_attempts: MAX_ATTEMPTS,
      provider_task_id: null,
      source_image_drive_item_ref_id: input.sourceImageDriveItemRefId ?? null,
      source_motion_drive_item_ref_id: input.sourceMotionDriveItemRefId ?? null,
      output_drive_item_ref_id: null,
      input_json: safeInputJson,
      output_json: null,
      log_json: buildWaitingLog(),
      error_code: "NO_ACTIVE_KEY",
      error_message: "Tidak ada key Magnific aktif.",
      priority: input.priority ?? 100,
    })
    .select("*")
    .single();

  if (insertError) {
    return { success: false, error: insertError.message };
  }

  return { success: true, task: projectGenerationTask(insertData as ExternalGenerationTaskRow, new Map()) };
}

export type CreateAiMediaTaskResult =
  | { success: true; task: AiMediaGenerationTaskProjection }
  | { success: false; error: string };

export async function createAiMediaTask(rawInput: unknown): Promise<CreateAiMediaTaskResult> {
  const validation = validateCreateTaskInput(rawInput);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const input = validation.input;

  const driveError = validateDriveRefs(input);
  if (driveError) {
    return { success: false, error: driveError };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Autentikasi diperlukan." };
  }

  const safeInputJson: Record<string, unknown> = {
    ...input.inputPayload,
    tool_type: input.toolType,
    model_name: input.modelName ?? null,
  };

  const keys = await loadEligibleMagnificKeys(supabase, user.id, input.selectedKeyId ?? null);
  if (!keys.length) {
    return insertWaitingTask(supabase, user.id, input, safeInputJson);
  }

  const keyLabelMap = new Map(keys.map((key) => [key.id, key.label]));
  const startedAt = new Date().toISOString();
  const logs: unknown[] = [logEntry("info", "Submit request")];
  let lastRow: ExternalGenerationTaskRow | null = null;
  let lastError: MagnificProviderError | null = null;

  const { data: initialTask, error: initialError } = await supabase
    .from("external_generation_tasks")
    .insert({
      user_id: user.id,
      provider: "magnific",
      tool_type: input.toolType,
      model_name: input.modelName ?? null,
      status: "RUNNING",
      selected_key_id: keys[0].id,
      last_attempted_key_id: keys[0].id,
      fallback_attempts: 0,
      max_attempts: MAX_ATTEMPTS,
      provider_task_id: null,
      source_image_drive_item_ref_id: input.sourceImageDriveItemRefId ?? null,
      source_motion_drive_item_ref_id: input.sourceMotionDriveItemRefId ?? null,
      output_drive_item_ref_id: null,
      input_json: safeInputJson,
      output_json: null,
      log_json: logs,
      error_code: null,
      error_message: null,
      priority: input.priority ?? 100,
      started_at: startedAt,
    })
    .select("*")
    .single();

  if (initialError) {
    return { success: false, error: initialError.message };
  }

  lastRow = initialTask as ExternalGenerationTaskRow;

  for (const [attemptIndex, key] of keys.entries()) {
    logs.push(logEntry("info", `Using key: ${key.label}`));

    const submit = await submitMagnificTask({
      apiKey: key.rawApiKey,
      toolType: input.toolType,
      modelName: input.modelName ?? null,
      inputPayload: input.inputPayload,
      sourceImageDriveItemRefId: input.sourceImageDriveItemRefId ?? null,
      sourceMotionDriveItemRefId: input.sourceMotionDriveItemRefId ?? null,
    });

    if (!submit.success) {
      lastError = submit.error;
      logs.push(logEntry(submit.error.retryable ? "warn" : "error", submit.error.message));
      await supabase
        .from("external_api_keys")
        .update({
          status: keyStatusForError(submit.error),
          cooldown_until: submit.error.retryable
            ? new Date(Date.now() + (submit.error.retryAfterSeconds ?? 60) * 1000).toISOString()
            : key.cooldown_until,
          last_error_message: submit.error.message,
          last_used_at: new Date().toISOString(),
          requests_today: key.requests_today + 1,
        })
        .eq("id", key.id)
        .eq("user_id", user.id);

      if (!submit.error.retryable) break;
      logs.push(logEntry("warn", "Trying fallback key."));
      continue;
    }

    logs.push(logEntry("success", "Provider task submitted."));
    const providerTaskId = submit.providerTaskId;
    let pollOutput: Record<string, unknown> | null = null;

    for (let pollIndex = 0; pollIndex < POLL_ATTEMPTS; pollIndex += 1) {
      const poll = await pollMagnificTask(key.rawApiKey, providerTaskId);
      if (!poll.success) {
        lastError = poll.error;
        logs.push(logEntry(poll.error.retryable ? "warn" : "error", poll.error.message));
        break;
      }
      if (poll.done) {
        pollOutput = poll.output;
        break;
      }
      logs.push(logEntry("info", "Provider task still running."));
      await sleep(POLL_DELAY_MS);
    }

    if (pollOutput) {
      const { data: successRow, error: updateError } = await supabase
        .from("external_generation_tasks")
        .update({
          status: "SUCCESS",
          selected_key_id: keys[0].id,
          last_attempted_key_id: key.id,
          fallback_attempts: attemptIndex,
          provider_task_id: providerTaskId,
          output_json: pollOutput,
          log_json: [...logs, logEntry("success", "Task completed.")],
          error_code: null,
          error_message: null,
          http_status: null,
          retry_after_seconds: null,
          finished_at: new Date().toISOString(),
        })
        .eq("id", lastRow.id)
        .eq("user_id", user.id)
        .select("*")
        .single();

      if (updateError) return { success: false, error: updateError.message };

      await supabase
        .from("external_api_keys")
        .update({
          status: "ACTIVE",
          cooldown_until: null,
          last_error_message: null,
          last_used_at: new Date().toISOString(),
          requests_today: key.requests_today + 1,
        })
        .eq("id", key.id)
        .eq("user_id", user.id);

      return { success: true, task: projectGenerationTask(successRow as ExternalGenerationTaskRow, keyLabelMap) };
    }

    if (!lastError) {
      lastError = {
        kind: "TIMEOUT",
        message: "Provider belum selesai setelah polling singkat.",
        httpStatus: null,
        retryable: true,
        retryAfterSeconds: null,
      };
    }

    await supabase
      .from("external_api_keys")
      .update({
        status: keyStatusForError(lastError),
        cooldown_until: lastError.retryable ? new Date(Date.now() + (lastError.retryAfterSeconds ?? 60) * 1000).toISOString() : key.cooldown_until,
        last_error_message: lastError.message,
        last_used_at: new Date().toISOString(),
        requests_today: key.requests_today + 1,
      })
      .eq("id", key.id)
      .eq("user_id", user.id);

    if (!lastError.retryable) break;
    logs.push(logEntry("warn", "Trying fallback key."));
  }

  if (lastError?.retryable) {
    const { data: waitingRow, error: waitingError } = await supabase
      .from("external_generation_tasks")
      .update({
        status: "WAITING_FOR_KEY",
        fallback_attempts: Math.max(0, keys.length - 1),
        last_attempted_key_id: keys.at(-1)?.id ?? null,
        log_json: [...logs, logEntry("warn", "Task menunggu key siap.")],
        error_code: taskErrorCode(lastError),
        error_message: lastError.message,
        http_status: lastError.httpStatus,
        retry_after_seconds: lastError.retryAfterSeconds,
      })
      .eq("id", lastRow.id)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (waitingError) return { success: false, error: waitingError.message };
    return { success: true, task: projectGenerationTask(waitingRow as ExternalGenerationTaskRow, keyLabelMap) };
  }

  const finalError = lastError ?? {
    kind: "UNKNOWN" as const,
    message: "Generate gagal.",
    httpStatus: null,
    retryable: false,
    retryAfterSeconds: null,
  };

  const { data: failedRow, error: failedError } = await supabase
    .from("external_generation_tasks")
    .update({
      status: "FAILED",
      fallback_attempts: Math.max(0, keys.length - 1),
      last_attempted_key_id: keys.at(-1)?.id ?? null,
      log_json: [...logs, logEntry("error", finalError.message)],
      error_code: taskErrorCode(finalError),
      error_message: finalError.message,
      http_status: finalError.httpStatus,
      retry_after_seconds: finalError.retryAfterSeconds,
      finished_at: new Date().toISOString(),
    })
    .eq("id", lastRow.id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (failedError) return { success: false, error: failedError.message };
  return { success: true, task: projectGenerationTask(failedRow as ExternalGenerationTaskRow, keyLabelMap) };
}
