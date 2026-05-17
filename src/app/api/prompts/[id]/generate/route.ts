import type { NextRequest } from "next/server";
import { apiAuthenticationErrorResponse, requireApiUser } from "@/lib/server/api-auth";
import { fail, ok } from "@/lib/server/api-response";
import { runMockPromptPackTask, runRealPromptPackTask } from "@/lib/server/prompt-packs";
import { toSafeErrorMessage } from "@/lib/server/safe-error";

export const dynamic = "force-dynamic";

type PromptPackTaskRecord = {
  id: string;
  status: string;
  input_json: Record<string, unknown> | null;
};

function readGenerationMode(input: Record<string, unknown> | null) {
  const mode = input && typeof input.mode === "string" ? input.mode : "gemini";

  return mode === "mock" ? "mock" : "gemini";
}

function isRunnableStatus(status: string) {
  return status === "QUEUED" || status === "RETRYING" || status === "WAITING_FOR_KEY";
}

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { supabase, user } = await requireApiUser();

    const { data: promptPack, error: promptPackError } = await supabase
      .from("prompt_packs")
      .select("id, ai_task_id, status")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (promptPackError) {
      return fail(
        toSafeErrorMessage(promptPackError, {
          context: "api.prompts.generate.prompt-pack",
          fallbackMessage: "Prompt pack generation failed.",
        }),
        400,
      );
    }

    if (!promptPack) {
      return fail("Prompt pack not found.", 404);
    }

    if (!promptPack.ai_task_id) {
      return fail("Prompt generation task not ready.", 409);
    }

    const { data: task, error: taskError } = await supabase
      .from("ai_tasks")
      .select("id, status, input_json")
      .eq("id", promptPack.ai_task_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (taskError) {
      return fail(
        toSafeErrorMessage(taskError, {
          context: "api.prompts.generate.task",
          fallbackMessage: "Prompt pack generation failed.",
        }),
        400,
      );
    }

    if (!task) {
      return fail("Prompt generation task not found.", 404);
    }

    const typedTask = task as PromptPackTaskRecord;

    if (typedTask.status === "SUCCESS") {
      return ok({ status: typedTask.status, started: false }, 200);
    }

    if (typedTask.status === "RUNNING") {
      return ok({ status: typedTask.status, started: false }, 202);
    }

    if (!isRunnableStatus(typedTask.status)) {
      return fail("Prompt generation task not ready.", 409, "PROMPT_TASK_NOT_RUNNABLE");
    }

    const generationMode = readGenerationMode(typedTask.input_json);
    const result =
      generationMode === "mock"
        ? await runMockPromptPackTask(id, typedTask.id)
        : await runRealPromptPackTask(id, typedTask.id);

    return ok(
      {
        status: result.task.status,
        started: true,
        message: result.message,
        promptPackId: result.promptPack.id,
      },
      200,
    );
  } catch (error) {
    const authResponse = apiAuthenticationErrorResponse(error);
    if (authResponse) {
      return authResponse;
    }

    const message = toSafeErrorMessage(error, {
      context: "api.prompts.generate",
      fallbackMessage: "Prompt pack generation failed.",
    });

    return fail(message, 400);
  }
}
