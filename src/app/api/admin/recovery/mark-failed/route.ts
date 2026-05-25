import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import { logDiagnostic } from "@/lib/server/diagnostic-logging";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { taskIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { taskIds } = body;

  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return NextResponse.json({ error: "taskIds must be a non-empty array" }, { status: 400 });
  }

  if (taskIds.length > 50) {
    return NextResponse.json({ error: "Maximum 50 tasks per request" }, { status: 400 });
  }

  const serviceClient = createSupabaseServiceRoleClient();
  const errors: Array<{ taskId: string; error: string }> = [];
  let markedCount = 0;

  for (const taskId of taskIds) {
    try {
      // Fetch task to get task_type and input_json
      const { data: task, error: fetchError } = await serviceClient
        .from("ai_tasks")
        .select("task_type, input_json")
        .eq("id", taskId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (fetchError || !task) {
        errors.push({ taskId, error: "Task not found or access denied" });
        continue;
      }

      // Update ai_tasks
      const { error: taskUpdateError } = await serviceClient
        .from("ai_tasks")
        .update({
          status: "FAILED",
          finished_at: new Date().toISOString(),
          error_message: "Marked failed via diagnostic recovery",
        })
        .eq("id", taskId)
        .eq("user_id", user.id);

      if (taskUpdateError) {
        errors.push({ taskId, error: taskUpdateError.message });
        continue;
      }

      // Update generation table based on task_type
      const inputJson = task.input_json as Record<string, unknown> | null;

      if (task.task_type === "PROMPT_PACK_GENERATION" && inputJson?.promptPackId) {
        await serviceClient
          .from("prompt_packs")
          .update({ status: "ERROR" })
          .eq("ai_task_id", taskId)
          .eq("user_id", user.id);
      } else if (task.task_type === "SHARE_CAPTION" && inputJson?.generationId) {
        await serviceClient
          .from("share_generations")
          .update({ status: "error", error_message: "Marked failed via diagnostic recovery" })
          .eq("ai_task_id", taskId)
          .eq("user_id", user.id);
      }

      // Log diagnostic
      void logDiagnostic({
        userId: user.id,
        context: "recovery",
        level: "info",
        message: "Task marked failed via dashboard",
        metadata: { task_id: taskId, task_type: task.task_type },
      });

      markedCount++;
    } catch (error) {
      errors.push({ taskId, error: error instanceof Error ? error.message : "Unknown error" });
    }
  }

  return NextResponse.json({
    success: true,
    markedCount,
    ...(errors.length > 0 && { errors }),
  });
}
