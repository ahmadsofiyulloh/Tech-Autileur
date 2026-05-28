import "server-only";

import { resolveDriveImagePreviewUrl } from "@/lib/server/drive-image-previews";
import { type DriveItemRecord } from "@/lib/server/drive-items";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatAppDateTime } from "@/lib/app-time";
import {
  buildProductListHref,
  createPaginationState,
  PRODUCT_LIST_DESKTOP_PAGE_SIZE,
  type PaginationState,
  type ProductListFilter,
  type ProductListRow,
  type ProductUploadScope,
  type ProductWorkflowStage,
  type ProductWorkflowStatusJson,
} from "@/lib/products/product-list-contract";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type ProductRecord = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  product_code: string;
  product_name: string;
  niche: string | null;
  marketplace: string | null;
  marketplace_product_link: string | null;
  status: string;
  workflow_status_json: unknown;
  created_at: string;
  updated_at: string;
};

type ProductImageRecord = {
  id: string;
  product_id: string;
  drive_item_ref_id: string;
  is_primary: boolean;
  status: string;
  created_at: string;
  updated_at: string;
};

type ProductIntakeSessionRecord = {
  id: string;
  product_id: string | null;
  parsed_metadata_json: unknown;
  reviewed_metadata_json: unknown;
  status: string;
  created_at: string;
  updated_at: string;
};

type PromptPackRecord = {
  id: string;
  product_id: string;
  prompt_code: string;
  status: string;
  ai_task_id: string | null;
  created_at: string;
  updated_at: string;
};

type ContentRecord = {
  id: string;
  product_id: string;
  content_code: string;
  platform: string | null;
  hook_type: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type ClipJobRecord = {
  id: string;
  content_id: string;
  clip_code: string;
  generated_drive_item_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type WorkspaceLabelRecord = {
  id: string;
  workspace_code: string;
  workspace_name: string;
  status: string;
};

type AiTaskRecord = {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type ProductListPageInput = {
  affiliateProfileId?: string | null;
  filter?: ProductListFilter;
  page?: number;
  pageSize?: number;
  search?: string | null;
  showAllWorkspaces?: boolean;
  uploadFilter?: Exclude<ProductUploadScope, "none"> | null;
  workspaceId?: string | null;
};

export type ProductListPageResult = {
  rows: ProductListRow[];
  pagination: PaginationState;
  totalProductCount: number;
};

const PRODUCT_LIST_QUERY_BATCH_SIZE = 500;
const PRODUCT_LIST_RELATION_CHUNK_SIZE = 150;

function fieldValue(value: string | number | null | undefined) {
  return value ? String(value) : "";
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

function readJsonText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function metadataText(record: unknown, key: string, fallbackKey?: string) {
  if (!isRecord(record)) {
    return "";
  }

  return readJsonText(record[key]) || (fallbackKey ? readJsonText(record[fallbackKey]) : "");
}

function hasVerifiedIntakeMetadata(session: { reviewed_metadata_json: unknown; status: string }) {
  return Boolean(session.reviewed_metadata_json) || session.status === "REVIEWED" || session.status === "ANCHOR_READY";
}

function isDraftPromptPack(status: string) {
  const normalized = status.toUpperCase();
  return normalized === "DRAFT" || normalized === "QUEUED" || normalized === "GENERATING" || normalized === "NEEDS_REVIEW" || normalized === "ERROR";
}

function isCompletedPromptPack(status: string) {
  const normalized = status.toUpperCase();
  return normalized === "GENERATED" || normalized === "APPROVED";
}

function normalizeStatusLabel(value: string) {
  return value.replaceAll("_", " ");
}

function normalizeCompactStatusLabel(value: string) {
  const normalized = value.toUpperCase();

  if (normalized === "DRAFT") {
    return "Draf";
  }

  if (normalized === "IMAGE_ATTACHED") {
    return "Foto";
  }

  if (normalized === "IMAGE_ANALYZED") {
    return "Analisis";
  }

  if (normalized === "PROMPT_READY") {
    return "Prompt";
  }

  if (normalized === "READY_FOR_UPLOAD" || normalized === "IN_PRODUCTION") {
    return "Video";
  }

  if (normalized === "UPLOADED") {
    return "Keduanya";
  }

  if (normalized === "ARCHIVED") {
    return "Arsip";
  }

  return normalizeStatusLabel(value);
}

function isGeneratedClipJob(clipJob: ClipJobRecord | null) {
  if (!clipJob) {
    return false;
  }

  if (clipJob.generated_drive_item_id) {
    return true;
  }

  const normalized = clipJob.status.toUpperCase();
  return normalized === "APPROVED" || normalized === "IMPORTED" || normalized === "NEEDS_REVIEW";
}

function resolveUploadScope(workflowStatus: ProductWorkflowStatusJson, productStatus: string): ProductUploadScope {
  if (workflowStatus.uploaded_shopee && workflowStatus.uploaded_tiktok) {
    return "both";
  }

  if (workflowStatus.uploaded_shopee) {
    return "shopee";
  }

  if (workflowStatus.uploaded_tiktok) {
    return "tiktok";
  }

  if (productStatus.toUpperCase() === "UPLOADED") {
    return "both";
  }

  return "none";
}

function resolveWorkflowStage(
  productStatus: string,
  hasVerifiedIntake: boolean,
  hasDraftPromptPack: boolean,
  promptReady: boolean,
  clipGenerated: boolean,
  uploadScope: ProductUploadScope,
): ProductWorkflowStage {
  const normalized = productStatus.toUpperCase();

  if (uploadScope !== "none" || normalized === "UPLOADED") {
    return "upload";
  }

  if (clipGenerated || normalized === "IN_PRODUCTION" || normalized === "READY_FOR_UPLOAD") {
    return "video";
  }

  if (promptReady || normalized === "PROMPT_READY") {
    return "prompt";
  }

  if (!hasVerifiedIntake || hasDraftPromptPack || normalized === "DRAFT") {
    return "draft";
  }

  return "analysis";
}

function resolvePrimaryStatusLabel(productStatus: string, workflowStage: ProductWorkflowStage, uploadScope: ProductUploadScope) {
  if (workflowStage === "draft") {
    return "Draf";
  }

  if (uploadScope === "both") {
    return "Keduanya";
  }

  if (uploadScope === "shopee") {
    return "Shopee";
  }

  if (uploadScope === "tiktok") {
    return "TikTok";
  }

  if (workflowStage === "video") {
    return "Video";
  }

  if (workflowStage === "prompt") {
    return "Prompt";
  }

  if (workflowStage === "analysis") {
    return "Analisis";
  }

  return normalizeCompactStatusLabel(productStatus);
}

function resolveStatusContextLabel(params: {
  hasDraftPromptPack: boolean;
  hasVerifiedIntake: boolean;
  promptReady: boolean;
  workflowStage: ProductWorkflowStage;
}) {
  if (params.workflowStage === "draft") {
    return params.hasDraftPromptPack ? "Draft" : "Verif";
  }

  if (params.workflowStage === "analysis") {
    return params.hasVerifiedIntake ? "Prompt" : "Verif";
  }

  if (params.workflowStage === "prompt") {
    return "Jadi";
  }

  if (params.workflowStage === "video") {
    return params.promptReady ? "Jadi" : "Prompt";
  }

  if (params.workflowStage === "upload") {
    return "Upload";
  }

  return null;
}

function buildSearchText(parts: Array<string | null | undefined>) {
  return parts
    .filter((part): part is string => Boolean(part))
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function timestampOf(value: string | { updated_at?: string | null; created_at?: string | null } | null | undefined) {
  const rawValue = typeof value === "string" ? value : value?.updated_at ?? value?.created_at ?? "";
  const timestamp = rawValue ? new Date(rawValue).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function latestByTimestamp<T extends { updated_at?: string | null; created_at?: string | null }>(items: readonly T[]) {
  return [...items].sort((left, right) => timestampOf(right) - timestampOf(left))[0] ?? null;
}

function rawTimestamp(value: { updated_at?: string | null; created_at?: string | null } | null | undefined) {
  return value?.updated_at ?? value?.created_at ?? null;
}

function latestActivityAt(items: Array<{ updated_at?: string | null; created_at?: string | null } | null | undefined>) {
  return rawTimestamp(latestByTimestamp(items.filter(Boolean) as Array<{ updated_at?: string | null; created_at?: string | null }>));
}

function chunkValues<T>(values: readonly T[], size = PRODUCT_LIST_RELATION_CHUNK_SIZE) {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

function uniqueTextValues(values: readonly (string | null | undefined)[]) {
  return Array.from(new Set(values.map((value) => (typeof value === "string" ? value.trim() : "")).filter(Boolean)));
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

function workspaceLabel(workspaceId: string | null, workspaceMap: Map<string, WorkspaceLabelRecord>) {
  if (!workspaceId) {
    return "Tanpa workspace";
  }

  const workspace = workspaceMap.get(workspaceId);
  return workspace ? workspace.workspace_name : "Workspace tidak tersedia";
}

function buildContinueHref(params: {
  affiliateProfileId: string | null;
  latestIntake: { id: string } | null;
  latestPromptPack: { id: string; status: string } | null;
  showAllWorkspaces: boolean;
}) {
  if (params.latestPromptPack && isDraftPromptPack(params.latestPromptPack.status)) {
    const searchParams = new URLSearchParams({ detail: params.latestPromptPack.id });

    if (params.affiliateProfileId) {
      searchParams.set("affiliate_profile_id", params.affiliateProfileId);
    }

    return `/prompts?${searchParams.toString()}`;
  }

  if (!params.latestIntake) {
    return null;
  }

  const searchParams = new URLSearchParams({
    intake_id: params.latestIntake.id,
    step: "prompt",
  });

  if (params.showAllWorkspaces) {
    searchParams.set("workspace", "all");
  }

  if (params.affiliateProfileId) {
    searchParams.set("affiliate_profile_id", params.affiliateProfileId);
  }

  return `/products/new?${searchParams.toString()}`;
}

function buildPromptHref(params: {
  affiliateProfileId: string | null;
  latestPromptPack: { id: string } | null;
}) {
  if (!params.latestPromptPack) {
    return null;
  }

  const searchParams = new URLSearchParams({ detail: params.latestPromptPack.id });

  if (params.affiliateProfileId) {
    searchParams.set("affiliate_profile_id", params.affiliateProfileId);
  }

  return `/prompts?${searchParams.toString()}`;
}

function matchesProductFilter(product: ProductListRow, filter: ProductListFilter) {
  if (filter === "all") {
    return true;
  }

  return product.workflow_stage === filter;
}

function matchesUploadFilter(product: ProductListRow, filter: Exclude<ProductUploadScope, "none"> | null) {
  if (!filter) {
    return true;
  }

  return product.workflow_stage === "upload" && product.upload_scope === filter;
}

const PRODUCT_LIST_QUERY_COLUMNS =
  "id, user_id, workspace_id, product_code, product_name, niche, marketplace, marketplace_product_link, status, workflow_status_json, created_at, updated_at";

function sanitizeProductListSearch(search: string) {
  return search.replace(/[%(),]/g, " ").replace(/\s+/g, " ").trim();
}

function buildProductListSearchFilter(search: string) {
  const sanitized = sanitizeProductListSearch(search);

  if (!sanitized) {
    return null;
  }

  const pattern = `%${sanitized}%`;
  return [
    `product_name.ilike.${pattern}`,
    `product_code.ilike.${pattern}`,
    `niche.ilike.${pattern}`,
    `marketplace.ilike.${pattern}`,
    `marketplace_product_link.ilike.${pattern}`,
  ].join(",");
}

async function loadAllProducts(input: {
  supabase: SupabaseServerClient;
  userId: string;
  workspaceId?: string | null;
}) {
  const rows: ProductRecord[] = [];
  let from = 0;

  while (true) {
    const to = from + PRODUCT_LIST_QUERY_BATCH_SIZE - 1;
    let query = input.supabase
      .from("products")
      .select("id, user_id, workspace_id, product_code, product_name, niche, marketplace, marketplace_product_link, status, workflow_status_json, created_at, updated_at")
      .eq("user_id", input.userId)
      .neq("status", "ARCHIVED")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);

    if (input.workspaceId) {
      query = query.eq("workspace_id", input.workspaceId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    const batch = (data ?? []) as ProductRecord[];
    rows.push(...batch);

    if (batch.length < PRODUCT_LIST_QUERY_BATCH_SIZE) {
      break;
    }

    from += PRODUCT_LIST_QUERY_BATCH_SIZE;
  }

  return rows;
}

async function loadWorkspaces(input: { supabase: SupabaseServerClient; userId: string }) {
  const { data, error } = await input.supabase
    .from("workspaces")
    .select("id, workspace_code, workspace_name, status")
    .eq("user_id", input.userId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as WorkspaceLabelRecord[];
}

async function loadIntakeSessions(input: { supabase: SupabaseServerClient; userId: string; productIds: string[] }) {
  const rows: ProductIntakeSessionRecord[] = [];

  for (const productIds of chunkValues(input.productIds)) {
    const { data, error } = await input.supabase
      .from("product_intake_sessions")
      .select("id, product_id, parsed_metadata_json, reviewed_metadata_json, status, created_at, updated_at")
      .eq("user_id", input.userId)
      .in("product_id", productIds)
      .neq("status", "ARCHIVED")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    rows.push(...((data ?? []) as ProductIntakeSessionRecord[]));
  }

  return rows;
}

async function loadPromptPacks(input: { supabase: SupabaseServerClient; userId: string; productIds: string[] }) {
  const rows: PromptPackRecord[] = [];

  for (const productIds of chunkValues(input.productIds)) {
    const { data, error } = await input.supabase
      .from("prompt_packs")
      .select("id, product_id, prompt_code, status, ai_task_id, created_at, updated_at")
      .eq("user_id", input.userId)
      .in("product_id", productIds)
      .neq("status", "ARCHIVED")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    rows.push(...((data ?? []) as PromptPackRecord[]));
  }

  return rows;
}

async function loadAiTasks(input: { supabase: SupabaseServerClient; userId: string; taskIds: string[] }) {
  const rows: AiTaskRecord[] = [];

  for (const taskIds of chunkValues(input.taskIds)) {
    const { data, error } = await input.supabase
      .from("ai_tasks")
      .select("id, status, created_at, updated_at")
      .eq("user_id", input.userId)
      .in("id", taskIds)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    rows.push(...((data ?? []) as AiTaskRecord[]));
  }

  return rows;
}

async function loadContents(input: { supabase: SupabaseServerClient; userId: string; productIds: string[] }) {
  const rows: ContentRecord[] = [];

  for (const productIds of chunkValues(input.productIds)) {
    const { data, error } = await input.supabase
      .from("contents")
      .select("id, product_id, content_code, platform, hook_type, status, created_at, updated_at")
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

async function loadClipJobs(input: { supabase: SupabaseServerClient; userId: string; contentIds: string[] }) {
  const rows: ClipJobRecord[] = [];

  for (const contentIds of chunkValues(input.contentIds)) {
    const { data, error } = await input.supabase
      .from("clip_jobs")
      .select("id, content_id, clip_code, generated_drive_item_id, status, created_at, updated_at")
      .eq("user_id", input.userId)
      .in("content_id", contentIds)
      .neq("status", "ARCHIVED")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    rows.push(...((data ?? []) as ClipJobRecord[]));
  }

  return rows;
}

async function loadProductImages(input: { supabase: SupabaseServerClient; userId: string; productIds: string[] }) {
  const rows: ProductImageRecord[] = [];

  for (const productIds of chunkValues(input.productIds)) {
    const { data, error } = await input.supabase
      .from("product_images")
      .select("id, product_id, drive_item_ref_id, is_primary, status, created_at, updated_at")
      .eq("user_id", input.userId)
      .in("product_id", productIds)
      .neq("status", "ARCHIVED")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    rows.push(...((data ?? []) as ProductImageRecord[]));
  }

  return rows;
}

async function loadDriveItems(input: { supabase: SupabaseServerClient; userId: string; driveItemIds: string[] }) {
  const rows: DriveItemRecord[] = [];

  for (const driveItemIds of chunkValues(input.driveItemIds)) {
    const { data, error } = await input.supabase
      .from("drive_items")
      .select("*")
      .eq("user_id", input.userId)
      .in("id", driveItemIds)
      .neq("status", "ARCHIVED");

    if (error) {
      throw new Error(error.message);
    }

    rows.push(...((data ?? []) as DriveItemRecord[]));
  }

  return rows;
}

function buildRows(input: {
  affiliateProfileId: string | null;
  aiTasks: AiTaskRecord[];
  clipJobs: ClipJobRecord[];
  contents: ContentRecord[];
  intakeSessions: ProductIntakeSessionRecord[];
  promptPacks: PromptPackRecord[];
  products: ProductRecord[];
  showAllWorkspaces: boolean;
  workspaces: WorkspaceLabelRecord[];
}) {
  const workspaceMap = new Map(input.workspaces.filter((workspace) => workspace.status !== "ARCHIVED").map((workspace) => [workspace.id, workspace]));
  const latestIntakeByProductId = new Map<string, ProductIntakeSessionRecord>();
  const latestVerifiedIntakeByProductId = new Map<string, ProductIntakeSessionRecord>();
  const promptPacksByProductId = groupByProductId(input.promptPacks);
  const aiTaskMap = new Map(input.aiTasks.map((task) => [task.id, task]));
  const latestContentByProductId = new Map<string, ContentRecord[]>();
  const contentProductMap = new Map<string, string>();
  const latestGeneratedClipJobByProductId = new Map<string, ClipJobRecord>();

  for (const session of input.intakeSessions) {
    if (!session.product_id) {
      continue;
    }

    if (!latestIntakeByProductId.has(session.product_id)) {
      latestIntakeByProductId.set(session.product_id, session);
    }

    if (hasVerifiedIntakeMetadata(session) && !latestVerifiedIntakeByProductId.has(session.product_id)) {
      latestVerifiedIntakeByProductId.set(session.product_id, session);
    }
  }

  for (const content of input.contents) {
    contentProductMap.set(content.id, content.product_id);
    const productContents = latestContentByProductId.get(content.product_id) ?? [];
    productContents.push(content);
    latestContentByProductId.set(content.product_id, productContents);
  }

  for (const clipJob of input.clipJobs) {
    const productId = contentProductMap.get(clipJob.content_id);

    if (!productId || latestGeneratedClipJobByProductId.has(productId) || !isGeneratedClipJob(clipJob)) {
      continue;
    }

    latestGeneratedClipJobByProductId.set(productId, clipJob);
  }

  return input.products.map((product) => {
    const latestIntake = latestIntakeByProductId.get(product.id) ?? null;
    const latestVerifiedIntake = latestVerifiedIntakeByProductId.get(product.id) ?? null;
    const productPromptPacks = promptPacksByProductId.get(product.id) ?? [];
    const productContents = latestContentByProductId.get(product.id) ?? [];
    const productPromptTasks = productPromptPacks
      .map((pack) => (pack.ai_task_id ? aiTaskMap.get(pack.ai_task_id) ?? null : null))
      .filter((task): task is AiTaskRecord => Boolean(task));
    const latestPromptPack = latestByTimestamp(productPromptPacks);
    const latestGeneratedClipJob = latestGeneratedClipJobByProductId.get(product.id) ?? null;
    const latestActivity = latestActivityAt([
      product,
      latestIntake,
      latestVerifiedIntake,
      latestPromptPack,
      latestGeneratedClipJob,
      latestByTimestamp(productContents),
      latestByTimestamp(productPromptTasks),
    ]);
    const productWorkflowStatus = readWorkflowStatusJson(product.workflow_status_json);
    const promptReady = Boolean(latestPromptPack && isCompletedPromptPack(latestPromptPack.status));
    const hasDraftPromptPack = Boolean(latestPromptPack && isDraftPromptPack(latestPromptPack.status));
    const hasVerifiedIntake = Boolean(latestVerifiedIntake);
    const uploadScope = resolveUploadScope(productWorkflowStatus, product.status);
    const continueHref =
      hasDraftPromptPack || (!hasVerifiedIntake && latestIntake)
        ? buildContinueHref({
            affiliateProfileId: input.affiliateProfileId,
            latestIntake: hasDraftPromptPack ? null : latestIntake,
            latestPromptPack,
            showAllWorkspaces: input.showAllWorkspaces,
          })
        : null;
    const clipGenerated = Boolean(productWorkflowStatus.video_generated || latestGeneratedClipJob);
    const workflowStage = resolveWorkflowStage(product.status, hasVerifiedIntake, hasDraftPromptPack, promptReady, clipGenerated, uploadScope);
    const primaryStatusLabel = resolvePrimaryStatusLabel(product.status, workflowStage, uploadScope);
    const statusContextLabel = resolveStatusContextLabel({
      hasDraftPromptPack,
      hasVerifiedIntake,
      promptReady,
      workflowStage,
    });
    const keyword =
      metadataText(
        latestVerifiedIntake?.reviewed_metadata_json ?? latestIntake?.parsed_metadata_json ?? latestIntake?.reviewed_metadata_json ?? null,
        "keyword_cari_etalase",
        "category",
      ) || fieldValue(product.niche);
    const contentSummary = (latestContentByProductId.get(product.id) ?? []).map((content) =>
      [content.content_code, content.platform, content.status, content.hook_type].filter(Boolean).join(" "),
    );
    const baseSearchText = buildSearchText([
      product.product_code,
      product.product_name,
      product.niche,
      product.marketplace,
      product.marketplace_product_link,
      workspaceLabel(product.workspace_id, workspaceMap),
      keyword,
      product.status,
      primaryStatusLabel,
      statusContextLabel,
      workflowStage,
      latestPromptPack?.status,
      latestPromptPack?.prompt_code,
      latestGeneratedClipJob?.status,
      latestGeneratedClipJob?.clip_code,
      uploadScope,
      ...contentSummary,
    ]);

    return {
      id: product.id,
      product_code: product.product_code,
      product_name: product.product_name,
      niche: product.niche,
      workspace_label: workspaceLabel(product.workspace_id, workspaceMap),
      marketplace: product.marketplace,
      marketplace_product_link: product.marketplace_product_link,
      keyword,
      product_status: product.status,
      intake_status: latestIntake?.status ?? "",
      created_at: product.created_at,
      created_at_label: formatAppDateTime(product.created_at, "-"),
      latest_activity_at: latestActivity,
      latest_activity_label: formatAppDateTime(latestActivity, "-"),
      thumbnail_url: null,
      href: "",
      continue_href: continueHref,
      prompt_href: buildPromptHref({
        affiliateProfileId: input.affiliateProfileId,
        latestPromptPack,
      }),
      primary_status_label: primaryStatusLabel,
      status_context_label: statusContextLabel,
      workflow_stage: workflowStage,
      upload_scope: uploadScope,
      workflow_status_json: productWorkflowStatus,
      search_text: baseSearchText,
    };
  });
}

async function hydrateThumbnails(input: {
  rows: ProductListRow[];
  supabase: SupabaseServerClient;
  userId: string;
}) {
  const productIds = input.rows.map((row) => row.id);
  const productImages = await loadProductImages({
    supabase: input.supabase,
    userId: input.userId,
    productIds,
  });
  const driveItems = await loadDriveItems({
    supabase: input.supabase,
    userId: input.userId,
    driveItemIds: uniqueTextValues(productImages.map((image) => image.drive_item_ref_id)),
  });
  const imagesByProductId = groupByProductId(productImages);
  const driveItemMap = new Map(driveItems.map((item) => [item.id, item]));
  const previewUrlCache = new Map<string, string | null>();

  return input.rows.map((row) => {
    const images = imagesByProductId.get(row.id) ?? [];
    const primaryImage = images.find((image) => image.is_primary) ?? latestByTimestamp(images);
    const primaryDriveItem = primaryImage ? driveItemMap.get(primaryImage.drive_item_ref_id) ?? null : null;

    return {
      ...row,
      thumbnail_url: resolveDriveImagePreviewUrl(primaryDriveItem, previewUrlCache),
    };
  });
}

async function listProductListPageLegacyForUser(input: {
  supabase: SupabaseServerClient;
  userId: string;
  input?: ProductListPageInput;
}): Promise<ProductListPageResult> {
  const filter = input.input?.filter ?? "all";
  const pageSize = Math.min(Math.max(input.input?.pageSize ?? PRODUCT_LIST_DESKTOP_PAGE_SIZE, 1), 50);
  const requestedPage = Math.max(input.input?.page ?? 1, 1);
  const search = (input.input?.search ?? "").trim().toLowerCase();
  const products = await loadAllProducts({
    supabase: input.supabase,
    userId: input.userId,
    workspaceId: input.input?.workspaceId,
  });
  const productIds = products.map((product) => product.id);
  const [workspaces, intakeSessions, promptPacks, contents] = await Promise.all([
    loadWorkspaces({ supabase: input.supabase, userId: input.userId }),
    loadIntakeSessions({ supabase: input.supabase, userId: input.userId, productIds }),
    loadPromptPacks({ supabase: input.supabase, userId: input.userId, productIds }),
    loadContents({ supabase: input.supabase, userId: input.userId, productIds }),
  ]);
  const clipJobs = await loadClipJobs({
    supabase: input.supabase,
    userId: input.userId,
    contentIds: contents.map((content) => content.id),
  });
  const aiTasks = await loadAiTasks({
    supabase: input.supabase,
    userId: input.userId,
    taskIds: uniqueTextValues(promptPacks.map((pack) => pack.ai_task_id)),
  });
  const projectedRows = buildRows({
    affiliateProfileId: input.input?.affiliateProfileId ?? null,
    aiTasks,
    clipJobs,
    contents,
    intakeSessions,
    promptPacks,
    products,
    showAllWorkspaces: input.input?.showAllWorkspaces ?? false,
    workspaces,
  });
  const searchedRows = search ? projectedRows.filter((row) => row.search_text.includes(search)) : projectedRows;
  const filteredRows = searchedRows.filter((row) => matchesProductFilter(row, filter) && matchesUploadFilter(row, input.input?.uploadFilter ?? null));

  filteredRows.sort((left, right) => {
    const activityDiff = timestampOf(right.latest_activity_at) - timestampOf(left.latest_activity_at);

    if (activityDiff !== 0) {
      return activityDiff;
    }

    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  });

  const pagination = createPaginationState({
    page: requestedPage,
    pageSize,
    totalCount: filteredRows.length,
  });
  const from = (pagination.page - 1) * pagination.pageSize;
  const pageRows = filteredRows.slice(from, from + pagination.pageSize).map((row) => ({
    ...row,
    href: buildProductListHref({
      affiliateProfileId: input.input?.affiliateProfileId,
      detailId: row.id,
      filter,
      page: pagination.page,
      search: input.input?.search,
      showAllWorkspaces: input.input?.showAllWorkspaces,
      tab: "output",
      uploadFilter: input.input?.uploadFilter,
    }),
  }));
  const rows = await hydrateThumbnails({
    rows: pageRows,
    supabase: input.supabase,
    userId: input.userId,
  });

  return {
    rows,
    pagination,
    totalProductCount: products.length,
  };
}

export async function listProductListPageForUser(
  userId: string,
  input?: ProductListPageInput,
  supabase?: SupabaseServerClient,
): Promise<ProductListPageResult> {
  const client = supabase ?? (await createSupabaseServerClient());

  if (input?.uploadFilter) {
    return listProductListPageLegacyForUser({
      supabase: client,
      userId,
      input,
    });
  }

  const filter = input?.filter ?? "all";
  const pageSize = Math.min(Math.max(input?.pageSize ?? PRODUCT_LIST_DESKTOP_PAGE_SIZE, 1), 50);
  const requestedPage = Math.max(input?.page ?? 1, 1);
  const search = (input?.search ?? "").trim().toLowerCase();
  const searchFilter = search ? buildProductListSearchFilter(search) : null;

  let countQuery = client
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .neq("status", "ARCHIVED");

  if (input?.workspaceId) {
    countQuery = countQuery.eq("workspace_id", input.workspaceId);
  }

  if (searchFilter) {
    countQuery = countQuery.or(searchFilter);
  }

  if (filter !== "all") {
    switch (filter) {
      case "draft":
        countQuery = countQuery.eq("status", "DRAFT");
        break;
      case "analysis":
        countQuery = countQuery.in("status", ["IMAGE_ATTACHED", "IMAGE_ANALYZED"]);
        break;
      case "prompt":
        countQuery = countQuery.eq("status", "PROMPT_READY");
        break;
      case "video":
        countQuery = countQuery.in("status", ["IN_PRODUCTION", "READY_FOR_UPLOAD"]);
        break;
      case "upload":
        countQuery = countQuery.eq("status", "UPLOADED");
        break;
      default:
        break;
    }
  }

  const { count, error: countError } = await countQuery;

  if (countError) {
    throw new Error(countError.message);
  }

  const pagination = createPaginationState({
    page: requestedPage,
    pageSize,
    totalCount: count ?? 0,
  });

  if (!count) {
    return {
      rows: [],
      pagination,
      totalProductCount: 0,
    };
  }

  let productQuery = client
    .from("products")
    .select(PRODUCT_LIST_QUERY_COLUMNS)
    .eq("user_id", userId)
    .neq("status", "ARCHIVED");

  if (input?.workspaceId) {
    productQuery = productQuery.eq("workspace_id", input.workspaceId);
  }

  if (searchFilter) {
    productQuery = productQuery.or(searchFilter);
  }

  if (filter !== "all") {
    switch (filter) {
      case "draft":
        productQuery = productQuery.eq("status", "DRAFT");
        break;
      case "analysis":
        productQuery = productQuery.in("status", ["IMAGE_ATTACHED", "IMAGE_ANALYZED"]);
        break;
      case "prompt":
        productQuery = productQuery.eq("status", "PROMPT_READY");
        break;
      case "video":
        productQuery = productQuery.in("status", ["IN_PRODUCTION", "READY_FOR_UPLOAD"]);
        break;
      case "upload":
        productQuery = productQuery.eq("status", "UPLOADED");
        break;
      default:
        break;
    }
  }

  const from = (pagination.page - 1) * pagination.pageSize;
  const to = from + pagination.pageSize - 1;
  const { data: visibleProducts, error: productsError } = await productQuery
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);

  if (productsError) {
    throw new Error(productsError.message);
  }

  const products = (visibleProducts ?? []) as ProductRecord[];
  const productIds = products.map((product) => product.id);
  const [workspaces, intakeSessions, promptPacks, contents] = await Promise.all([
    loadWorkspaces({ supabase: client, userId }),
    loadIntakeSessions({ supabase: client, userId, productIds }),
    loadPromptPacks({ supabase: client, userId, productIds }),
    loadContents({ supabase: client, userId, productIds }),
  ]);
  const clipJobs = await loadClipJobs({
    supabase: client,
    userId,
    contentIds: contents.map((content) => content.id),
  });
  const aiTasks = await loadAiTasks({
    supabase: client,
    userId,
    taskIds: uniqueTextValues(promptPacks.map((pack) => pack.ai_task_id)),
  });
  const projectedRows = buildRows({
    affiliateProfileId: input?.affiliateProfileId ?? null,
    aiTasks,
    clipJobs,
    contents,
    intakeSessions,
    promptPacks,
    products,
    showAllWorkspaces: input?.showAllWorkspaces ?? false,
    workspaces,
  });

  projectedRows.sort((left, right) => {
    const activityDiff = timestampOf(right.latest_activity_at) - timestampOf(left.latest_activity_at);

    if (activityDiff !== 0) {
      return activityDiff;
    }

    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  });

  const pageRows = projectedRows.map((row) => ({
    ...row,
    href: buildProductListHref({
      affiliateProfileId: input?.affiliateProfileId,
      detailId: row.id,
      filter,
      page: pagination.page,
      search: input?.search,
      showAllWorkspaces: input?.showAllWorkspaces,
      tab: "output",
      uploadFilter: input?.uploadFilter,
    }),
  }));
  const rows = await hydrateThumbnails({
    rows: pageRows,
    supabase: client,
    userId,
  });

  return {
    rows,
    pagination,
    totalProductCount: count ?? 0,
  };
}

export async function listProductListPage(input?: ProductListPageInput): Promise<ProductListPageResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  return listProductListPageForUser(user.id, input, supabase);
}
