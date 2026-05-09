import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { runMockPromptPackTask, runRealPromptPackTask } from "@/lib/server/prompt-packs";

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
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { data: promptPack, error: promptPackError } = await supabase
      .from("prompt_packs")
      .select("id, ai_task_id, status")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (promptPackError) {
      return NextResponse.json({ error: promptPackError.message }, { status: 400 });
    }

    if (!promptPack) {
      return NextResponse.json({ error: "Prompt pack not found." }, { status: 404 });
    }

    if (!promptPack.ai_task_id) {
      return NextResponse.json({ error: "Prompt generation task not ready." }, { status: 409 });
    }

    const { data: task, error: taskError } = await supabase
      .from("ai_tasks")
      .select("id, status, input_json")
      .eq("id", promptPack.ai_task_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (taskError) {
      return NextResponse.json({ error: taskError.message }, { status: 400 });
    }

    if (!task) {
      return NextResponse.json({ error: "Prompt generation task not found." }, { status: 404 });
    }

    const typedTask = task as PromptPackTaskRecord;

    if (typedTask.status === "SUCCESS") {
      return NextResponse.json({ status: typedTask.status, started: false }, { status: 200 });
    }

    if (typedTask.status === "RUNNING") {
      return NextResponse.json({ status: typedTask.status, started: false }, { status: 202 });
    }

    if (!isRunnableStatus(typedTask.status)) {
      return NextResponse.json({ status: typedTask.status, started: false }, { status: 409 });
    }

    const generationMode = readGenerationMode(typedTask.input_json);
    const result =
      generationMode === "mock"
        ? await runMockPromptPackTask(id, typedTask.id)
        : await runRealPromptPackTask(id, typedTask.id);

    return NextResponse.json(
      {
        status: result.task.status,
        started: true,
        message: result.message,
        promptPackId: result.promptPack.id,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Prompt pack generation failed.";
    const status = message.includes("Authentication") ? 401 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
