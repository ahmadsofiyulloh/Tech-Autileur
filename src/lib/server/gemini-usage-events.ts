import "server-only";

import { type AiTaskType } from "@/lib/ai-tasks/validation";
import { type GeminiKeyRole } from "@/lib/gemini/validation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import { GeminiClientError, generateGeminiJsonText } from "@/lib/server/gemini-client";

type JsonRecord = Record<string, unknown>;
type GeminiRequestOptions = Parameters<typeof generateGeminiJsonText>[0];

type GeminiUsageKey = {
  id: string;
  project_label: string | null;
  model_name: string;
  role: string;
};

type GeminiUsageEventInput = {
  aiTaskId: string | null;
  geminiApiKey: GeminiUsageKey;
  request: GeminiRequestOptions;
  taskType: AiTaskType;
  userId: string;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readOptionalInt(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
}

function readGeminiErrorMessage(error: unknown) {
  if (error instanceof GeminiClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return error ? "Gemini request failed." : null;
}

function readUsageMetadata(raw: unknown) {
  const metadata = isRecord(raw)
    ? isRecord(raw.usageMetadata)
      ? raw.usageMetadata
      : isRecord(raw.usage_metadata)
        ? raw.usage_metadata
        : null
    : null;

  return {
    promptTokenCount: readOptionalInt(metadata?.promptTokenCount ?? metadata?.prompt_token_count),
    candidatesTokenCount: readOptionalInt(metadata?.candidatesTokenCount ?? metadata?.candidates_token_count),
    totalTokenCount: readOptionalInt(metadata?.totalTokenCount ?? metadata?.total_token_count),
    thoughtsTokenCount: readOptionalInt(metadata?.thoughtsTokenCount ?? metadata?.thoughts_token_count),
    cachedContentTokenCount: readOptionalInt(metadata?.cachedContentTokenCount ?? metadata?.cached_content_token_count),
  };
}

async function startGeminiUsageEvent(input: GeminiUsageEventInput) {
  try {
    const serviceClient = createSupabaseServiceRoleClient();
    const { data, error } = await serviceClient
      .from("gemini_api_usage_events")
      .insert({
        user_id: input.userId,
        gemini_api_key_id: input.geminiApiKey.id,
        ai_task_id: input.aiTaskId,
        project_label: input.geminiApiKey.project_label,
        model_name: input.geminiApiKey.model_name,
        role: input.geminiApiKey.role as GeminiKeyRole,
        task_type: input.taskType,
        status: "STARTED",
      })
      .select("id")
      .single();

    if (error) {
      return null;
    }

    return typeof data?.id === "string" ? data.id : null;
  } catch {
    return null;
  }
}

async function finishGeminiUsageEvent(input: {
  error?: unknown;
  eventId: string | null;
  raw?: unknown;
  userId: string;
}) {
  if (!input.eventId) {
    return;
  }

  const usage = readUsageMetadata(input.raw);
  const error = input.error;
  const geminiError = error instanceof GeminiClientError ? error : null;
  const httpStatus = geminiError?.status ?? null;
  const retryAfterSeconds = geminiError?.retryAfterSeconds ?? null;
  const status = error ? (httpStatus === 429 ? "RATE_LIMITED" : "FAILED") : "SUCCESS";
  const errorMessage = readGeminiErrorMessage(error);

  try {
    const serviceClient = createSupabaseServiceRoleClient();
    await serviceClient
      .from("gemini_api_usage_events")
      .update({
        request_finished_at: new Date().toISOString(),
        status,
        http_status: httpStatus,
        prompt_token_count: usage.promptTokenCount,
        candidates_token_count: usage.candidatesTokenCount,
        total_token_count: usage.totalTokenCount,
        thoughts_token_count: usage.thoughtsTokenCount,
        cached_content_token_count: usage.cachedContentTokenCount,
        retry_after_seconds: retryAfterSeconds,
        error_message: errorMessage,
      })
      .eq("id", input.eventId)
      .eq("user_id", input.userId);
  } catch {
    // Usage tracking must never block the operator workflow.
  }
}

export async function generateTrackedGeminiJsonText(input: GeminiUsageEventInput) {
  const eventId = await startGeminiUsageEvent(input);

  try {
    const response = await generateGeminiJsonText(input.request);
    await finishGeminiUsageEvent({
      eventId,
      raw: response.raw,
      userId: input.userId,
    });
    return response;
  } catch (error) {
    await finishGeminiUsageEvent({
      error,
      eventId,
      userId: input.userId,
    });
    throw error;
  }
}
