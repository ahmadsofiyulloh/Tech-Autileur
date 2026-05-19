import "server-only";

import { getDefaultAffiliateProfileForWorkspace, listAffiliateProfiles } from "@/lib/server/affiliate-profiles";
import {
  listPromptReadinessProjections,
  type PromptReadinessProjectionContext,
} from "@/lib/server/prompt-readiness";
import { getCurrentWorkspace, type WorkspaceRecord } from "@/lib/server/workspaces";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type DashboardActionQueueItemType =
  | "metadata_review"
  | "prompt_generation"
  | "batch_export"
  | "output_verification";

export type DashboardActionQueueItem = {
  type: DashboardActionQueueItemType;
  count: number;
  label: string;
  href: string;
};

export type DashboardActionQueueResult = {
  status: "available" | "partial" | "unavailable";
  workspaceId: string | null;
  generatedAt: string;
  items: DashboardActionQueueItem[];
  errors: Array<{ type: DashboardActionQueueItemType; message: string }>;
};

type DashboardActionContext = {
  supabase: SupabaseServerClient;
  userId: string;
  workspaceId: string | null;
};

type ActionCountSuccess = {
  type: DashboardActionQueueItemType;
  count: number;
};

type ActionCountFailure = {
  type: DashboardActionQueueItemType;
  error: string;
};

type ActionCountResult = ActionCountSuccess | ActionCountFailure;

type ContentIdRecord = {
  id: string;
};

type FlowBatchIdRecord = {
  id: string;
};

type ClipJobIdRecord = {
  id: string;
};

const PRODUCT_QUERY_BATCH_SIZE = 500;
const RELATION_CHUNK_SIZE = 150;
const PROMPT_READINESS_CHUNK_SIZE = 150;
const ACTION_PRIORITY: DashboardActionQueueItemType[] = [
  "metadata_review",
  "prompt_generation",
  "output_verification",
  "batch_export",
];
const ACTION_CONTRACT: Record<DashboardActionQueueItemType, Pick<DashboardActionQueueItem, "href" | "label">> = {
  metadata_review: {
    label: "Review metadata",
    href: "/products/new",
  },
  prompt_generation: {
    label: "Buat prompt",
    href: "/prompts?readiness=READY_FOR_PROMPT",
  },
  batch_export: {
    label: "Export manifest",
    href: "/controller",
  },
  output_verification: {
    label: "Verifikasi output",
    href: "/controller",
  },
};
const ACTION_ERROR_MESSAGES: Record<DashboardActionQueueItemType, string> = {
  metadata_review: "Metadata review tidak tersedia.",
  prompt_generation: "Prompt generation tidak tersedia.",
  batch_export: "Batch export tidak tersedia.",
  output_verification: "Output verification tidak tersedia.",
};
const OUTPUT_VERIFICATION_MATCH_STATUSES = ["UNMATCHED", "NEEDS_REVIEW", "ERROR"] as const;

function readText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function chunkValues<T>(values: readonly T[], size = RELATION_CHUNK_SIZE) {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

function isActionFailure(result: ActionCountResult): result is ActionCountFailure {
  return "error" in result;
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

async function getActionContext(input?: { workspaceId?: string | null }): Promise<DashboardActionContext> {
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

async function loadProductIds(input: DashboardActionContext) {
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

    const batch = ((data ?? []) as Array<{ id: string | null }>).map((row) => readText(row.id)).filter(Boolean);
    productIds.push(...batch);

    if (batch.length < PRODUCT_QUERY_BATCH_SIZE) {
      break;
    }

    from += PRODUCT_QUERY_BATCH_SIZE;
  }

  return Array.from(new Set(productIds));
}

async function countRowsByProductChunks(input: {
  countRows: (productIds: string[]) => Promise<number>;
  productIds: string[];
}) {
  let count = 0;

  for (const productIds of chunkValues(input.productIds)) {
    count += await input.countRows(productIds);
  }

  return count;
}

async function countMetadataReview(input: DashboardActionContext & { productIds: string[] }) {
  if (!input.productIds.length) {
    return 0;
  }

  return await countRowsByProductChunks({
    productIds: input.productIds,
    countRows: async (productIds) => {
      const { count, error } = await input.supabase
        .from("product_intake_sessions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", input.userId)
        .eq("status", "NEEDS_REVIEW")
        .in("product_id", productIds);

      if (error) {
        throw new Error(error.message);
      }

      return count ?? 0;
    },
  });
}

async function countPromptGeneration(input: DashboardActionContext & { productIds: string[] }) {
  if (!input.workspaceId || !input.productIds.length) {
    return 0;
  }

  const [defaultAffiliateProfile, affiliateProfiles] = await Promise.all([
    getDefaultAffiliateProfileForWorkspace(input.workspaceId),
    listAffiliateProfiles({ workspaceId: input.workspaceId, status: "ACTIVE", limit: 200 }),
  ]);
  const affiliateProfileContext: PromptReadinessProjectionContext = {
    defaultAffiliateProfile,
    affiliateProfiles,
  };
  let count = 0;

  for (const productIds of chunkValues(input.productIds, PROMPT_READINESS_CHUNK_SIZE)) {
    const rows = await listPromptReadinessProjections({
      workspaceId: input.workspaceId,
      productIds,
      limit: productIds.length,
      affiliateProfileContext,
    });

    count += rows.filter((row) => row.status === "READY_FOR_PROMPT").length;
  }

  return count;
}

async function countBatchExport(input: DashboardActionContext) {
  if (!input.workspaceId) {
    return 0;
  }

  const { count, error } = await input.supabase
    .from("flow_batches")
    .select("id", { count: "exact", head: true })
    .eq("user_id", input.userId)
    .eq("workspace_id", input.workspaceId)
    .eq("status", "READY_TO_EXPORT");

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

async function loadContentIds(input: DashboardActionContext & { productIds: string[] }) {
  const contentIds: string[] = [];

  for (const productIds of chunkValues(input.productIds)) {
    const { data, error } = await input.supabase
      .from("contents")
      .select("id")
      .eq("user_id", input.userId)
      .in("product_id", productIds)
      .neq("status", "ARCHIVED");

    if (error) {
      throw new Error(error.message);
    }

    contentIds.push(...((data ?? []) as ContentIdRecord[]).map((row) => row.id).filter(Boolean));
  }

  return Array.from(new Set(contentIds));
}

async function loadFlowBatchIds(input: DashboardActionContext) {
  if (!input.workspaceId) {
    return [] as string[];
  }

  const batchIds: string[] = [];
  let from = 0;

  while (true) {
    const to = from + PRODUCT_QUERY_BATCH_SIZE - 1;
    const { data, error } = await input.supabase
      .from("flow_batches")
      .select("id")
      .eq("user_id", input.userId)
      .eq("workspace_id", input.workspaceId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    const batch = ((data ?? []) as FlowBatchIdRecord[]).map((row) => row.id).filter(Boolean);
    batchIds.push(...batch);

    if (batch.length < PRODUCT_QUERY_BATCH_SIZE) {
      break;
    }

    from += PRODUCT_QUERY_BATCH_SIZE;
  }

  return Array.from(new Set(batchIds));
}

async function loadClipJobIds(input: DashboardActionContext & { batchIds: string[]; contentIds: string[] }) {
  const clipJobIds = new Set<string>();

  for (const contentIds of chunkValues(input.contentIds)) {
    const { data, error } = await input.supabase
      .from("clip_jobs")
      .select("id")
      .eq("user_id", input.userId)
      .in("content_id", contentIds)
      .neq("status", "ARCHIVED");

    if (error) {
      throw new Error(error.message);
    }

    for (const row of (data ?? []) as ClipJobIdRecord[]) {
      clipJobIds.add(row.id);
    }
  }

  for (const batchIds of chunkValues(input.batchIds)) {
    const { data, error } = await input.supabase
      .from("clip_jobs")
      .select("id")
      .eq("user_id", input.userId)
      .in("batch_id", batchIds)
      .neq("status", "ARCHIVED");

    if (error) {
      throw new Error(error.message);
    }

    for (const row of (data ?? []) as ClipJobIdRecord[]) {
      clipJobIds.add(row.id);
    }
  }

  return Array.from(clipJobIds);
}

async function countGeneratedFilesForVerification(input: DashboardActionContext & { clipJobIds: string[] }) {
  let count = 0;

  for (const clipJobIds of chunkValues(input.clipJobIds)) {
    const { count: batchCount, error } = await input.supabase
      .from("generated_files")
      .select("id", { count: "exact", head: true })
      .eq("user_id", input.userId)
      .in("clip_job_id", clipJobIds)
      .in("match_status", [...OUTPUT_VERIFICATION_MATCH_STATUSES]);

    if (error) {
      throw new Error(error.message);
    }

    count += batchCount ?? 0;
  }

  return count;
}

async function countOutputVerification(input: DashboardActionContext & { productIds: string[] }) {
  const [contentIds, batchIds] = await Promise.all([
    input.productIds.length ? loadContentIds(input) : Promise.resolve([] as string[]),
    loadFlowBatchIds(input),
  ]);
  const clipJobIds = await loadClipJobIds({
    ...input,
    batchIds,
    contentIds,
  });

  if (!clipJobIds.length) {
    return 0;
  }

  return await countGeneratedFilesForVerification({
    ...input,
    clipJobIds,
  });
}

async function runActionCount(input: {
  count: () => Promise<number>;
  type: DashboardActionQueueItemType;
}): Promise<ActionCountResult> {
  try {
    return {
      type: input.type,
      count: await input.count(),
    };
  } catch {
    return {
      type: input.type,
      error: ACTION_ERROR_MESSAGES[input.type],
    };
  }
}

function buildItems(results: ActionCountResult[]) {
  const countMap = new Map(
    results
      .filter((result): result is ActionCountSuccess => !isActionFailure(result))
      .map((result) => [result.type, result.count]),
  );

  return ACTION_PRIORITY.flatMap((type) => {
    const count = countMap.get(type) ?? 0;

    if (count <= 0) {
      return [];
    }

    return {
      type,
      count,
      label: ACTION_CONTRACT[type].label,
      href: ACTION_CONTRACT[type].href,
    } satisfies DashboardActionQueueItem;
  }).slice(0, 5);
}

export async function getDashboardActionQueue(input?: { workspaceId?: string | null }): Promise<DashboardActionQueueResult> {
  const generatedAt = new Date().toISOString();
  let workspaceId: string | null = input?.workspaceId ?? null;

  try {
    const context = await getActionContext(input);
    workspaceId = context.workspaceId;

    if (!context.workspaceId) {
      return {
        status: "available",
        workspaceId: null,
        generatedAt,
        items: [],
        errors: [],
      };
    }

    const productIds = await loadProductIds(context);
    const results = await Promise.all([
      runActionCount({
        type: "metadata_review",
        count: () => countMetadataReview({ ...context, productIds }),
      }),
      runActionCount({
        type: "prompt_generation",
        count: () => countPromptGeneration({ ...context, productIds }),
      }),
      runActionCount({
        type: "output_verification",
        count: () => countOutputVerification({ ...context, productIds }),
      }),
      runActionCount({
        type: "batch_export",
        count: () => countBatchExport(context),
      }),
    ]);
    const errors = results
      .filter(isActionFailure)
      .map((result) => ({
        type: result.type,
        message: result.error,
      }));
    const successCount = results.filter((result) => !isActionFailure(result)).length;

    return {
      status: errors.length === 0 ? "available" : successCount > 0 ? "partial" : "unavailable",
      workspaceId: context.workspaceId,
      generatedAt,
      items: buildItems(results),
      errors,
    };
  } catch {
    return {
      status: "unavailable",
      workspaceId,
      generatedAt,
      items: [],
      errors: [
        {
          type: "metadata_review",
          message: "Action queue tidak tersedia.",
        },
      ],
    };
  }
}
