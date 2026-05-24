import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ShareKpiMetrics = {
  platformCount: number;
  captionsToday: number;
  totalGenerations: number;
  queuedTasks: number;
};

export async function getShareKpiMetrics(): Promise<ShareKpiMetrics> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      platformCount: 4,
      captionsToday: 0,
      totalGenerations: 0,
      queuedTasks: 0,
    };
  }

  const today = new Date().toISOString().split("T")[0];

  const [captionsTodayResult, totalGenerationsResult, queuedTasksResult] = await Promise.all([
    supabase
      .from("share_generations")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "generated")
      .gte("created_at", `${today}T00:00:00.000Z`),

    supabase
      .from("share_generations")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "generated"),

    supabase
      .from("ai_tasks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("task_type", "SHARE_CAPTION")
      .in("status", ["QUEUED", "RUNNING", "RETRYING", "WAITING_FOR_KEY"]),
  ]);

  return {
    platformCount: 4,
    captionsToday: captionsTodayResult.count ?? 0,
    totalGenerations: totalGenerationsResult.count ?? 0,
    queuedTasks: queuedTasksResult.count ?? 0,
  };
}
