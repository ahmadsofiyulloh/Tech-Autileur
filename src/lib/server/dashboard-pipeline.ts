import "server-only";

import { getDefaultAffiliateProfileForWorkspace, listAffiliateProfiles } from "@/lib/server/affiliate-profiles";
import {
  listPromptReadinessProjections,
  type PromptReadinessProjectionContext,
  type PromptReadinessProjectionRow,
} from "@/lib/server/prompt-readiness";
import { getCurrentWorkspace, type WorkspaceRecord } from "@/lib/server/workspaces";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type DashboardPipelineStageKey =
  | "draft"
  | "metadataReady"
  | "promptReady"
  | "generated"
  | "exported"
  | "done";

export type DashboardPipelineStageCountMap = Record<DashboardPipelineStageKey, number>;

export type DashboardPipelineStageCounts = {
  status: "available";
  workspaceId: string | null;
  generatedAt: string;
  total: number;
  counts: DashboardPipelineStageCountMap;
};

export type DashboardPipelineStageUnavailable = {
  status: "unavailable";
  workspaceId: string | null;
  generatedAt: string;
  message: string;
  total: 0;
  counts: Record<DashboardPipelineStageKey, 0>;
};

export type DashboardPipelineStageResult = DashboardPipelineStageCounts | DashboardPipelineStageUnavailable;

type DashboardContext = {
  supabase: SupabaseServerClient;
  userId: string;
  workspaceId: string | null;
};

type ProductRecord = {
  id: string;
  workspace_id: string | null;
  status: string;
  workflow_status_json: unknown;
  created_at: string;
  updated_at: string;
};

type PromptPackRecord = {
  id: string;
  product_id: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type FlowBatchRecord = {
  id: string;
  product_id: string | null;
  prompt_pack_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type ContentRecord = {
  id: string;
  product_id: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type ClipJobRecord = {
  id: string;
  content_id: string;
  batch_id: string | null;
  generated_drive_item_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type GeneratedFileRecord = {
  id: string;
  clip_job_id: string | null;
  stage: string;
  match_status: string;
  imported_at: string | null;
  created_at: string;
  updated_at: string;
};

type ProductWorkflowStatusJson = {
  video_generated: boolean;
  uploaded_shopee: boolean;
  uploaded_tiktok: boolean;
};

const PRODUCT_QUERY_BATCH_SIZE = 500;
const RELATION_CHUNK_SIZE = 150;
const PROMPT_READINESS_CHUNK_SIZE = 150;
const PROMPT_READY_STATUSES = new Set(["GENERATED", "APPROVED"]);
const EXPORTED_STAGE_BATCH_STATUSES = new Set(["READY_TO_EXPORT", "EXPORTED", "RUNNING"]);
const GENERATED_CLIP_STATUSES = new Set(["IMPORTED", "NEEDS_REVIEW", "APPROVED"]);

function zeroCounts(): DashboardPipelineStageCountMap {
  return {
    draft: 0,
    metadataReady: 0,
    promptReady: 0,
    generated: 0,
    exported: 0,
    done: 0,
  };
}

function zeroUnavailableCounts(): Record<DashboardPipelineStageKey, 0> {
  return {
    draft: 0,
    metadataReady: 0,
    promptReady: 0,
    generated: 0,
    exported: 0,
    done: 0,
  };
}

function unavailableResult(input: { generatedAt: string; message?: string; workspaceId?: string | null }): DashboardPipelineStageUnavailable {
  return {
    status: "unavailable",
    workspaceId: input.workspaceId ?? null,
    generatedAt: input.generatedAt,
    message: input.message ?? "Data pipeline tidak tersedia.",
    total: 0,
    counts: zeroUnavailableCounts(),
  };
}

function readText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function statusOf(value: { status?: string | null } | string | null | undefined) {
  const status = typeof value === "string" ? value : value?.status;
  return readText(status).toUpperCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readWorkflowStatusJson(value: unknown): ProductWorkflowStatusJson {
  if (!isRecord(value)) {
    return {
      video_generated: false,
      uploaded_shopee: false,
      uploaded_tiktok: false,
    };
  }

  return {
    video_generated: value.video_generated === true,
    uploaded_shopee: value.uploaded_shopee === true,
    uploaded_tiktok: value.uploaded_tiktok === true,
  };
}

function timestampOf(value: { updated_at?: string | null; created_at?: string | null } | null | undefined) {
  const rawValue = value?.updated_at ?? value?.created_at ?? "";
  const timestamp = rawValue ? new Date(rawValue).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function latestByTimestamp<T extends { updated_at?: string | null; created_at?: string | null }>(items: readonly T[]) {
  return [...items].sort((left, right) => timestampOf(right) - timestampOf(left))[0] ?? null;
}

function chunkValues<T>(values: readonly T[], size = RELATION_CHUNK_SIZE) {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

function groupByProductId<T extends { product_id: string | null }>(items: readonly T[]) {
  const grouped = new Map<string, T[]>();

  for (const item of items) {
    if (!item.product_id) {
      continue;
    }

    const existing = grouped.get(item.product_id) ?? [];
    existing.push(item);
    grouped.set(item.product_id, existing);
  }

  return grouped;
}

async function resolveOwnedWorkspace(input: {
  supabase: SupabaseServerClient;
  userId: string;
  workspaceId?: string | null;
}) {
  const requestedWorkspaceId = readText(input.workspaceId);

  if (!requestedWorkspaceId) {
    return (await getCurrentWorkspace())?.id ?? null;
  }

  const { data, error } = await input.supabase
    .from("workspaces")
    .select("id")
    .eq("id", requestedWorkspaceId)
    .eq("user_id", input.userId)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Akun Affiliate aktif tidak tersedia.");
  }

  return (data as Pick<WorkspaceRecord, "id">).id;
}

async function getDashboardContext(input?: { workspaceId?: string | null }): Promise<DashboardContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Authentication required.");
  }

  return {
    supabase,
    userId: user.id,
    workspaceId: await resolveOwnedWorkspace({
      supabase,
      userId: user.id,
      workspaceId: input?.workspaceId,
    }),
  };
}

async function loadProducts(input: DashboardContext) {
  if (!input.workspaceId) {
    return [] as ProductRecord[];
  }

  const rows: ProductRecord[] = [];
  let from = 0;

  while (true) {
    const to = from + PRODUCT_QUERY_BATCH_SIZE - 1;
    const { data, error } = await input.supabase
      .from("products")
      .select("id, workspace_id, status, workflow_status_json, created_at, updated_at")
      .eq("user_id", input.userId)
      .eq("workspace_id", input.workspaceId)
      .neq("status", "ARCHIVED")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    const batch = (data ?? []) as ProductRecord[];
    rows.push(...batch);

    if (batch.length < PRODUCT_QUERY_BATCH_SIZE) {
      break;
    }

    from += PRODUCT_QUERY_BATCH_SIZE;
  }

  return rows;
}

async function loadPromptPacks(input: DashboardContext & { productIds: string[] }) {
  const rows: PromptPackRecord[] = [];

  for (const productIds of chunkValues(input.productIds)) {
    const { data, error } = await input.supabase
      .from("prompt_packs")
      .select("id, product_id, status, created_at, updated_at")
      .eq("user_id", input.userId)
      .in("product_id", productIds)
      .neq("status", "ARCHIVED")
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    rows.push(...((data ?? []) as PromptPackRecord[]));
  }

  return rows;
}

async function loadFlowBatches(input: DashboardContext) {
  if (!input.workspaceId) {
    return [] as FlowBatchRecord[];
  }

  const rows: FlowBatchRecord[] = [];
  let from = 0;

  while (true) {
    const to = from + PRODUCT_QUERY_BATCH_SIZE - 1;
    const { data, error } = await input.supabase
      .from("flow_batches")
      .select("id, product_id, prompt_pack_id, status, created_at, updated_at")
      .eq("user_id", input.userId)
      .eq("workspace_id", input.workspaceId)
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    const batch = (data ?? []) as FlowBatchRecord[];
    rows.push(...batch);

    if (batch.length < PRODUCT_QUERY_BATCH_SIZE) {
      break;
    }

    from += PRODUCT_QUERY_BATCH_SIZE;
  }

  return rows;
}

async function loadContents(input: DashboardContext & { productIds: string[] }) {
  const rows: ContentRecord[] = [];

  for (const productIds of chunkValues(input.productIds)) {
    const { data, error } = await input.supabase
      .from("contents")
      .select("id, product_id, status, created_at, updated_at")
      .eq("user_id", input.userId)
      .in("product_id", productIds)
      .neq("status", "ARCHIVED");

    if (error) {
      throw new Error(error.message);
    }

    rows.push(...((data ?? []) as ContentRecord[]));
  }

  return rows;
}

async function loadClipJobs(input: DashboardContext & { batchIds: string[]; contentIds: string[] }) {
  const rowsById = new Map<string, ClipJobRecord>();

  for (const contentIds of chunkValues(input.contentIds)) {
    const { data, error } = await input.supabase
      .from("clip_jobs")
      .select("id, content_id, batch_id, generated_drive_item_id, status, created_at, updated_at")
      .eq("user_id", input.userId)
      .in("content_id", contentIds)
      .neq("status", "ARCHIVED");

    if (error) {
      throw new Error(error.message);
    }

    for (const row of (data ?? []) as ClipJobRecord[]) {
      rowsById.set(row.id, row);
    }
  }

  for (const batchIds of chunkValues(input.batchIds)) {
    const { data, error } = await input.supabase
      .from("clip_jobs")
      .select("id, content_id, batch_id, generated_drive_item_id, status, created_at, updated_at")
      .eq("user_id", input.userId)
      .in("batch_id", batchIds)
      .neq("status", "ARCHIVED");

    if (error) {
      throw new Error(error.message);
    }

    for (const row of (data ?? []) as ClipJobRecord[]) {
      rowsById.set(row.id, row);
    }
  }

  return Array.from(rowsById.values());
}

async function loadGeneratedFiles(input: DashboardContext & { clipJobIds: string[] }) {
  const rows: GeneratedFileRecord[] = [];

  for (const clipJobIds of chunkValues(input.clipJobIds)) {
    const { data, error } = await input.supabase
      .from("generated_files")
      .select("id, clip_job_id, stage, match_status, imported_at, created_at, updated_at")
      .eq("user_id", input.userId)
      .in("clip_job_id", clipJobIds)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    rows.push(...((data ?? []) as GeneratedFileRecord[]));
  }

  return rows;
}

async function loadPromptReadinessRows(input: { productIds: string[]; workspaceId: string }) {
  const [defaultAffiliateProfile, affiliateProfiles] = await Promise.all([
    getDefaultAffiliateProfileForWorkspace(input.workspaceId),
    listAffiliateProfiles({ workspaceId: input.workspaceId, status: "ACTIVE", limit: 200 }),
  ]);
  const affiliateProfileContext: PromptReadinessProjectionContext = {
    defaultAffiliateProfile,
    affiliateProfiles,
  };
  const rows: PromptReadinessProjectionRow[] = [];

  for (const productIds of chunkValues(input.productIds, PROMPT_READINESS_CHUNK_SIZE)) {
    rows.push(
      ...(await listPromptReadinessProjections({
        workspaceId: input.workspaceId,
        productIds,
        limit: productIds.length,
        affiliateProfileContext,
      })),
    );
  }

  return rows;
}

function buildBatchProductMap(input: { batches: FlowBatchRecord[]; promptPackProductMap: Map<string, string> }) {
  const batchProductMap = new Map<string, string>();

  for (const batch of input.batches) {
    const productId = batch.product_id ?? (batch.prompt_pack_id ? input.promptPackProductMap.get(batch.prompt_pack_id) ?? null : null);

    if (productId) {
      batchProductMap.set(batch.id, productId);
    }
  }

  return batchProductMap;
}

function buildGeneratedProductSet(input: {
  batchProductMap: Map<string, string>;
  clipJobs: ClipJobRecord[];
  contents: ContentRecord[];
  generatedFiles: GeneratedFileRecord[];
}) {
  const generatedProductIds = new Set<string>();
  const contentProductMap = new Map(input.contents.map((content) => [content.id, content.product_id]));
  const clipJobProductMap = new Map<string, string>();

  for (const clipJob of input.clipJobs) {
    const batchProductId = clipJob.batch_id ? input.batchProductMap.get(clipJob.batch_id) : undefined;
    const productId = batchProductId ?? contentProductMap.get(clipJob.content_id) ?? null;

    if (!productId) {
      continue;
    }

    clipJobProductMap.set(clipJob.id, productId);

    if (clipJob.generated_drive_item_id || GENERATED_CLIP_STATUSES.has(statusOf(clipJob))) {
      generatedProductIds.add(productId);
    }
  }

  for (const generatedFile of input.generatedFiles) {
    const productId = generatedFile.clip_job_id ? clipJobProductMap.get(generatedFile.clip_job_id) : null;

    if (productId) {
      generatedProductIds.add(productId);
    }
  }

  return generatedProductIds;
}

function buildFlowBatchesByProductId(input: {
  batches: FlowBatchRecord[];
  batchProductMap: Map<string, string>;
}) {
  const grouped = new Map<string, FlowBatchRecord[]>();

  for (const batch of input.batches) {
    const productId = input.batchProductMap.get(batch.id);

    if (!productId) {
      continue;
    }

    const rows = grouped.get(productId) ?? [];
    rows.push(batch);
    grouped.set(productId, rows);
  }

  return grouped;
}

function resolveStage(input: {
  batchesByProductId: Map<string, FlowBatchRecord[]>;
  generatedProductIds: Set<string>;
  openPromptPackBatchIds: Set<string>;
  product: ProductRecord;
  promptPacksByProductId: Map<string, PromptPackRecord[]>;
  readinessByProductId: Map<string, PromptReadinessProjectionRow>;
}): DashboardPipelineStageKey {
  const productStatus = statusOf(input.product);
  const workflowStatus = readWorkflowStatusJson(input.product.workflow_status_json);

  if (productStatus === "UPLOADED" || (workflowStatus.uploaded_shopee && workflowStatus.uploaded_tiktok)) {
    return "done";
  }

  if (workflowStatus.video_generated || input.generatedProductIds.has(input.product.id)) {
    return "generated";
  }

  const latestNonClosedBatch = latestByTimestamp(
    (input.batchesByProductId.get(input.product.id) ?? []).filter((batch) => statusOf(batch) !== "CLOSED"),
  );

  if (latestNonClosedBatch && EXPORTED_STAGE_BATCH_STATUSES.has(statusOf(latestNonClosedBatch))) {
    return "exported";
  }

  const latestPromptPack = latestByTimestamp(input.promptPacksByProductId.get(input.product.id) ?? []);

  if (
    latestPromptPack &&
    PROMPT_READY_STATUSES.has(statusOf(latestPromptPack)) &&
    !input.openPromptPackBatchIds.has(latestPromptPack.id)
  ) {
    return "promptReady";
  }

  if (input.readinessByProductId.get(input.product.id)?.status === "READY_FOR_PROMPT") {
    return "metadataReady";
  }

  return "draft";
}

export async function getDashboardPipelineStageCounts(input?: { workspaceId?: string | null }): Promise<DashboardPipelineStageResult> {
  const generatedAt = new Date().toISOString();
  let workspaceId: string | null = input?.workspaceId ?? null;

  try {
    const context = await getDashboardContext(input);
    workspaceId = context.workspaceId;

    if (!context.workspaceId) {
      return {
        status: "available",
        workspaceId: null,
        generatedAt,
        total: 0,
        counts: zeroCounts(),
      };
    }

    const products = await loadProducts(context);
    const productIds = products.map((product) => product.id);

    if (!productIds.length) {
      return {
        status: "available",
        workspaceId: context.workspaceId,
        generatedAt,
        total: 0,
        counts: zeroCounts(),
      };
    }

    const [promptPacks, flowBatches, contents, readinessRows] = await Promise.all([
      loadPromptPacks({ ...context, productIds }),
      loadFlowBatches(context),
      loadContents({ ...context, productIds }),
      loadPromptReadinessRows({ productIds, workspaceId: context.workspaceId }),
    ]);
    const promptPackProductMap = new Map(promptPacks.map((promptPack) => [promptPack.id, promptPack.product_id]));
    const batchProductMap = buildBatchProductMap({
      batches: flowBatches,
      promptPackProductMap,
    });
    const clipJobs = await loadClipJobs({
      ...context,
      batchIds: flowBatches.map((batch) => batch.id),
      contentIds: contents.map((content) => content.id),
    });
    const generatedFiles = await loadGeneratedFiles({
      ...context,
      clipJobIds: clipJobs.map((clipJob) => clipJob.id),
    });
    const generatedProductIds = buildGeneratedProductSet({
      batchProductMap,
      clipJobs,
      contents,
      generatedFiles,
    });
    const promptPacksByProductId = groupByProductId(promptPacks);
    const batchesByProductId = buildFlowBatchesByProductId({
      batches: flowBatches,
      batchProductMap,
    });
    const openPromptPackBatchIds = new Set(
      flowBatches
        .filter((batch) => batch.prompt_pack_id && statusOf(batch) !== "CLOSED")
        .map((batch) => batch.prompt_pack_id as string),
    );
    const readinessByProductId = new Map(readinessRows.map((row) => [row.productId, row]));
    const counts = zeroCounts();

    for (const product of products) {
      const stage = resolveStage({
        batchesByProductId,
        generatedProductIds,
        openPromptPackBatchIds,
        product,
        promptPacksByProductId,
        readinessByProductId,
      });

      counts[stage] += 1;
    }

    return {
      status: "available",
      workspaceId: context.workspaceId,
      generatedAt,
      total: products.length,
      counts,
    };
  } catch {
    return unavailableResult({ generatedAt, workspaceId });
  }
}
