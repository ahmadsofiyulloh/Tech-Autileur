import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type GeminiKeyRole } from "@/lib/gemini/validation";
export { PROMPT_PACK_GEMINI_KEY_PRIORITY } from "@/lib/server/gemini-key-routing";
import {
  type AiTaskStatus,
  type AiTaskType,
  AI_TASK_STATUSES,
  AI_TASK_TYPES,
  isAiTaskStatus,
  isAiTaskType,
} from "@/lib/ai-tasks/validation";

type JsonValue = string | number | boolean | null | { [key: string]: JsonValue } | JsonValue[];

type AiTaskRecord = {
  id: string;
  user_id: string;
  gemini_api_key_id: string | null;
  task_type: AiTaskType;
  status: AiTaskStatus;
  input_json: JsonValue;
  output_json: JsonValue | null;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

type GeminiKeyRecord = {
  id: string;
  user_id: string;
  key_code: string;
  label: string;
  provider: string;
  google_account_label: string | null;
  project_label: string | null;
  model_name: string;
  role: GeminiKeyRole;
  rpm_limit: number | null;
  rpd_limit: number | null;
  tpm_limit: number | null;
  requests_today: number;
  last_used_at: string | null;
  cooldown_until: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type RequireUserResult = {
  userId: string;
  serviceClient: ReturnType<typeof createSupabaseServiceRoleClient>;
};

const DEFAULT_MAX_RETRIES = 3;
const MAX_ALLOWED_RETRIES = 10;

function clampLimit(value: number | undefined) {
  if (value === undefined) {
    return DEFAULT_MAX_RETRIES;
  }

  if (!Number.isInteger(value) || value < 0 || value > MAX_ALLOWED_RETRIES) {
    throw new Error(`maxRetries must be between 0 and ${MAX_ALLOWED_RETRIES}.`);
  }

  return value;
}

function assertKnownTaskType(taskType: string): asserts taskType is AiTaskType {
  if (!isAiTaskType(taskType)) {
    throw new Error(`Unsupported AI task type. Expected one of: ${AI_TASK_TYPES.join(", ")}.`);
  }
}

function assertKnownTaskStatus(status: string): asserts status is AiTaskStatus {
  if (!isAiTaskStatus(status)) {
    throw new Error(`Unsupported AI task status. Expected one of: ${AI_TASK_STATUSES.join(", ")}.`);
  }
}

async function requireUser(): Promise<RequireUserResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  return {
    userId: user.id,
    serviceClient: createSupabaseServiceRoleClient(),
  };
}

export async function createAITask(input: {
  taskType: AiTaskType | string;
  inputJson: JsonValue;
  geminiApiKeyId?: string | null;
  maxRetries?: number;
}) {
  const { userId, serviceClient } = await requireUser();
  assertKnownTaskType(input.taskType);

  const maxRetries = clampLimit(input.maxRetries);

  if (input.geminiApiKeyId) {
    const { data: geminiKey, error: geminiKeyError } = await serviceClient
      .from("gemini_api_keys")
      .select("id")
      .eq("id", input.geminiApiKeyId)
      .eq("user_id", userId)
      .maybeSingle();

    if (geminiKeyError) {
      throw new Error(geminiKeyError.message);
    }

    if (!geminiKey) {
      throw new Error("Gemini key not found for the current user.");
    }
  }

  const { data, error } = await serviceClient
    .from("ai_tasks")
    .insert({
      user_id: userId,
      gemini_api_key_id: input.geminiApiKeyId ?? null,
      task_type: input.taskType,
      status: "QUEUED",
      input_json: input.inputJson,
      retry_count: 0,
      max_retries: maxRetries,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as AiTaskRecord;
}

export async function listAITasks(input?: { status?: AiTaskStatus | string; limit?: number }) {
  const { userId, serviceClient } = await requireUser();

  if (input?.status) {
    assertKnownTaskStatus(input.status);
  }

  const limit = Math.min(Math.max(input?.limit ?? 50, 1), 100);
  let query = serviceClient
    .from("ai_tasks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (input?.status) {
    query = query.eq("status", input.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as AiTaskRecord[];
}

export async function markTaskRunning(taskId: string) {
  const { userId, serviceClient } = await requireUser();
  const { data, error } = await serviceClient
    .from("ai_tasks")
    .update({
      status: "RUNNING",
      started_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", taskId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as AiTaskRecord;
}

export async function markTaskSuccess(taskId: string, outputJson: JsonValue) {
  const { userId, serviceClient } = await requireUser();
  const { data, error } = await serviceClient
    .from("ai_tasks")
    .update({
      status: "SUCCESS",
      output_json: outputJson,
      error_message: null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as AiTaskRecord;
}

export async function markTaskFailed(
  taskId: string,
  errorMessage: string,
  options?: { retryable?: boolean },
) {
  const { userId, serviceClient } = await requireUser();
  const { data: currentTask, error: fetchError } = await serviceClient
    .from("ai_tasks")
    .select("id, retry_count, max_retries")
    .eq("id", taskId)
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (!currentTask) {
    throw new Error("AI task not found for the current user.");
  }

  const canRetry = options?.retryable !== false && currentTask.retry_count < currentTask.max_retries;
  const nextRetryCount = canRetry ? currentTask.retry_count + 1 : currentTask.retry_count;
  const nextStatus: AiTaskStatus = canRetry ? "RETRYING" : "FAILED";

  const { data, error } = await serviceClient
    .from("ai_tasks")
    .update({
      status: nextStatus,
      retry_count: nextRetryCount,
      error_message: errorMessage,
      finished_at: canRetry ? null : new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as AiTaskRecord;
}

export async function markTaskWaitingForKey(taskId: string, errorMessage: string) {
  const { userId, serviceClient } = await requireUser();
  const { data, error } = await serviceClient
    .from("ai_tasks")
    .update({
      status: "WAITING_FOR_KEY",
      error_message: errorMessage,
      finished_at: null,
    })
    .eq("id", taskId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as AiTaskRecord;
}

export async function pickAvailableGeminiKeyByRole(taskType: GeminiKeyRole) {
  const keys = await listAvailableGeminiKeysByRole(taskType);
  return (keys[0] ?? null) as GeminiKeyRecord | null;
}

export async function listAvailableGeminiKeysByRole(taskType: GeminiKeyRole) {
  const { userId, serviceClient } = await requireUser();

  const { data, error } = await serviceClient
    .from("gemini_api_keys")
    .select(
      "id, user_id, key_code, label, provider, google_account_label, project_label, model_name, role, rpm_limit, rpd_limit, tpm_limit, requests_today, last_used_at, cooldown_until, status, notes, created_at, updated_at",
    )
    .eq("user_id", userId)
    .eq("role", taskType)
    .eq("status", "ACTIVE")
    .order("requests_today", { ascending: true })
    .order("last_used_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const eligibleKeys = (data ?? []).filter((key) => {
    if (!key.cooldown_until) {
      return true;
    }

    return new Date(key.cooldown_until).getTime() <= Date.now();
  });

  return eligibleKeys as GeminiKeyRecord[];
}

export async function pickAvailableGeminiKeyForPromptPackGeneration() {
  for (const role of PROMPT_PACK_GEMINI_KEY_PRIORITY) {
    const geminiKey = await pickAvailableGeminiKeyByRole(role);

    if (geminiKey) {
      return geminiKey;
    }
  }

  return null;
}
