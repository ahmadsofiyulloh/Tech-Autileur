import "server-only";

import type { AiTaskStatus, AiTaskType } from "@/lib/ai-tasks/validation";
import type { GeminiUsageCard, GeminiUsageMetric } from "@/lib/gemini/usage-types";
import { getGeminiModelLabel } from "@/lib/gemini/validation";
import { getDashboardActionQueue } from "@/lib/server/dashboard-actions";
import { getDashboardPipelineStageCounts, type DashboardPipelineStageKey } from "@/lib/server/dashboard-pipeline";
import { getGeminiUsageOverview } from "@/lib/server/gemini-usage-overview";
import { getCurrentWorkspace } from "@/lib/server/workspaces";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type DashboardTone = "neutral" | "info" | "success" | "warning" | "danger";

export type DashboardMetricViewModel = {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: DashboardTone;
};

export type DashboardQuotaViewModel = {
  id: string;
  label: string;
  used: string;
  limit: string;
  percent: number;
  tone: DashboardTone;
};

export type DashboardIssueViewModel = {
  title: string;
  message: string;
  href?: string;
  actionLabel?: string;
  tone: DashboardTone;
};

export type DashboardActionViewModel = {
  id: string;
  label: string;
  detail: string;
  count: string;
  href: string;
  tone: DashboardTone;
};

export type DashboardPipelineStageViewModel = {
  id: string;
  label: string;
  count: string;
  detail: string;
  href: string;
  percent: number;
  tone: DashboardTone;
};

export type DashboardKeyStatusViewModel = {
  id: string;
  label: string;
  meta: string;
  status: string;
  tone: DashboardTone;
};

export type DashboardViewModel = {
  source: "server";
  generatedAtLabel: string;
  workspaceId: string | null;
  geminiOperations: {
    title: string;
    status: string;
    tone: DashboardTone;
    errorMessage: string | null;
    health: DashboardMetricViewModel[];
    quota: DashboardQuotaViewModel[];
    quotaSummary: string;
    recentIssue: DashboardIssueViewModel;
    keyStatus: DashboardKeyStatusViewModel[];
    keyStatusSummary: string;
  };
  actionQueue: {
    title: string;
    status: "available" | "partial" | "unavailable";
    errorMessage: string | null;
    items: DashboardActionViewModel[];
  };
  pipeline: {
    title: string;
    status: "available" | "unavailable";
    errorMessage: string | null;
    total: string;
    stages: DashboardPipelineStageViewModel[];
  };
};

type ProductIdRecord = {
  id: string;
};

type PromptPackDashboardRecord = {
  id: string;
  ai_task_id: string | null;
  product_id: string;
  status: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type AiTaskDashboardRecord = {
  id: string;
  gemini_api_key_id: string | null;
  task_type: AiTaskType | string;
  status: AiTaskStatus | string;
  error_message: string | null;
  retry_count: number | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

type GeminiUsageIssueRecord = {
  id: string;
  ai_task_id: string | null;
  project_label: string | null;
  model_name: string;
  status: string;
  http_status: number | null;
  error_message: string | null;
  request_started_at: string;
  request_finished_at: string | null;
  created_at: string;
  updated_at: string;
};

type GeminiKeyDashboardRecord = {
  id: string;
  label: string;
  project_label: string | null;
  model_name: string;
  role: string;
  status: string;
  last_used_at: string | null;
  cooldown_until: string | null;
  updated_at: string;
};

type GeminiOperationsData = {
  errors: string[];
  keyStatus: DashboardKeyStatusViewModel[];
  promptPacks: PromptPackDashboardRecord[];
  quota: DashboardQuotaViewModel[];
  quotaSummary: string;
  tasks: AiTaskDashboardRecord[];
  usageIssues: GeminiUsageIssueRecord[];
};

const PRODUCT_QUERY_BATCH_SIZE = 500;
const RELATION_CHUNK_SIZE = 150;
const RECENT_TASK_LIMIT = 200;
const MAX_KEY_STATUS_ROWS = 6;
const NUMBER_FORMAT = new Intl.NumberFormat("id-ID");
const COMPACT_NUMBER_FORMAT = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 1,
  notation: "compact",
});
const TIME_FORMAT = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});

const ACTIVE_TASK_STATUSES = new Set(["QUEUED", "RUNNING", "RETRYING", "WAITING_FOR_KEY"]);
const PROBLEM_TASK_STATUSES = new Set(["FAILED", "RETRYING", "WAITING_FOR_KEY", "CANCELLED"]);
const PROBLEM_USAGE_STATUSES = new Set(["FAILED", "RATE_LIMITED"]);

const ACTION_DETAIL_COPY: Record<string, string> = {
  metadata_review: "Produk siap dicek",
  prompt_generation: "Metadata lengkap",
  batch_export: "Manifest siap export",
  output_verification: "Output perlu dicek",
};

const PIPELINE_CONTRACT: Record<
  DashboardPipelineStageKey,
  { label: string; detail: string; href: string; tone: DashboardTone }
> = {
  draft: {
    label: "Draft",
    detail: "bukti awal",
    href: "/products",
    tone: "neutral",
  },
  metadataReady: {
    label: "Metadata",
    detail: "siap prompt",
    href: "/products",
    tone: "warning",
  },
  promptReady: {
    label: "Prompt",
    detail: "siap Flow",
    href: "/prompts",
    tone: "info",
  },
  exported: {
    label: "Export",
    detail: "batch aktif",
    href: "/controller",
    tone: "info",
  },
  generated: {
    label: "Output",
    detail: "video masuk",
    href: "/controller",
    tone: "success",
  },
  done: {
    label: "Done",
    detail: "upload selesai",
    href: "/products",
    tone: "success",
  },
};

function cleanText(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim().replace(/\s+/g, " ") : null;
}

function chunkValues<T>(values: readonly T[], size = RELATION_CHUNK_SIZE) {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => cleanText(value)).filter((value): value is string => Boolean(value))));
}

function formatCount(value: number) {
  return NUMBER_FORMAT.format(value);
}

function formatQuotaNumber(value: number | null) {
  return value === null ? "-" : COMPACT_NUMBER_FORMAT.format(value);
}

function formatGeneratedAtLabel(date: Date) {
  return `Diperbarui ${TIME_FORMAT.format(date)}`;
}

function clampPercent(value: number | null) {
  return Math.min(100, Math.max(0, value ?? 0));
}

function toneForPercent(percent: number | null): DashboardTone {
  if (percent === null) {
    return "neutral";
  }

  if (percent >= 90) {
    return "danger";
  }

  if (percent >= 70) {
    return "warning";
  }

  if (percent > 0) {
    return "info";
  }

  return "success";
}

function toneForKeyStatus(status: string): DashboardTone {
  if (status === "ERROR") {
    return "danger";
  }

  if (status === "COOLDOWN" || status === "RATE_LIMITED") {
    return "warning";
  }

  if (status === "DISABLED") {
    return "neutral";
  }

  return "success";
}

function keyStatusLabel(status: string) {
  const labels: Record<string, string> = {
    ACTIVE: "Aktif",
    COOLDOWN: "Cooldown",
    RATE_LIMITED: "Rate limit",
    DISABLED: "Nonaktif",
    ERROR: "Error",
  };

  return labels[status] ?? status.replaceAll("_", " ");
}

function statusCount(tasks: readonly AiTaskDashboardRecord[], statuses: ReadonlySet<string>) {
  return tasks.filter((task) => statuses.has(task.status)).length;
}

function latestTimestamp(row: {
  request_finished_at?: string | null;
  finished_at?: string | null;
  updated_at?: string | null;
  started_at?: string | null;
  request_started_at?: string | null;
  created_at?: string | null;
}) {
  const raw =
    row.request_finished_at ??
    row.finished_at ??
    row.updated_at ??
    row.started_at ??
    row.request_started_at ??
    row.created_at ??
    "";
  const timestamp = raw ? new Date(raw).getTime() : 0;

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function byLatestTimestamp<T extends Parameters<typeof latestTimestamp>[0]>(left: T, right: T) {
  return latestTimestamp(right) - latestTimestamp(left);
}

async function loadWorkspaceProductIds(input: {
  supabase: SupabaseServerClient;
  userId: string;
  workspaceId: string | null;
}) {
  if (!input.workspaceId) {
    return [] as string[];
  }

  const productIds: string[] = [];
  let from = 0;

  while (true) {
    const to = from + PRODUCT_QUERY_BATCH_SIZE - 1;
    const { data, error } = await input.supabase
      .from("products")
      .select("id")
      .eq("user_id", input.userId)
      .eq("workspace_id", input.workspaceId)
      .neq("status", "ARCHIVED")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    const batch = ((data ?? []) as ProductIdRecord[]).map((row) => row.id).filter(Boolean);
    productIds.push(...batch);

    if (batch.length < PRODUCT_QUERY_BATCH_SIZE) {
      break;
    }

    from += PRODUCT_QUERY_BATCH_SIZE;
  }

  return Array.from(new Set(productIds));
}

async function loadWorkspacePromptPacks(input: {
  productIds: string[];
  supabase: SupabaseServerClient;
  userId: string;
}) {
  const promptPacks: PromptPackDashboardRecord[] = [];

  for (const productIds of chunkValues(input.productIds)) {
    const { data, error } = await input.supabase
      .from("prompt_packs")
      .select("id, ai_task_id, product_id, status, error_message, created_at, updated_at")
      .eq("user_id", input.userId)
      .in("product_id", productIds)
      .neq("status", "ARCHIVED")
      .order("updated_at", { ascending: false })
      .limit(RECENT_TASK_LIMIT);

    if (error) {
      throw new Error(error.message);
    }

    promptPacks.push(...((data ?? []) as PromptPackDashboardRecord[]));
  }

  return promptPacks;
}

async function loadWorkspaceAiTasks(input: {
  promptPacks: PromptPackDashboardRecord[];
  supabase: SupabaseServerClient;
  userId: string;
}) {
  const taskIds = uniqueValues(input.promptPacks.map((promptPack) => promptPack.ai_task_id));

  if (!taskIds.length) {
    return [] as AiTaskDashboardRecord[];
  }

  const tasksById = new Map<string, AiTaskDashboardRecord>();

  for (const ids of chunkValues(taskIds)) {
    const { data, error } = await input.supabase
      .from("ai_tasks")
      .select(
        "id, gemini_api_key_id, task_type, status, error_message, retry_count, started_at, finished_at, created_at, updated_at",
      )
      .eq("user_id", input.userId)
      .in("id", ids)
      .order("updated_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    for (const task of (data ?? []) as AiTaskDashboardRecord[]) {
      tasksById.set(task.id, task);
    }
  }

  return Array.from(tasksById.values()).sort(byLatestTimestamp);
}

async function loadUsageIssuesForTasks(input: {
  taskIds: string[];
  supabase: SupabaseServerClient;
  userId: string;
}) {
  if (!input.taskIds.length) {
    return [] as GeminiUsageIssueRecord[];
  }

  const issues: GeminiUsageIssueRecord[] = [];

  for (const taskIds of chunkValues(input.taskIds)) {
    const { data, error } = await input.supabase
      .from("gemini_api_usage_events")
      .select(
        "id, ai_task_id, project_label, model_name, status, http_status, error_message, request_started_at, request_finished_at, created_at, updated_at",
      )
      .eq("user_id", input.userId)
      .in("ai_task_id", taskIds)
      .in("status", [...PROBLEM_USAGE_STATUSES])
      .order("request_started_at", { ascending: false })
      .limit(RECENT_TASK_LIMIT);

    if (error) {
      throw new Error(error.message);
    }

    issues.push(...((data ?? []) as GeminiUsageIssueRecord[]));
  }

  return issues.sort(byLatestTimestamp);
}

async function loadGeminiKeyStatus(input: { supabase: SupabaseServerClient; userId: string }) {
  const { data, error } = await input.supabase
    .from("gemini_api_keys")
    .select("id, label, project_label, model_name, role, status, last_used_at, cooldown_until, updated_at")
    .eq("user_id", input.userId)
    .neq("status", "DISABLED")
    .order("updated_at", { ascending: false })
    .limit(MAX_KEY_STATUS_ROWS);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as GeminiKeyDashboardRecord[]).map((key) => {
    const projectLabel = cleanText(key.project_label);
    const modelLabel = getGeminiModelLabel(key.model_name);

    return {
      id: key.id,
      label: cleanText(key.label) ?? modelLabel,
      meta: projectLabel ? `${projectLabel} / ${modelLabel}` : modelLabel,
      status: keyStatusLabel(key.status),
      tone: toneForKeyStatus(key.status),
    } satisfies DashboardKeyStatusViewModel;
  });
}

function quotaRowsFromCard(card: GeminiUsageCard): DashboardQuotaViewModel[] {
  const metrics: GeminiUsageMetric[] = [card.rpd, card.rpm, card.tpm];

  return metrics.map((metric) => {
    const percent = clampPercent(metric.percent);

    return {
      id: metric.label.toLowerCase(),
      label: metric.label,
      used: formatQuotaNumber(metric.used),
      limit: formatQuotaNumber(metric.limit),
      percent,
      tone: toneForPercent(metric.percent),
    };
  });
}

function pressureScore(card: GeminiUsageCard) {
  return Math.max(card.rpd.percent ?? 0, card.rpm.percent ?? 0, card.tpm.percent ?? 0);
}

function buildQuotaViewModel(cards: GeminiUsageCard[]) {
  if (!cards.length) {
    return {
      quota: [] as DashboardQuotaViewModel[],
      quotaSummary: "Hari ini",
    };
  }

  const selectedCard = [...cards].sort((left, right) => pressureScore(right) - pressureScore(left))[0];

  return {
    quota: quotaRowsFromCard(selectedCard),
    quotaSummary: selectedCard.groupLabel,
  };
}

async function loadGeminiOperationsData(input: {
  supabase: SupabaseServerClient;
  userId: string;
  workspaceId: string | null;
}): Promise<GeminiOperationsData> {
  const errors: string[] = [];
  let promptPacks: PromptPackDashboardRecord[] = [];
  let tasks: AiTaskDashboardRecord[] = [];
  let usageIssues: GeminiUsageIssueRecord[] = [];
  let keyStatus: DashboardKeyStatusViewModel[] = [];
  let quota: DashboardQuotaViewModel[] = [];
  let quotaSummary = "Hari ini";

  try {
    const productIds = await loadWorkspaceProductIds(input);
    promptPacks = productIds.length
      ? await loadWorkspacePromptPacks({
          productIds,
          supabase: input.supabase,
          userId: input.userId,
        })
      : [];
    tasks = await loadWorkspaceAiTasks({
      promptPacks,
      supabase: input.supabase,
      userId: input.userId,
    });
    usageIssues = await loadUsageIssuesForTasks({
      taskIds: tasks.map((task) => task.id),
      supabase: input.supabase,
      userId: input.userId,
    });
  } catch {
    errors.push("Task Gemini workspace tidak tersedia.");
  }

  try {
    keyStatus = await loadGeminiKeyStatus(input);
  } catch {
    errors.push("Status key Gemini tidak tersedia.");
  }

  try {
    const usageOverview = await getGeminiUsageOverview(input.userId);
    const quotaViewModel = buildQuotaViewModel(usageOverview.cards);
    quota = quotaViewModel.quota;
    quotaSummary = usageOverview.unavailableMessage ? "Usage terbatas" : quotaViewModel.quotaSummary;

    if (usageOverview.unavailableMessage) {
      errors.push("Usage Gemini belum tersedia.");
    }
  } catch {
    errors.push("Usage Gemini belum tersedia.");
  }

  return {
    errors,
    keyStatus,
    promptPacks,
    quota,
    quotaSummary,
    tasks,
    usageIssues,
  };
}

function buildHealthMetrics(tasks: AiTaskDashboardRecord[]): DashboardMetricViewModel[] {
  const queuedCount = tasks.filter((task) => task.status === "QUEUED").length;
  const runningCount = tasks.filter((task) => task.status === "RUNNING").length;
  const retryingCount = tasks.filter((task) => task.status === "RETRYING").length;
  const waitingForKeyCount = tasks.filter((task) => task.status === "WAITING_FOR_KEY").length;
  const failedCount = tasks.filter((task) => task.status === "FAILED").length;
  const cancelledCount = tasks.filter((task) => task.status === "CANCELLED").length;
  const activeCount = statusCount(tasks, ACTIVE_TASK_STATUSES);

  return [
    {
      id: "active",
      label: "Task aktif",
      value: formatCount(activeCount),
      detail: `${formatCount(runningCount)} berjalan, ${formatCount(queuedCount)} antre`,
      tone: activeCount > 0 ? "info" : "neutral",
    },
    {
      id: "waiting",
      label: "Menunggu key",
      value: formatCount(waitingForKeyCount),
      detail: retryingCount > 0 ? `${formatCount(retryingCount)} retry` : "Tidak ada tunggu key",
      tone: waitingForKeyCount > 0 ? "warning" : "success",
    },
    {
      id: "failed",
      label: "Masalah",
      value: formatCount(failedCount + cancelledCount),
      detail: `${formatCount(failedCount)} gagal, ${formatCount(cancelledCount)} batal`,
      tone: failedCount > 0 ? "danger" : cancelledCount > 0 ? "warning" : "success",
    },
  ];
}

function hrefForTaskType(taskType: string) {
  if (taskType === "PROMPT_PACK_GENERATION" || taskType === "I2I_PROMPT" || taskType === "I2V_PROMPT") {
    return "/prompts";
  }

  if (taskType === "VISION_ANALYSIS") {
    return "/products/new";
  }

  return "/dashboard";
}

function taskIssueTitle(task: AiTaskDashboardRecord) {
  if (task.status === "WAITING_FOR_KEY") {
    return "Task menunggu key";
  }

  if (task.status === "RETRYING") {
    return "Task dicoba ulang";
  }

  if (task.status === "CANCELLED") {
    return "Task dibatalkan";
  }

  return "Task Gemini gagal";
}

function safeMessage(value: string | null | undefined, fallback: string) {
  const normalized = cleanText(value) ?? fallback;

  return normalized.length > 160 ? `${normalized.slice(0, 157).trimEnd()}...` : normalized;
}

function buildRecentIssue(data: GeminiOperationsData): DashboardIssueViewModel {
  const taskIssue = [...data.tasks].filter((task) => PROBLEM_TASK_STATUSES.has(task.status)).sort(byLatestTimestamp)[0] ?? null;

  if (taskIssue) {
    return {
      title: taskIssueTitle(taskIssue),
      message: safeMessage(taskIssue.error_message, `${taskIssue.task_type} berstatus ${taskIssue.status}.`),
      href: hrefForTaskType(taskIssue.task_type),
      actionLabel: taskIssue.task_type === "VISION_ANALYSIS" ? "Buka Intake" : "Buka Prompt",
      tone: taskIssue.status === "FAILED" ? "danger" : "warning",
    };
  }

  const promptPackIssue =
    [...data.promptPacks]
      .filter((promptPack) => promptPack.status === "ERROR" || cleanText(promptPack.error_message))
      .sort(byLatestTimestamp)[0] ?? null;

  if (promptPackIssue) {
    return {
      title: "Paket prompt bermasalah",
      message: safeMessage(promptPackIssue.error_message, `Prompt pack berstatus ${promptPackIssue.status}.`),
      href: `/prompts?detail=${encodeURIComponent(promptPackIssue.id)}`,
      actionLabel: "Buka Prompt",
      tone: promptPackIssue.status === "ERROR" ? "danger" : "warning",
    };
  }

  const usageIssue = data.usageIssues[0] ?? null;

  if (usageIssue) {
    const statusCopy = usageIssue.http_status ? `${usageIssue.status} ${usageIssue.http_status}` : usageIssue.status;

    return {
      title: usageIssue.status === "RATE_LIMITED" ? "Gemini rate limit" : "Request Gemini gagal",
      message: safeMessage(usageIssue.error_message, `${getGeminiModelLabel(usageIssue.model_name)} ${statusCopy}.`),
      href: "/settings/gemini",
      actionLabel: "Buka Key",
      tone: usageIssue.status === "RATE_LIMITED" ? "warning" : "danger",
    };
  }

  if (data.errors.length) {
    return {
      title: "Data Gemini terbatas",
      message: data.errors[0],
      tone: "warning",
    };
  }

  return {
    title: "Tidak ada masalah terbaru",
    message: "Task dan key Gemini tidak melaporkan error terbaru.",
    tone: "success",
  };
}

function buildGeminiStatus(data: GeminiOperationsData) {
  const failedCount = data.tasks.filter((task) => task.status === "FAILED").length;
  const waitingForKeyCount = data.tasks.filter((task) => task.status === "WAITING_FOR_KEY").length;
  const activeCount = statusCount(data.tasks, ACTIVE_TASK_STATUSES);
  const keyDangerCount = data.keyStatus.filter((key) => key.tone === "danger").length;
  const keyWarningCount = data.keyStatus.filter((key) => key.tone === "warning").length;

  if (data.errors.length) {
    return {
      status: "Data terbatas",
      tone: "warning" as const,
    };
  }

  if (failedCount > 0 || keyDangerCount > 0) {
    return {
      status: "Perlu aksi",
      tone: "danger" as const,
    };
  }

  if (waitingForKeyCount > 0 || keyWarningCount > 0) {
    return {
      status: "Perlu aksi",
      tone: "warning" as const,
    };
  }

  if (activeCount > 0) {
    return {
      status: "Berjalan",
      tone: "info" as const,
    };
  }

  return {
    status: "Stabil",
    tone: "success" as const,
  };
}

function buildGeminiOperationsViewModel(data: GeminiOperationsData): DashboardViewModel["geminiOperations"] {
  const status = buildGeminiStatus(data);

  return {
    title: "Gemini operations",
    status: status.status,
    tone: status.tone,
    errorMessage: data.errors.length ? data.errors.join(" ") : null,
    health: buildHealthMetrics(data.tasks),
    quota: data.quota,
    quotaSummary: data.quotaSummary,
    recentIssue: buildRecentIssue(data),
    keyStatus: data.keyStatus,
    keyStatusSummary: data.keyStatus.length ? `${formatCount(data.keyStatus.length)} key` : "0 key",
  };
}

function toneForActionType(type: string): DashboardTone {
  if (type === "metadata_review") {
    return "warning";
  }

  if (type === "output_verification") {
    return "danger";
  }

  if (type === "batch_export") {
    return "success";
  }

  return "info";
}

async function buildActionQueueViewModel(input: { workspaceId: string | null }): Promise<DashboardViewModel["actionQueue"]> {
  const result = await getDashboardActionQueue({
    workspaceId: input.workspaceId,
  });

  return {
    title: "Action queue",
    status: result.status,
    errorMessage: result.errors.length ? result.errors.map((error) => error.message).join(" ") : null,
    items: result.items.map((item) => ({
      id: item.type,
      label: item.label,
      detail: ACTION_DETAIL_COPY[item.type] ?? "Butuh tindakan",
      count: formatCount(item.count),
      href: item.href,
      tone: toneForActionType(item.type),
    })),
  };
}

function buildPipelineStages(input: {
  counts: Record<DashboardPipelineStageKey, number>;
  total: number;
}): DashboardPipelineStageViewModel[] {
  return (Object.keys(PIPELINE_CONTRACT) as DashboardPipelineStageKey[])
    .map((key) => {
      const count = input.counts[key] ?? 0;
      const contract = PIPELINE_CONTRACT[key];

      return {
        id: key,
        label: contract.label,
        count: formatCount(count),
        detail: contract.detail,
        href: contract.href,
        percent: input.total > 0 ? Math.round((count / input.total) * 100) : 0,
        tone: count > 0 ? contract.tone : "neutral",
      };
    })
    .filter((stage) => stage.count !== "0");
}

async function buildPipelineViewModel(input: { workspaceId: string | null }): Promise<DashboardViewModel["pipeline"]> {
  const result = await getDashboardPipelineStageCounts({
    workspaceId: input.workspaceId,
  });

  return {
    title: "Pipeline",
    status: result.status,
    errorMessage: result.status === "unavailable" ? result.message : null,
    total: `${formatCount(result.total)} produk`,
    stages: result.status === "available" ? buildPipelineStages(result) : [],
  };
}

async function resolveWorkspaceId() {
  try {
    return (await getCurrentWorkspace())?.id ?? null;
  } catch {
    return null;
  }
}

export async function getDashboardViewModel(input: { userId: string }): Promise<DashboardViewModel> {
  const generatedAt = new Date();
  const supabase = await createSupabaseServerClient();
  const workspaceId = await resolveWorkspaceId();
  const [geminiData, actionQueue, pipeline] = await Promise.all([
    loadGeminiOperationsData({
      supabase,
      userId: input.userId,
      workspaceId,
    }),
    buildActionQueueViewModel({
      workspaceId,
    }),
    buildPipelineViewModel({
      workspaceId,
    }),
  ]);

  return {
    source: "server",
    generatedAtLabel: formatGeneratedAtLabel(generatedAt),
    workspaceId,
    geminiOperations: buildGeminiOperationsViewModel(geminiData),
    actionQueue,
    pipeline,
  };
}
