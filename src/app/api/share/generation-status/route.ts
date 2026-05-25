import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SHARE_STALE_MS = 120_000;

type ShareGenerationStatusRow = {
  id: string;
  status: string;
  error_message: string | null;
  output_json: unknown | null;
  ai_task_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ShareTaskStatusRow = {
  id: string;
  status: string;
  error_message: string | null;
  started_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function isOlderThan(timestamp: string | null | undefined, ms: number) {
  if (!timestamp) {
    return false;
  }

  return Date.now() - new Date(timestamp).getTime() > ms;
}

function hasOutput(outputJson: unknown) {
  return Array.isArray(outputJson) ? outputJson.length > 0 : Boolean(outputJson);
}

async function markGenerationError(input: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  generationId: string;
  userId: string;
  taskId?: string | null;
  errorMessage: string;
}) {
  await input.supabase
    .from("share_generations")
    .update({
      status: "error",
      error_message: input.errorMessage,
    })
    .eq("id", input.generationId)
    .eq("user_id", input.userId);

  if (input.taskId) {
    await input.supabase
      .from("ai_tasks")
      .update({
        status: "FAILED",
        error_message: input.errorMessage,
        finished_at: new Date().toISOString(),
      })
      .eq("id", input.taskId)
      .eq("user_id", input.userId);
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Missing required parameter: id" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("share_generations")
      .select("id, status, error_message, output_json, ai_task_id, created_at, updated_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Generation not found" },
        { status: 404 }
      );
    }

    const generation = data as ShareGenerationStatusRow;

    if (generation.status === "generating" && hasOutput(generation.output_json)) {
      await supabase
        .from("share_generations")
        .update({ status: "generated", error_message: null })
        .eq("id", generation.id)
        .eq("user_id", user.id);

      return NextResponse.json({
        status: "generated",
        error_message: null,
        output_json: generation.output_json,
        task_status: null,
        stale: false,
      });
    }

    let task: ShareTaskStatusRow | null = null;
    if (generation.status === "generating" && generation.ai_task_id) {
      const { data: taskData } = await supabase
        .from("ai_tasks")
        .select("id, status, error_message, started_at, created_at, updated_at")
        .eq("id", generation.ai_task_id)
        .eq("user_id", user.id)
        .maybeSingle();

      task = (taskData ?? null) as ShareTaskStatusRow | null;
    }

    if (generation.status === "generating") {
      const isGenerationStale = isOlderThan(generation.updated_at ?? generation.created_at, SHARE_STALE_MS);
      const missingTask = !generation.ai_task_id;
      const taskMissingAfterLink = Boolean(generation.ai_task_id && !task);
      const taskFailed = task?.status === "FAILED" || task?.status === "CANCELLED";
      const taskWaitingForKey = task?.status === "WAITING_FOR_KEY";
      const taskQueuedStale = task?.status === "QUEUED" && !task.started_at && isOlderThan(task.updated_at ?? task.created_at, SHARE_STALE_MS);
      const taskSuccessWithoutOutput = task?.status === "SUCCESS" && !hasOutput(generation.output_json);

      if (isGenerationStale && missingTask) {
        const errorMessage = "Caption generation tidak memiliki task aktif. Coba generate ulang.";
        await markGenerationError({
          supabase,
          generationId: generation.id,
          userId: user.id,
          errorMessage,
        });
        return NextResponse.json({ status: "error", error_message: errorMessage, output_json: null, task_status: null, stale: true });
      }

      if (taskMissingAfterLink || taskFailed || taskWaitingForKey || taskQueuedStale || taskSuccessWithoutOutput) {
        const errorMessage =
          task?.error_message ??
          (taskSuccessWithoutOutput
            ? "Task caption selesai tetapi output belum tersedia. Coba generate ulang."
            : "Caption generation tidak berjalan setelah masuk antrean. Coba generate ulang.");
        await markGenerationError({
          supabase,
          generationId: generation.id,
          userId: user.id,
          taskId: task?.id ?? null,
          errorMessage,
        });
        return NextResponse.json({
          status: "error",
          error_message: errorMessage,
          output_json: null,
          task_status: task?.status ?? null,
          stale: taskQueuedStale || taskMissingAfterLink || taskSuccessWithoutOutput,
        });
      }
    }

    return NextResponse.json({
      status: generation.status,
      error_message: generation.error_message,
      output_json: generation.output_json,
      task_status: task?.status ?? null,
      stale: false,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
