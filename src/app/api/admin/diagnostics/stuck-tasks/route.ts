import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type StuckTask = {
  id: string;
  taskType: "PROMPT_PACK_GENERATION" | "SHARE_CAPTION";
  status: "QUEUED" | "RUNNING" | "WAITING_FOR_KEY";
  createdAt: string;
  startedAt: string | null;
  updatedAt: string;
  staleDurationMs: number;
  errorMessage: string | null;
  promptPackId?: string;
  shareGenerationId?: string;
};

export async function GET() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: tasks, error } = await supabase
    .from("ai_tasks")
    .select("id, task_type, status, created_at, started_at, updated_at, error_message, input_json")
    .eq("user_id", user.id)
    .in("status", ["QUEUED", "RUNNING", "WAITING_FOR_KEY"])
    .lt("updated_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const stuckTasks: StuckTask[] = (tasks ?? []).map((task) => {
    const updatedAt = new Date(task.updated_at);
    const staleDurationMs = Date.now() - updatedAt.getTime();
    const inputJson = task.input_json as Record<string, unknown> | null;

    return {
      id: task.id,
      taskType: task.task_type as "PROMPT_PACK_GENERATION" | "SHARE_CAPTION",
      status: task.status as "QUEUED" | "RUNNING" | "WAITING_FOR_KEY",
      createdAt: task.created_at,
      startedAt: task.started_at,
      updatedAt: task.updated_at,
      staleDurationMs,
      errorMessage: task.error_message,
      promptPackId: inputJson?.promptPackId as string | undefined,
      shareGenerationId: inputJson?.generationId as string | undefined,
    };
  });

  return NextResponse.json({
    stuckTasks,
    totalStuck: stuckTasks.length,
  });
}
