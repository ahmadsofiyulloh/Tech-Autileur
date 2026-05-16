import "server-only";

import { listPromptReadinessProjections, type PromptReadinessProjectionRow } from "@/lib/server/prompt-readiness";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  PROMPT_WORKBENCH_PAGE_SIZE,
  countPromptWorkbenchRows,
  filterPromptWorkbenchRows,
  normalizePromptWorkbenchSearch,
  type PromptWorkbenchReadinessCounts,
  type PromptWorkbenchReadinessFilter,
} from "@/lib/prompts/prompt-workbench";

export type PromptWorkbenchPageInput = {
  workspaceId?: string | null;
  search?: string | string[] | undefined;
  page?: number;
  pageSize?: number;
  readiness?: PromptWorkbenchReadinessFilter;
};

export type PromptWorkbenchPageResult = {
  rows: PromptReadinessProjectionRow[];
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

async function loadPromptWorkbenchProductIds(input: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  workspaceId?: string | null;
  search: string;
}) {
  const productIds: string[] = [];
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
    productIds.push(...batch);

    if (batch.length < PROMPT_WORKBENCH_PRODUCT_ID_BATCH_SIZE) {
      break;
    }

    from += PROMPT_WORKBENCH_PRODUCT_ID_BATCH_SIZE;
  }

  return productIds;
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
  const productIds = await loadPromptWorkbenchProductIds({
    supabase,
    userId: user.id,
    workspaceId: input?.workspaceId,
    search,
  });
  const orderMap = new Map(productIds.map((productId, index) => [productId, index]));
  const projectedRows: PromptReadinessProjectionRow[] = [];

  for (const productIdChunk of chunkValues(productIds, PROMPT_WORKBENCH_PROJECTION_CHUNK_SIZE)) {
    const rows = await listPromptReadinessProjections({
      workspaceId: input?.workspaceId,
      productIds: productIdChunk,
      limit: productIdChunk.length,
    });

    projectedRows.push(...rows);
  }

  projectedRows.sort((left, right) => (orderMap.get(left.product.id) ?? 0) - (orderMap.get(right.product.id) ?? 0));

  const counts = countPromptWorkbenchRows(projectedRows);
  const filteredRows = filterPromptWorkbenchRows(projectedRows, input?.readiness ?? "ALL");
  const totalCount = filteredRows.length;
  const totalPages = Math.max(Math.ceil(totalCount / pageSize), 1);

  if (totalCount > 0 && page > totalPages) {
    page = totalPages;
  }

  const from = (page - 1) * pageSize;
  const rows = filteredRows.slice(from, from + pageSize);
  const resolvedTotalPages = Math.max(Math.ceil(totalCount / pageSize), 1);

  return {
    rows,
    totalCount,
    page,
    pageSize,
    totalPages: resolvedTotalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < resolvedTotalPages,
    counts,
  };
}
