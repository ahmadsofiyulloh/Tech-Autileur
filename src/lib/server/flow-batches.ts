import "server-only";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace, getWorkspaceById } from "@/lib/server/workspaces";
import { getProductById } from "@/lib/server/products";
import { getPromptPackById } from "@/lib/server/prompt-packs";

export const FLOW_BATCH_STATUSES = [
  "DRAFT",
  "READY_TO_EXPORT",
  "EXPORTED",
  "RUNNING",
  "IMPORTING",
  "PARTIALLY_IMPORTED",
  "IMPORTED",
  "NEED_MANUAL_MATCH",
  "CLOSED",
] as const;

export type FlowBatchStatus = (typeof FLOW_BATCH_STATUSES)[number];

export type FlowBatchRecord = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  product_id: string | null;
  prompt_pack_id: string | null;
  batch_code: string;
  flow_account_id: string;
  target_date: string;
  model: string;
  max_jobs: number;
  drive_output_folder_url: string | null;
  drive_output_folder_id: string | null;
  flow_url: string | null;
  helper_output_folder_key: string | null;
  manifest_json: unknown | null;
  last_helper_event_at: string | null;
  status: FlowBatchStatus;
  created_at: string;
  updated_at: string;
};

type FlowBatchInput = {
  workspace_id?: string | null;
  product_id?: string | null;
  prompt_pack_id?: string | null;
  batch_code?: string;
  flow_account_id: string;
  target_date?: string;
  model?: string;
  max_jobs?: number | string;
  drive_output_folder_url?: string | null;
  drive_output_folder_id?: string | null;
  flow_url?: string | null;
  helper_output_folder_key?: string | null;
  status?: FlowBatchStatus | string;
};

type FlowBatchUpdateInput = Partial<Omit<FlowBatchInput, "flow_account_id">> & {
  flow_account_id?: string;
  manifest_json?: unknown | null;
  last_helper_event_at?: string | null;
};

type BatchState = {
  id: string;
  flow_account_id: string;
  status: FlowBatchStatus;
  max_jobs: number;
  target_date: string;
};

const OPEN_FLOW_BATCH_STATUSES = new Set<FlowBatchStatus>([
  "DRAFT",
  "READY_TO_EXPORT",
  "EXPORTED",
  "RUNNING",
  "IMPORTING",
  "PARTIALLY_IMPORTED",
  "NEED_MANUAL_MATCH",
]);

function readText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableText(value: string | null | undefined) {
  const trimmed = readText(value);
  return trimmed.length > 0 ? trimmed : null;
}

function todayInJakarta() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}

function normalizeDate(value: string | null | undefined) {
  const trimmed = readText(value);

  if (!trimmed) {
    return todayInJakarta();
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed) || Number.isNaN(Date.parse(`${trimmed}T00:00:00Z`))) {
    throw new Error("target_date must use YYYY-MM-DD format.");
  }

  return trimmed;
}

function parsePositiveInt(value: number | string | null | undefined, fieldName: string, fallback: number) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${fieldName} must be a whole number greater than zero.`);
  }

  return parsed;
}

function assertFlowBatchStatus(value: string): asserts value is FlowBatchStatus {
  if (!(FLOW_BATCH_STATUSES as readonly string[]).includes(value)) {
    throw new Error(`Invalid flow batch status. Expected one of: ${FLOW_BATCH_STATUSES.join(", ")}.`);
  }
}

function normalizeBatchCode(value: string) {
  const trimmed = readText(value);

  if (!trimmed) {
    throw new Error("Batch code is required.");
  }

  return trimmed.toUpperCase();
}

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  return { supabase, user };
}

async function requireOwnedFlowAccount(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string, accountId: string) {
  const { data, error } = await supabase
    .from("flow_accounts")
    .select("id, user_id, account_code, account_type, observed_daily_credit, observed_monthly_credit, credit_per_generation, max_parallel_allowed, cooldown_minutes, status, notes, created_at, updated_at")
    .eq("id", accountId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Flow account not found.");
  }

  return data as {
    id: string;
    user_id: string;
    account_code: string;
    account_type: string;
    observed_daily_credit: number;
    observed_monthly_credit: number | null;
    credit_per_generation: number;
    max_parallel_allowed: number;
    cooldown_minutes: number;
    status: string;
    notes: string | null;
    created_at: string;
    updated_at: string;
  };
}

async function resolveBatchReferences(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  input: FlowBatchInput,
) {
  const promptPackId = normalizeNullableText(input.prompt_pack_id);
  const productIdInput = normalizeNullableText(input.product_id);
  const workspaceIdInput = normalizeNullableText(input.workspace_id);

  const promptPack = promptPackId ? ((await getPromptPackById(promptPackId)) as { id: string; product_id: string; prompt_code: string }) : null;
  const productId = productIdInput ?? promptPack?.product_id ?? null;
  const product = productId ? await getProductById(productId) : null;

  if (productId && !product) {
    throw new Error("Product not found.");
  }

  if (promptPack && product && promptPack.product_id !== product.id) {
    throw new Error("Prompt pack must belong to the selected product.");
  }

  const currentWorkspace = await getCurrentWorkspace();
  const workspaceId = workspaceIdInput ?? product?.workspace_id ?? currentWorkspace?.id ?? null;

  if (workspaceId) {
    const workspace = await getWorkspaceById(workspaceId);

    if (!workspace) {
      throw new Error("Workspace not found.");
    }

    if (product?.workspace_id && product.workspace_id !== workspace.id) {
      throw new Error("Product must belong to the selected workspace.");
    }
  }

  const flowAccountId = readText(input.flow_account_id);
  if (!flowAccountId) {
    throw new Error("Flow account is required.");
  }

  await requireOwnedFlowAccount(supabase, userId, flowAccountId);

  return {
    workspace_id: workspaceId,
    product_id: product?.id ?? null,
    prompt_pack_id: promptPack?.id ?? null,
    prompt_pack_code: promptPack?.prompt_code ?? null,
    product_code: product?.product_code ?? null,
    flow_account: await requireOwnedFlowAccount(supabase, userId, flowAccountId),
  };
}

export function buildFlowBatchCode(input: {
  promptPackCode?: string | null;
  accountCode?: string | null;
  targetDate?: string | null;
}) {
  const parts = [input.targetDate?.replaceAll("-", ""), input.promptPackCode, input.accountCode]
    .map((part) => readText(part))
    .filter(Boolean)
    .map((part) => part.replace(/[^A-Za-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""));

  const prefix = parts.length ? parts.join("-") : "FLOW-BATCH";
  return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function listFlowBatches(input?: {
  workspaceId?: string | null;
  productId?: string | null;
  promptPackId?: string | null;
  flowAccountId?: string | null;
  targetDate?: string | null;
  status?: FlowBatchStatus | string;
  limit?: number;
}) {
  const { supabase, user } = await requireUser();

  if (input?.status) {
    assertFlowBatchStatus(input.status);
  }

  let query = supabase
    .from("flow_batches")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (input?.limit !== undefined) {
    if (!Number.isFinite(input.limit) || input.limit < 1) {
      throw new Error("Flow batch list limit must be a positive number.");
    }

    query = query.limit(Math.floor(input.limit));
  }

  if (input?.workspaceId) {
    query = query.eq("workspace_id", input.workspaceId);
  }

  if (input?.productId) {
    query = query.eq("product_id", input.productId);
  }

  if (input?.promptPackId) {
    query = query.eq("prompt_pack_id", input.promptPackId);
  }

  if (input?.flowAccountId) {
    query = query.eq("flow_account_id", input.flowAccountId);
  }

  if (input?.targetDate) {
    query = query.eq("target_date", normalizeDate(input.targetDate));
  }

  if (input?.status) {
    query = query.eq("status", input.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as FlowBatchRecord[];
}

export async function getFlowBatchById(id: string) {
  const batches = await listFlowBatches({ limit: 1 });
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from("flow_batches").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as FlowBatchRecord | null;
}

export async function createFlowBatch(input: FlowBatchInput) {
  const { supabase, user } = await requireUser();
  const status = input.status ? (assertFlowBatchStatus(input.status), input.status) : "DRAFT";
  const maxJobs = Math.min(parsePositiveInt(input.max_jobs, "max_jobs", 5), 5);
  const targetDate = normalizeDate(input.target_date);
  const resolved = await resolveBatchReferences(supabase, user.id, input);
  const batchCode = normalizeBatchCode(input.batch_code ?? buildFlowBatchCode({
    promptPackCode: resolved.prompt_pack_code,
    accountCode: resolved.flow_account.account_code,
    targetDate,
  }));

  const { data, error } = await supabase
    .from("flow_batches")
    .insert({
      user_id: user.id,
      workspace_id: resolved.workspace_id,
      product_id: resolved.product_id,
      prompt_pack_id: resolved.prompt_pack_id,
      batch_code: batchCode,
      flow_account_id: resolved.flow_account.id,
      target_date: targetDate,
      model: readText(input.model) || "google-flow",
      max_jobs: maxJobs,
      drive_output_folder_url: normalizeNullableText(input.drive_output_folder_url),
      drive_output_folder_id: normalizeNullableText(input.drive_output_folder_id),
      flow_url: normalizeNullableText(input.flow_url),
      helper_output_folder_key: normalizeNullableText(input.helper_output_folder_key),
      status,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/controller");
  return data as FlowBatchRecord;
}

export async function updateFlowBatch(id: string, input: FlowBatchUpdateInput) {
  const { supabase, user } = await requireUser();
  const current = await getFlowBatchById(id);

  if (!current) {
    throw new Error("Flow batch not found.");
  }

  const patch: Partial<
    Pick<
      FlowBatchRecord,
      | "batch_code"
      | "flow_account_id"
      | "target_date"
      | "model"
      | "max_jobs"
      | "drive_output_folder_url"
      | "drive_output_folder_id"
      | "flow_url"
      | "helper_output_folder_key"
      | "manifest_json"
      | "last_helper_event_at"
      | "status"
    >
  > = {};

  if (input.batch_code !== undefined) {
    patch.batch_code = normalizeBatchCode(input.batch_code);
  }

  if (input.flow_account_id !== undefined) {
    const flowAccountId = readText(input.flow_account_id);
    if (!flowAccountId) {
      throw new Error("Flow account is required.");
    }

    await requireOwnedFlowAccount(supabase, user.id, flowAccountId);
    patch.flow_account_id = flowAccountId;
  }

  if (input.target_date !== undefined) {
    patch.target_date = normalizeDate(input.target_date);
  }

  if (input.model !== undefined) {
    const model = readText(input.model);
    if (!model) {
      throw new Error("Model is required.");
    }
    patch.model = model;
  }

  if (input.max_jobs !== undefined) {
    patch.max_jobs = Math.min(parsePositiveInt(input.max_jobs, "max_jobs", current.max_jobs), 5);
  }

  if (input.drive_output_folder_url !== undefined) {
    patch.drive_output_folder_url = normalizeNullableText(input.drive_output_folder_url);
  }

  if (input.drive_output_folder_id !== undefined) {
    patch.drive_output_folder_id = normalizeNullableText(input.drive_output_folder_id);
  }

  if (input.flow_url !== undefined) {
    patch.flow_url = normalizeNullableText(input.flow_url);
  }

  if (input.helper_output_folder_key !== undefined) {
    patch.helper_output_folder_key = normalizeNullableText(input.helper_output_folder_key);
  }

  if (input.manifest_json !== undefined) {
    patch.manifest_json = input.manifest_json;
  }

  if (input.last_helper_event_at !== undefined) {
    patch.last_helper_event_at = normalizeNullableText(input.last_helper_event_at);
  }

  if (input.status !== undefined) {
    assertFlowBatchStatus(input.status);
    patch.status = input.status;
  }

  if (!Object.keys(patch).length) {
    throw new Error("No flow batch changes provided.");
  }

  const { data, error } = await supabase
    .from("flow_batches")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/controller");
  return data as FlowBatchRecord;
}

export async function archiveFlowBatch(id: string) {
  return await updateFlowBatch(id, { status: "CLOSED" });
}

export function summarizeBatchState(batches: FlowBatchRecord[]) {
  const counts = new Map<FlowBatchStatus, number>();

  for (const batch of batches) {
    counts.set(batch.status, (counts.get(batch.status) ?? 0) + 1);
  }

  return {
    total: batches.length,
    counts,
    openCount: batches.filter((batch) => batch.status !== "CLOSED").length,
    runningCount: batches.filter((batch) => batch.status === "RUNNING").length,
  };
}

export function extractFlowAccountLoad(batches: BatchState[]) {
  const loadMap = new Map<string, { openBatchCount: number; maxJobsTotal: number }>();

  for (const batch of batches) {
    if (!OPEN_FLOW_BATCH_STATUSES.has(batch.status)) {
      continue;
    }

    const current = loadMap.get(batch.flow_account_id) ?? { openBatchCount: 0, maxJobsTotal: 0 };
    current.openBatchCount += 1;
    current.maxJobsTotal += batch.max_jobs;
    loadMap.set(batch.flow_account_id, current);
  }

  return loadMap;
}
