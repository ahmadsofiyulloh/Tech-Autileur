import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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
    .select("id, task_type, status, error_message, created_at, finished_at")
    .eq("user_id", user.id)
    .in("status", ["FAILED", "CANCELLED"])
    .order("finished_at", { ascending: false, nullsFirst: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const errors = (tasks ?? []).map((task) => ({
    id: task.id,
    taskType: task.task_type,
    status: task.status,
    errorMessage: task.error_message,
    createdAt: task.created_at,
    finishedAt: task.finished_at,
  }));

  return NextResponse.json({ errors });
}
