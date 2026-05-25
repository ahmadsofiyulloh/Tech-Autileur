import type { NextRequest } from "next/server";
import { apiAuthenticationErrorResponse, requireApiUser } from "@/lib/server/api-auth";
import { fail, ok } from "@/lib/server/api-response";
import { toSafeErrorMessage } from "@/lib/server/safe-error";

export const dynamic = "force-dynamic";

const ACTIVE_PROMPT_STATUSES = new Set(["QUEUED", "RUNNING", "GENERATING", "WAITING_FOR_KEY", "RETRYING"]);
const TERMINAL_ERROR_TASK_STATUSES = new Set(["FAILED", "CANCELLED"]);
const PROMPT_STALE_MS = 120_000;

type PromptPackStatusRow = {
  id: string;
  ai_task_id: string | null;
  status: string;
  error_message: string | null;
  output_variants_json: unknown | null;
  created_at: string | null;
  updated_at: string | null;
};

type PromptTaskStatusRow = {
  id: string;
  status: string;
  error_message: string | null;
  started_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function hasPromptOutput(promptPack: PromptPackStatusRow) {
  return Array.isArray(promptPack.output_variants_json)
    ? promptPack.output_variants_json.length > 0
    : Boolean(promptPack.output_variants_json);
}

function isStaleQueuedTask(task: PromptTaskStatusRow) {
  if (task.status !== "QUEUED" || task.started_at) {
    return false;
  }

  const timestamp = task.updated_at ?? task.created_at;
  if (!timestamp) {
    return false;
  }

  return Date.now() - new Date(timestamp).getTime() > PROMPT_STALE_MS;
}

function promptStatusPayload(input: {
  status: "generating" | "generated" | "error";
  promptPack: PromptPackStatusRow;
  task?: PromptTaskStatusRow | null;
  errorMessage?: string | null;
}) {
  return {
    status: input.status,
    prompt_pack_status: input.promptPack.status,
    task_status: input.task?.status ?? null,
    output_ready: hasPromptOutput(input.promptPack) || input.promptPack.status === "GENERATED",
    error_message: input.errorMessage ?? input.promptPack.error_message ?? input.task?.error_message ?? null,
  };
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { supabase, user } = await requireApiUser();

    const { data: promptPack, error: promptPackError } = await supabase
      .from("prompt_packs")
      .select("id, ai_task_id, status, error_message, output_variants_json, created_at, updated_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (promptPackError) {
      return fail(
        toSafeErrorMessage(promptPackError, {
          context: "api.prompts.generate.status.prompt-pack",
          fallbackMessage: "Prompt status not available.",
        }),
        400,
      );
    }

    if (!promptPack) {
      return fail("Prompt pack not found.", 404);
    }

    const typedPromptPack = promptPack as PromptPackStatusRow;

    if (typedPromptPack.status === "GENERATED" || hasPromptOutput(typedPromptPack)) {
      return ok(promptStatusPayload({ status: "generated", promptPack: typedPromptPack }), 200);
    }

    if (typedPromptPack.status === "ERROR") {
      return ok(promptStatusPayload({ status: "error", promptPack: typedPromptPack }), 200);
    }

    if (!typedPromptPack.ai_task_id) {
      if (ACTIVE_PROMPT_STATUSES.has(typedPromptPack.status)) {
        const errorMessage = "Prompt generation tidak memiliki task aktif. Coba generate ulang.";
        await supabase
          .from("prompt_packs")
          .update({ status: "ERROR", error_message: errorMessage })
          .eq("id", typedPromptPack.id)
          .eq("user_id", user.id);

        return ok(promptStatusPayload({ status: "error", promptPack: typedPromptPack, errorMessage }), 200);
      }

      return ok(promptStatusPayload({ status: "generating", promptPack: typedPromptPack }), 200);
    }

    const { data: task, error: taskError } = await supabase
      .from("ai_tasks")
      .select("id, status, error_message, started_at, created_at, updated_at")
      .eq("id", typedPromptPack.ai_task_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (taskError) {
      return fail(
        toSafeErrorMessage(taskError, {
          context: "api.prompts.generate.status.task",
          fallbackMessage: "Prompt status not available.",
        }),
        400,
      );
    }

    const typedTask = (task ?? null) as PromptTaskStatusRow | null;

    if (!typedTask) {
      const errorMessage = "Prompt generation task tidak ditemukan. Coba generate ulang.";
      await supabase
        .from("prompt_packs")
        .update({ status: "ERROR", error_message: errorMessage })
        .eq("id", typedPromptPack.id)
        .eq("user_id", user.id);

      return ok(promptStatusPayload({ status: "error", promptPack: typedPromptPack, errorMessage }), 200);
    }

    if (typedTask.status === "SUCCESS") {
      if (typedPromptPack.status === "GENERATED" || hasPromptOutput(typedPromptPack)) {
        return ok(promptStatusPayload({ status: "generated", promptPack: typedPromptPack, task: typedTask }), 200);
      }

      const errorMessage = "Prompt task selesai tetapi output belum tersedia. Coba generate ulang.";
      await supabase
        .from("prompt_packs")
        .update({ status: "ERROR", error_message: errorMessage })
        .eq("id", typedPromptPack.id)
        .eq("user_id", user.id);

      return ok(promptStatusPayload({ status: "error", promptPack: typedPromptPack, task: typedTask, errorMessage }), 200);
    }

    if (TERMINAL_ERROR_TASK_STATUSES.has(typedTask.status) || isStaleQueuedTask(typedTask)) {
      const errorMessage =
        typedTask.error_message ??
        "Prompt generation tidak berjalan setelah masuk antrean. Coba generate ulang.";
      await supabase
        .from("prompt_packs")
        .update({ status: "ERROR", error_message: errorMessage })
        .eq("id", typedPromptPack.id)
        .eq("user_id", user.id);

      return ok(promptStatusPayload({ status: "error", promptPack: typedPromptPack, task: typedTask, errorMessage }), 200);
    }

    return ok(promptStatusPayload({ status: "generating", promptPack: typedPromptPack, task: typedTask }), 200);
  } catch (error) {
    const authResponse = apiAuthenticationErrorResponse(error);
    if (authResponse) {
      return authResponse;
    }

    const message = toSafeErrorMessage(error, {
      context: "api.prompts.generate.status",
      fallbackMessage: "Prompt status not available.",
    });

    return fail(message, 400);
  }
}
