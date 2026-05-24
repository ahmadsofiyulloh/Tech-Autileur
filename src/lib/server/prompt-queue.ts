import "server-only";

import { runMockPromptPackTask, runRealPromptPackTask } from "@/lib/server/prompt-packs";
import { getCurrentWorkspace } from "@/lib/server/workspaces";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  EMPTY_PROMPT_QUEUE_SUMMARY,
  type PromptQueueItem,
  type PromptQueueItemCategory,
  type PromptQueueSnapshot,
  type PromptQueueSummary,
  type PromptQueueTaskStatus,
} from "@/lib/prompts/prompt-queue-contract";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type ProductRecord = {
  id: string;
  product_code: string;
  product_name: string;
};

type PromptPackRecord = {
  id: string;
  product_id: string;
  prompt_code: string;
  version: number;
  status: string;
  ai_task_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type AiTaskRecord = {
  id: string;
  task_type: string;
  status: string;
  input_json: Record<string, unknown> | null;
  error_message: string | null;
  gemini_api_key_id: string | null;
  retry_count: number | null;
  max_retries: number | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

type GeminiKeyRecord = {
  id: string;
  label: string;
  model_name: string;
};

const PROMPT_QUEUE_PRODUCT_BATCH_SIZE = 1000;
const PROMPT_QUEUE_QUERY_CHUNK_SIZE = 200;
const PROMPT_QUEUE_RANGE_SIZE = 1000;
const PROMPT_QUEUE_DEFAULT_LIMIT = 50;
const PROMPT_QUEUE_MAX_LIMIT = 100;
const TRACKED_PROMPT_PACK_STATUSES = ["QUEUED", "GENERATING", "GENERATED", "ERROR"];
const RUNNABLE_TASK_STATUSES = new Set(["QUEUED", "RETRYING", "WAITING_FOR_KEY"]);
const CANCELABLE_TASK_STATUSES = new Set(["QUEUED", "RETRYING", "WAITING_FOR_KEY"]);
const ACTIVE_TASK_STATUSES = new Set(["QUEUED", "RUNNING", "RETRYING", "WAITING_FOR_KEY"]);

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  return { supabase, userId: user.id };
}

function chunkValues<T>(values: readonly T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

function clampLimit(value: number | undefined) {
  if (!Number.isInteger(value)) {
    return PROMPT_QUEUE_DEFAULT_LIMIT;
  }

  return Math.min(Math.max(value ?? PROMPT_QUEUE_DEFAULT_LIMIT, 1), PROMPT_QUEUE_MAX_LIMIT);
}

async function resolveWorkspaceId(workspaceId: string | null | undefined) {
  if (workspaceId !== undefined) {
    return workspaceId;
  }

  return (await getCurrentWorkspace())?.id ?? null;
}

async function listWorkspaceProducts(input: {
  supabase: SupabaseServerClient;
  userId: string;
  workspaceId?: string | null;
}) {
  const products: ProductRecord[] = [];
  let from = 0;

  while (true) {
    const to = from + PROMPT_QUEUE_PRODUCT_BATCH_SIZE - 1;
    let query = input.supabase
      .from("products")
      .select("id, product_code, product_name")
      .eq("user_id", input.userId)
      .neq("status", "ARCHIVED")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (input.workspaceId) {
      query = query.eq("workspace_id", input.workspaceId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    const batch = (data ?? []) as ProductRecord[];
    products.push(...batch);

    if (batch.length < PROMPT_QUEUE_PRODUCT_BATCH_SIZE) {
      break;
    }

    from += PROMPT_QUEUE_PRODUCT_BATCH_SIZE;
  }

  return products;
}

async function listPromptPacksForProductChunk(input: {
  supabase: SupabaseServerClient;
  userId: string;
  productIds: string[];
}) {
  const promptPacks: PromptPackRecord[] = [];
  let from = 0;

  while (true) {
    const to = from + PROMPT_QUEUE_RANGE_SIZE - 1;
    const { data, error } = await input.supabase
      .from("prompt_packs")
      .select("id, product_id, prompt_code, version, status, ai_task_id, error_message, created_at, updated_at")
      .eq("user_id", input.userId)
      .in("product_id", input.productIds)
      .in("status", TRACKED_PROMPT_PACK_STATUSES)
      .order("updated_at", { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    const batch = (data ?? []) as PromptPackRecord[];
    promptPacks.push(...batch);

    if (batch.length < PROMPT_QUEUE_RANGE_SIZE) {
      break;
    }

    from += PROMPT_QUEUE_RANGE_SIZE;
  }

  return promptPacks;
}

async function listPromptPacksForProducts(input: {
  supabase: SupabaseServerClient;
  userId: string;
  productIds: string[];
}) {
  const promptPacks: PromptPackRecord[] = [];

  for (const productIdChunk of chunkValues(input.productIds, PROMPT_QUEUE_QUERY_CHUNK_SIZE)) {
    promptPacks.push(
      ...(await listPromptPacksForProductChunk({
        supabase: input.supabase,
        userId: input.userId,
        productIds: productIdChunk,
      })),
    );
  }

  return promptPacks;
}

async function listTasksByIds(input: {
  supabase: SupabaseServerClient;
  userId: string;
  taskIds: string[];
}) {
  const tasks: AiTaskRecord[] = [];

  for (const taskIdChunk of chunkValues(input.taskIds, PROMPT_QUEUE_QUERY_CHUNK_SIZE)) {
    const { data, error } = await input.supabase
      .from("ai_tasks")
      .select(
        "id, task_type, status, input_json, error_message, gemini_api_key_id, retry_count, max_retries, started_at, finished_at, created_at, updated_at",
      )
      .eq("user_id", input.userId)
      .in("id", taskIdChunk);

    if (error) {
      throw new Error(error.message);
    }

    tasks.push(...((data ?? []) as AiTaskRecord[]));
  }

  return tasks;
}

async function listGeminiKeysByIds(input: {
  supabase: SupabaseServerClient;
  userId: string;
  geminiKeyIds: string[];
}) {
  const keys: GeminiKeyRecord[] = [];

  for (const keyIdChunk of chunkValues(input.geminiKeyIds, PROMPT_QUEUE_QUERY_CHUNK_SIZE)) {
    const { data, error } = await input.supabase
      .from("gemini_api_keys")
      .select("id, label, model_name")
      .eq("user_id", input.userId)
      .in("id", keyIdChunk);

    if (error) {
      throw new Error(error.message);
    }

    keys.push(...((data ?? []) as GeminiKeyRecord[]));
  }

  return keys;
}

function normalizeTaskStatus(value: string | null | undefined): PromptQueueTaskStatus {
  if (
    value === "QUEUED" ||
    value === "RUNNING" ||
    value === "SUCCESS" ||
    value === "FAILED" ||
    value === "RETRYING" ||
    value === "WAITING_FOR_KEY" ||
    value === "CANCELLED"
  ) {
    return value;
  }

  return "UNKNOWN";
}

function deriveTaskStatus(promptPack: PromptPackRecord, task: AiTaskRecord | null) {
  if (task?.status) {
    return normalizeTaskStatus(task.status);
  }

  if (promptPack.status === "GENERATED") {
    return "SUCCESS";
  }

  if (promptPack.status === "ERROR") {
    return "FAILED";
  }

  if (promptPack.status === "GENERATING") {
    return "RUNNING";
  }

  if (promptPack.status === "QUEUED") {
    return "QUEUED";
  }

  return "UNKNOWN";
}

function deriveCategory(promptPack: PromptPackRecord, taskStatus: PromptQueueTaskStatus): PromptQueueItemCategory {
  if (taskStatus === "RUNNING") {
    return "running";
  }

  if (taskStatus === "QUEUED" || taskStatus === "RETRYING" || taskStatus === "WAITING_FOR_KEY") {
    return "waiting";
  }

  if (taskStatus === "FAILED" || promptPack.status === "ERROR") {
    return "failed";
  }

  return "generated";
}

function incrementSummary(summary: PromptQueueSummary, item: PromptQueueItem) {
  if (item.task.status === "QUEUED") {
    summary.queued += 1;
  } else if (item.task.status === "RUNNING") {
    summary.running += 1;
  } else if (item.task.status === "RETRYING") {
    summary.retrying += 1;
  } else if (item.task.status === "WAITING_FOR_KEY") {
    summary.waitingForKey += 1;
  } else if (item.task.status === "FAILED" || item.promptPack.status === "ERROR") {
    summary.failed += 1;
  } else if (item.task.status === "SUCCESS" || item.promptPack.status === "GENERATED") {
    summary.generated += 1;
  }

  summary.totalTracked += 1;
}

function getItemSortPriority(item: PromptQueueItem) {
  if (item.category === "running") {
    return 0;
  }

  if (item.task.status === "QUEUED") {
    return 1;
  }

  if (item.task.status === "RETRYING") {
    return 2;
  }

  if (item.task.status === "WAITING_FOR_KEY") {
    return 3;
  }

  if (item.category === "failed") {
    return 4;
  }

  return 5;
}

function compareQueueItems(left: PromptQueueItem, right: PromptQueueItem) {
  const priorityDelta = getItemSortPriority(left) - getItemSortPriority(right);

  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  if (left.category === "generated" && right.category === "generated") {
    return new Date(right.promptPack.updated_at).getTime() - new Date(left.promptPack.updated_at).getTime();
  }

  const leftCreatedAt = left.task.created_at ?? left.promptPack.created_at;
  const rightCreatedAt = right.task.created_at ?? right.promptPack.created_at;

  return new Date(leftCreatedAt).getTime() - new Date(rightCreatedAt).getTime();
}

function readGenerationMode(input: Record<string, unknown> | null) {
  return input?.mode === "mock" ? "mock" : "gemini";
}

function buildPromptQueueItem(input: {
  promptPack: PromptPackRecord;
  product: ProductRecord;
  task: AiTaskRecord | null;
  geminiKey: GeminiKeyRecord | null;
}): PromptQueueItem {
  const taskStatus = deriveTaskStatus(input.promptPack, input.task);
  const category = deriveCategory(input.promptPack, taskStatus);

  return {
    id: input.promptPack.id,
    category,
    promptPack: {
      id: input.promptPack.id,
      product_id: input.promptPack.product_id,
      prompt_code: input.promptPack.prompt_code,
      version: input.promptPack.version,
      status: input.promptPack.status,
      error_message: input.promptPack.error_message,
      created_at: input.promptPack.created_at,
      updated_at: input.promptPack.updated_at,
    },
    product: {
      id: input.product.id,
      product_code: input.product.product_code,
      product_name: input.product.product_name,
    },
    task: {
      id: input.task?.id ?? null,
      status: taskStatus,
      error_message: input.task?.error_message ?? input.promptPack.error_message ?? null,
      retry_count: input.task?.retry_count ?? 0,
      max_retries: input.task?.max_retries ?? 0,
      started_at: input.task?.started_at ?? null,
      finished_at: input.task?.finished_at ?? null,
      created_at: input.task?.created_at ?? null,
      updated_at: input.task?.updated_at ?? null,
    },
    geminiKey: {
      id: input.geminiKey?.id ?? input.task?.gemini_api_key_id ?? null,
      label: input.geminiKey?.label ?? null,
      model_name: input.geminiKey?.model_name ?? null,
    },
    canCancel: Boolean(input.task?.id && CANCELABLE_TASK_STATUSES.has(taskStatus)),
    canRetry:
      taskStatus === "FAILED" ||
      taskStatus === "WAITING_FOR_KEY" ||
      input.promptPack.status === "ERROR",
  };
}

export async function listPromptQueueSnapshot(input?: {
  workspaceId?: string | null;
  limit?: number;
}): Promise<PromptQueueSnapshot> {
  const { supabase, userId } = await requireUser();
  const workspaceId = await resolveWorkspaceId(input?.workspaceId);
  const limit = clampLimit(input?.limit);
  const products = await listWorkspaceProducts({ supabase, userId, workspaceId });
  const productMap = new Map(products.map((product) => [product.id, product]));

  if (!products.length) {
    return {
      generatedAt: new Date().toISOString(),
      summary: { ...EMPTY_PROMPT_QUEUE_SUMMARY },
      items: [],
      nextRunnablePromptPackId: null,
      runningPromptPackId: null,
    };
  }

  const promptPacks = await listPromptPacksForProducts({
    supabase,
    userId,
    productIds: products.map((product) => product.id),
  });
  const taskIds = Array.from(
    new Set(promptPacks.map((promptPack) => promptPack.ai_task_id).filter((value): value is string => Boolean(value))),
  );
  const tasks = taskIds.length ? await listTasksByIds({ supabase, userId, taskIds }) : [];
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const geminiKeyIds = Array.from(
    new Set(tasks.map((task) => task.gemini_api_key_id).filter((value): value is string => Boolean(value))),
  );
  const geminiKeys = geminiKeyIds.length ? await listGeminiKeysByIds({ supabase, userId, geminiKeyIds }) : [];
  const geminiKeyMap = new Map(geminiKeys.map((key) => [key.id, key]));
  const summary: PromptQueueSummary = { ...EMPTY_PROMPT_QUEUE_SUMMARY };
  const allItems = promptPacks
    .map((promptPack) => {
      const product = productMap.get(promptPack.product_id);

      if (!product) {
        return null;
      }

      const task = promptPack.ai_task_id ? taskMap.get(promptPack.ai_task_id) ?? null : null;
      const geminiKey = task?.gemini_api_key_id ? geminiKeyMap.get(task.gemini_api_key_id) ?? null : null;

      return buildPromptQueueItem({ promptPack, product, task, geminiKey });
    })
    .filter((item): item is PromptQueueItem => Boolean(item));

  for (const item of allItems) {
    incrementSummary(summary, item);
  }

  allItems.sort(compareQueueItems);

  const runningPromptPackId = allItems.find((item) => item.task.status === "RUNNING")?.promptPack.id ?? null;
  const nextRunnablePromptPackId =
    allItems.find((item) => RUNNABLE_TASK_STATUSES.has(item.task.status) && item.task.id)?.promptPack.id ?? null;

  return {
    generatedAt: new Date().toISOString(),
    summary,
    items: allItems.slice(0, limit),
    nextRunnablePromptPackId,
    runningPromptPackId,
  };
}

export async function runNextPromptQueueTask(input?: { workspaceId?: string | null }) {
  const snapshot = await listPromptQueueSnapshot({ workspaceId: input?.workspaceId, limit: PROMPT_QUEUE_MAX_LIMIT });

  if (snapshot.runningPromptPackId) {
    return {
      started: false,
      reason: "RUNNING",
      promptPackId: snapshot.runningPromptPackId,
      snapshot,
    };
  }

  const nextPromptPackId = snapshot.nextRunnablePromptPackId;

  if (!nextPromptPackId) {
    return {
      started: false,
      reason: "EMPTY",
      promptPackId: null,
      snapshot,
    };
  }

  const { supabase, userId } = await requireUser();
  const { data: promptPack, error: promptPackError } = await supabase
    .from("prompt_packs")
    .select("id, ai_task_id")
    .eq("id", nextPromptPackId)
    .eq("user_id", userId)
    .maybeSingle();

  if (promptPackError) {
    throw new Error(promptPackError.message);
  }

  if (!promptPack?.ai_task_id) {
    throw new Error("Prompt generation task not ready.");
  }

  const { data: task, error: taskError } = await supabase
    .from("ai_tasks")
    .select("id, status, input_json")
    .eq("id", promptPack.ai_task_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (taskError) {
    throw new Error(taskError.message);
  }

  const typedTask = task as Pick<AiTaskRecord, "id" | "status" | "input_json"> | null;

  if (!typedTask) {
    throw new Error("Prompt generation task not found.");
  }

  if (!RUNNABLE_TASK_STATUSES.has(typedTask.status)) {
    return {
      started: false,
      reason: typedTask.status,
      promptPackId: nextPromptPackId,
      snapshot: await listPromptQueueSnapshot({ workspaceId: input?.workspaceId, limit: PROMPT_QUEUE_MAX_LIMIT }),
    };
  }

  const generationMode = readGenerationMode(typedTask.input_json);
  const result =
    generationMode === "mock"
      ? await runMockPromptPackTask(nextPromptPackId, typedTask.id)
      : await runRealPromptPackTask(nextPromptPackId, typedTask.id);

  return {
    started: true,
    reason: result.task.status,
    promptPackId: result.promptPack.id,
    message: result.message,
    snapshot: await listPromptQueueSnapshot({ workspaceId: input?.workspaceId, limit: PROMPT_QUEUE_MAX_LIMIT }),
  };
}

export function countActivePromptQueueTasks(summary: PromptQueueSummary) {
  return summary.queued + summary.running + summary.retrying + summary.waitingForKey;
}

export function hasActivePromptQueueTaskStatus(status: string | null | undefined) {
  return ACTIVE_TASK_STATUSES.has(status ?? "");
}
