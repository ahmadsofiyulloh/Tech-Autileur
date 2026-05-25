"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import { logDiagnostic } from "@/lib/server/diagnostic-logging";

export type StuckTask = {
  id: string;
  taskType: "PROMPT_PACK_GENERATION" | "SHARE_CAPTION";
  status: "QUEUED" | "RUNNING" | "WAITING_FOR_KEY";
  createdAt: string;
  startedAt: string | null;
  updatedAt: string;
  staleDurationMs: number;
  createdAgoMs: number;
  errorMessage: string | null;
  promptPackId?: string;
  shareGenerationId?: string;
};

export type KeyPoolItem = {
  id: string;
  role: string;
  status: string;
  model: string;
  cooldownUntil: string | null;
  lastUsedAt: string | null;
  quotaLimits: { rpm: number | null; rpd: number | null; tpm: number | null };
};

export type RecentError = {
  id: string;
  taskType: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  finishedAt: string | null;
};

export type DiagnosticsData = {
  stuckTasks: StuckTask[];
  totalStuck: number;
  keyPool: {
    keys: KeyPoolItem[];
    summary: { active: number; cooldown: number; error: number; total: number };
  };
  recentErrors: RecentError[];
  failedLast24h: number;
  activeQueue: number;
};

async function requireUserId() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return user.id;
}

export async function fetchDiagnosticsData(): Promise<DiagnosticsData> {
  const userId = await requireUserId();
  const supabase = await createSupabaseServerClient();
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [stuckResult, keysResult, errorsResult, failedResult, activeResult] = await Promise.all([
    supabase
      .from("ai_tasks")
      .select("id, task_type, status, created_at, started_at, updated_at, error_message, input_json")
      .eq("user_id", userId)
      .in("status", ["QUEUED", "RUNNING", "WAITING_FOR_KEY"])
      .lt("updated_at", fiveMinAgo)
      .order("created_at", { ascending: true }),
    supabase
      .from("gemini_api_keys")
      .select("id, role, status, model_name, cooldown_until, last_used_at, rpm_limit, rpd_limit, tpm_limit")
      .eq("user_id", userId),
    supabase
      .from("ai_tasks")
      .select("id, task_type, status, error_message, created_at, finished_at")
      .eq("user_id", userId)
      .in("status", ["FAILED", "CANCELLED"])
      .order("finished_at", { ascending: false, nullsFirst: false })
      .limit(20),
    supabase
      .from("ai_tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "FAILED")
      .gte("finished_at", dayAgo),
    supabase
      .from("ai_tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["QUEUED", "RUNNING"])
      .gte("updated_at", fiveMinAgo),
  ]);

  const now = Date.now();
  const stuckTasks: StuckTask[] = (stuckResult.data ?? []).map((task) => {
    const inputJson = task.input_json as Record<string, unknown> | null;
    return {
      id: task.id,
      taskType: task.task_type as "PROMPT_PACK_GENERATION" | "SHARE_CAPTION",
      status: task.status as "QUEUED" | "RUNNING" | "WAITING_FOR_KEY",
      createdAt: task.created_at,
      startedAt: task.started_at,
      updatedAt: task.updated_at,
      staleDurationMs: now - new Date(task.updated_at).getTime(),
      createdAgoMs: now - new Date(task.created_at).getTime(),
      errorMessage: task.error_message,
      promptPackId: inputJson?.promptPackId as string | undefined,
      shareGenerationId: inputJson?.generationId as string | undefined,
    };
  });

  const keys: KeyPoolItem[] = (keysResult.data ?? []).map((key) => ({
    id: key.id,
    role: key.role,
    status: key.status,
    model: key.model_name,
    cooldownUntil: key.cooldown_until,
    lastUsedAt: key.last_used_at,
    quotaLimits: { rpm: key.rpm_limit, rpd: key.rpd_limit, tpm: key.tpm_limit },
  }));

  const summary = {
    active: keys.filter((k) => k.status === "ACTIVE").length,
    cooldown: keys.filter((k) => k.status === "RATE_LIMITED" || k.status === "COOLDOWN").length,
    error: keys.filter((k) => k.status === "ERROR").length,
    total: keys.length,
  };

  const recentErrors: RecentError[] = (errorsResult.data ?? []).map((task) => ({
    id: task.id,
    taskType: task.task_type,
    status: task.status,
    errorMessage: task.error_message,
    createdAt: task.created_at,
    finishedAt: task.finished_at,
  }));

  return {
    stuckTasks,
    totalStuck: stuckTasks.length,
    keyPool: { keys, summary },
    recentErrors,
    failedLast24h: failedResult.count ?? 0,
    activeQueue: activeResult.count ?? 0,
  };
}

export async function markTasksFailed(taskIds: string[]): Promise<{
  success: boolean;
  markedCount: number;
  errors?: Array<{ taskId: string; error: string }>;
}> {
  const userId = await requireUserId();

  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    throw new Error("taskIds must be a non-empty array");
  }

  if (taskIds.length > 50) {
    throw new Error("Maximum 50 tasks per request");
  }

  const serviceClient = createSupabaseServiceRoleClient();
  const errors: Array<{ taskId: string; error: string }> = [];
  let markedCount = 0;

  for (const taskId of taskIds) {
    try {
      const { data: task, error: fetchError } = await serviceClient
        .from("ai_tasks")
        .select("task_type, input_json")
        .eq("id", taskId)
        .eq("user_id", userId)
        .maybeSingle();

      if (fetchError || !task) {
        errors.push({ taskId, error: "Task not found or access denied" });
        continue;
      }

      const { error: taskUpdateError } = await serviceClient
        .from("ai_tasks")
        .update({
          status: "FAILED",
          finished_at: new Date().toISOString(),
          error_message: "Marked failed via diagnostic recovery",
        })
        .eq("id", taskId)
        .eq("user_id", userId);

      if (taskUpdateError) {
        errors.push({ taskId, error: taskUpdateError.message });
        continue;
      }

      const inputJson = task.input_json as Record<string, unknown> | null;

      if (task.task_type === "PROMPT_PACK_GENERATION" && inputJson?.promptPackId) {
        await serviceClient
          .from("prompt_packs")
          .update({ status: "ERROR" })
          .eq("ai_task_id", taskId)
          .eq("user_id", userId);
      } else if (task.task_type === "SHARE_CAPTION" && inputJson?.generationId) {
        await serviceClient
          .from("share_generations")
          .update({ status: "error", error_message: "Marked failed via diagnostic recovery" })
          .eq("ai_task_id", taskId)
          .eq("user_id", userId);
      }

      void logDiagnostic({
        userId,
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

  revalidatePath("/admin/diagnostics");

  return {
    success: true,
    markedCount,
    ...(errors.length > 0 && { errors }),
  };
}
