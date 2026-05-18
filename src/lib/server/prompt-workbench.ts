import "server-only";

import { getDefaultAffiliateProfileForWorkspace, listAffiliateProfiles } from "@/lib/server/affiliate-profiles";
import {
  listPromptReadinessProjections,
  type PromptReadinessProjectionContext,
  type PromptReadinessProjectionRow,
} from "@/lib/server/prompt-readiness";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  PROMPT_WORKBENCH_PAGE_SIZE,
  formatPromptWorkbenchActivityLabel,
  normalizePromptWorkbenchSearch,
  type PromptWorkbenchReadinessCounts,
  type PromptWorkbenchReadinessFilter,
} from "@/lib/prompts/prompt-workbench";
import { createPromptWorkbenchPageCollector } from "@/lib/prompts/prompt-workbench-collector";

export type PromptWorkbenchPageInput = {
  workspaceId?: string | null;
  search?: string | string[] | undefined;
  page?: number;
  pageSize?: number;
  readiness?: PromptWorkbenchReadinessFilter;
};

export type PromptWorkbenchProjectionRow = PromptReadinessProjectionRow & {
  latest_activity_at: string | null;
  latest_activity_label: string;
};

export type PromptWorkbenchPageResult = {
  rows: PromptWorkbenchProjectionRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  counts: PromptWorkbenchReadinessCounts;
};

const PROMPT_WORKBENCH_PRODUCT_ID_BATCH_SIZE = 500;
const PROMPT_WORKBENCH_PROJECTION_CHUNK_SIZE = 100;

function clampPageSize(value: number | undefined) {
  return Math.min(Math.max(value ?? PROMPT_WORKBENCH_PAGE_SIZE, 1), 50);
}

function normalizePage(value: number | undefined): number {
  if (!Number.isInteger(value) || (value ?? 0) < 1) {
    return 1;
  }

  return value ?? 1;
}

function buildPromptSearchFilter(search: string) {
  const pattern = `%${search}%`;
  return `product_name.ilike.${pattern},product_code.ilike.${pattern},niche.ilike.${pattern},marketplace.ilike.${pattern}`;
}

function chunkValues<T>(values: readonly T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

function timestampOf(value: string | { updated_at?: string | null; created_at?: string | null } | null | undefined) {
  const rawValue = typeof value === "string" ? value : value?.updated_at ?? value?.created_at ?? "";
  const timestamp = rawValue ? new Date(rawValue).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function activityCandidate(value: { updated_at?: string | null; created_at?: string | null } | null | undefined) {
  const rawValue = value?.updated_at ?? value?.created_at ?? null;

  return {
    rawValue,
    timestamp: timestampOf(rawValue),
  };
}

function resolveLatestPromptWorkbenchActivityAt(row: PromptReadinessProjectionRow) {
  const candidates = [
    activityCandidate(row.product),
    activityCandidate(row.promptPack),
    activityCandidate(row.intakeSession),
    activityCandidate(row.aiTask),
  ];
  const latest = candidates.sort((left, right) => right.timestamp - left.timestamp)[0] ?? null;

  return latest?.timestamp ? latest.rawValue : row.product.updated_at ?? row.product.created_at ?? null;
}

export function withPromptWorkbenchActivity(row: PromptReadinessProjectionRow): PromptWorkbenchProjectionRow {
  const latestActivityAt = resolveLatestPromptWorkbenchActivityAt(row);

  return {
    ...row,
    latest_activity_at: latestActivityAt,
    latest_activity_label: formatPromptWorkbenchActivityLabel(latestActivityAt),
  };
}

function comparePromptWorkbenchActivityRows(left: PromptWorkbenchProjectionRow, right: PromptWorkbenchProjectionRow) {
  const activityDiff = timestampOf(right.latest_activity_at) - timestampOf(left.latest_activity_at);

  if (activityDiff !== 0) {
    return activityDiff;
  }

  const productDiff = timestampOf(right.product) - timestampOf(left.product);

  if (productDiff !== 0) {
    return productDiff;
  }

  return right.product.id.localeCompare(left.product.id);
}

async function* loadPromptWorkbenchProductIdBatches(input: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  workspaceId?: string | null;
  search: string;
}) {
  let from = 0;

  while (true) {
    const to = from + PROMPT_WORKBENCH_PRODUCT_ID_BATCH_SIZE - 1;
    let query = input.supabase
      .from("products")
      .select("id")
      .eq("user_id", input.userId)
      .neq("status", "ARCHIVED")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);

    if (input.workspaceId) {
      query = query.eq("workspace_id", input.workspaceId);
    }

    if (input.search) {
      query = query.or(buildPromptSearchFilter(input.search));
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    const batch = (data ?? []).map((row) => row.id as string);
    if (!batch.length) {
      break;
    }

    yield batch;

    if (batch.length < PROMPT_WORKBENCH_PRODUCT_ID_BATCH_SIZE) {
      break;
    }

    from += PROMPT_WORKBENCH_PRODUCT_ID_BATCH_SIZE;
  }
}

async function collectPromptWorkbenchPageRows(input: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  workspaceId?: string | null;
  search: string;
  page: number;
  pageSize: number;
  readiness: PromptWorkbenchReadinessFilter;
  affiliateProfileContext: PromptReadinessProjectionContext;
}) {
  const collector = createPromptWorkbenchPageCollector<PromptWorkbenchProjectionRow>({
    page: input.page,
    pageSize: input.pageSize,
    readiness: input.readiness,
  });
  const projectedRows: PromptWorkbenchProjectionRow[] = [];

  for await (const productIdChunk of loadPromptWorkbenchProductIdBatches({
    supabase: input.supabase,
    userId: input.userId,
    workspaceId: input.workspaceId,
    search: input.search,
  })) {
    for (const productIdBatch of chunkValues(productIdChunk, PROMPT_WORKBENCH_PROJECTION_CHUNK_SIZE)) {
      const rows = await listPromptReadinessProjections({
        workspaceId: input.workspaceId,
        productIds: productIdBatch,
        limit: productIdBatch.length,
        affiliateProfileContext: input.affiliateProfileContext,
      });

      projectedRows.push(...rows.map(withPromptWorkbenchActivity));
    }
  }

  projectedRows.sort(comparePromptWorkbenchActivityRows);
  collector.addBatch(projectedRows);

  return collector.finish();
}

export async function listPromptWorkbenchPage(input?: PromptWorkbenchPageInput): Promise<PromptWorkbenchPageResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  const search = normalizePromptWorkbenchSearch(input?.search);
  const pageSize = clampPageSize(input?.pageSize);
  let page = normalizePage(input?.page);
  const [defaultAffiliateProfile, affiliateProfiles] = await Promise.all([
    getDefaultAffiliateProfileForWorkspace(input?.workspaceId ?? null),
    listAffiliateProfiles({ workspaceId: input?.workspaceId, status: "ACTIVE", limit: 200 }),
  ]);
  const affiliateProfileContext: PromptReadinessProjectionContext = {
    defaultAffiliateProfile,
    affiliateProfiles,
  };
  let scanResult = await collectPromptWorkbenchPageRows({
    supabase,
    userId: user.id,
    workspaceId: input?.workspaceId,
    search,
    page,
    pageSize,
    readiness: input?.readiness ?? "ALL",
    affiliateProfileContext,
  });
  let totalPages = Math.max(Math.ceil(scanResult.totalCount / pageSize), 1);

  if (scanResult.totalCount > 0 && page > totalPages) {
    page = totalPages;
    scanResult = await collectPromptWorkbenchPageRows({
      supabase,
      userId: user.id,
      workspaceId: input?.workspaceId,
      search,
      page,
      pageSize,
      readiness: input?.readiness ?? "ALL",
      affiliateProfileContext,
    });
    totalPages = Math.max(Math.ceil(scanResult.totalCount / pageSize), 1);
  }

  return {
    rows: scanResult.rows,
    totalCount: scanResult.totalCount,
    page,
    pageSize,
    totalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
    counts: scanResult.counts,
  };
}
