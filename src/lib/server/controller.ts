import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace, type WorkspaceRecord } from "@/lib/server/workspaces";
import { getProductById, listProducts } from "@/lib/server/products";
import { getPromptPackById, listPromptPacks } from "@/lib/server/prompt-packs";
import { readPromptPackEditorPromptSet } from "@/lib/prompts/prompt-pack-contract";
import { PROMPT_CLIP_KEYS } from "@/lib/prompts/validation";
import { listDriveItemsByIds } from "@/lib/server/drive-items";
import { createContent, listContents, updateContent, type ContentRecord } from "@/lib/server/contents";
import {
  getFlowBatchById,
  listFlowBatches,
  assertFlowBatchPromptPackReady,
  type FlowBatchRecord,
} from "@/lib/server/flow-batches";
import {
  getFlowAccountPool,
  pickBestAvailableFlowAccount,
  type FlowAccountPoolRecord,
  estimateRecommendedMaxJobs,
} from "@/lib/server/flow-accounts";
import { createClipJob, listClipJobs, type ClipJobRecord, type GeneratedFileRecord } from "@/lib/server/clip-jobs";
import { PROMPT_READY_FOR_FLOW_STATUS } from "@/lib/prompts/validation";

export const READY_CONTROLLER_PROMPT_PACK_STATUSES = [PROMPT_READY_FOR_FLOW_STATUS] as const;
export const CONTROLLER_BATCH_SELECTION_DEFAULT_CAP = 25;
export const CONTROLLER_BATCH_SELECTION_HARD_CAP = 50;
type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
const CONTROLLER_RELATION_CHUNK_SIZE = 150;

export type ControllerPromptPackRecord = {
  id: string;
  user_id: string;
  product_id: string;
  intake_session_id: string | null;
  affiliate_profile_id: string | null;
  source_product_image_id: string | null;
  prompt_code: string;
  version: number;
  status: string;
  product_analysis_json: unknown | null;
  i2i_prompts_json: Record<string, unknown> | null;
  i2v_prompts_json: Record<string, unknown> | null;
  consistency_rules_json: unknown | null;
  negative_rules_json: unknown | null;
  personalization_json: Record<string, unknown> | null;
  ai_task_id: string | null;
  error_message: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ControllerProductRecord = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  product_code: string;
  product_name: string;
  niche: string | null;
  marketplace: string | null;
  marketplace_product_link: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ControllerDriveItemRecord = {
  id: string;
  user_id: string;
  item_type: string;
  drive_item_id: string | null;
  parent_id: string | null;
  parent_drive_item_id: string | null;
  name: string;
  drive_url: string;
  drive_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  purpose: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ControllerContentDraft = ContentRecord & {
  prompt_context_summary: string;
  prompt_snippet: string;
};

export type ControllerAssignmentPlanItem =
  | {
      promptPackId: string;
      promptPackCode: string;
      productId: string;
      contentId: string | null;
      recommendedAccountId: string;
      recommendedAccountCode: string;
      recommendedMaxJobs: number;
      status: "READY";
      reason: string;
    }
  | {
      promptPackId: string;
      promptPackCode: string;
      productId: string;
      contentId: string | null;
      recommendedAccountId: null;
      recommendedAccountCode: null;
      recommendedMaxJobs: 0;
      status: "SKIPPED";
      reason: string;
    };

export type ControllerDashboardState = {
  currentWorkspace: WorkspaceRecord | null;
  products: ControllerProductRecord[];
  promptPacks: ControllerPromptPackRecord[];
  readyPromptPacks: ControllerPromptPackRecord[];
  flowAccounts: FlowAccountPoolRecord[];
  flowBatches: FlowBatchRecord[];
  contents: ContentRecord[];
  clipJobs: ClipJobRecord[];
  generatedFiles: GeneratedFileRecord[];
  driveItems: ControllerDriveItemRecord[];
};

type PromptPackContextSnapshot = {
  workspace?: { workspace_code?: string; workspace_name?: string } | null;
  affiliate_profile?: { profile_code?: string; profile_name?: string } | null;
  latest_anchor?: { anchor_code?: string; version?: number } | null;
  marketplace_sources?: unknown[] | null;
};

function readText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function todayInJakarta() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toPromptPackContextSnapshot(promptPack: ControllerPromptPackRecord): PromptPackContextSnapshot {
  const personalization = promptPack.personalization_json;

  if (!personalization || !isRecord(personalization)) {
    return {};
  }

  const context = personalization.prompt_context;

  if (!isRecord(context)) {
    return {};
  }

  const workspace = context.workspace ?? context.currentWorkspace;
  const affiliateProfile = context.affiliate_profile ?? context.affiliateProfile;
  const latestAnchor = context.latest_anchor ?? context.latestAnchor;
  const marketplaceSources = context.marketplace_sources ?? context.marketplaceSources;

  return {
    workspace: isRecord(workspace)
      ? {
          workspace_code: typeof workspace.workspace_code === "string" ? workspace.workspace_code : undefined,
          workspace_name: typeof workspace.workspace_name === "string" ? workspace.workspace_name : undefined,
        }
      : null,
    affiliate_profile: isRecord(affiliateProfile)
      ? {
          profile_code: typeof affiliateProfile.profile_code === "string" ? affiliateProfile.profile_code : undefined,
          profile_name: typeof affiliateProfile.profile_name === "string" ? affiliateProfile.profile_name : undefined,
        }
      : null,
    latest_anchor: isRecord(latestAnchor)
      ? {
          anchor_code: typeof latestAnchor.anchor_code === "string" ? latestAnchor.anchor_code : undefined,
          version: typeof latestAnchor.version === "number" ? latestAnchor.version : undefined,
        }
      : null,
    marketplace_sources: Array.isArray(marketplaceSources) ? marketplaceSources : null,
  };
}

function firstPromptFromObject(value: unknown) {
  if (!isRecord(value)) {
    return "";
  }

  const prompt = value.prompt;
  return typeof prompt === "string" ? prompt.trim() : "";
}

function firstTextFromObject(value: unknown, keys: string[]) {
  if (!isRecord(value)) {
    return "";
  }

  for (const key of keys) {
    const text = value[key];

    if (typeof text === "string" && text.trim()) {
      return text.trim();
    }
  }

  return "";
}

function buildPromptSnippet(promptPack: ControllerPromptPackRecord) {
  const i2v = promptPack.i2v_prompts_json;
  const i2i = promptPack.i2i_prompts_json;
  const candidates = [
    firstPromptFromObject(i2v?.clip_1),
    firstPromptFromObject(i2v?.clip_2),
    firstTextFromObject(i2i?.clip_1, ["first_frame", "last_frame"]),
    firstTextFromObject(i2i?.clip_2, ["first_frame", "last_frame"]),
    firstPromptFromObject(i2v?.clip_01),
    firstPromptFromObject(i2v?.clip_02),
  ];

  return candidates.find(Boolean) ?? `Paket prompt ${promptPack.prompt_code} v${promptPack.version}.`;
}

export function buildPromptContextSummary(promptPack: ControllerPromptPackRecord) {
  const snapshot = toPromptPackContextSnapshot(promptPack);
  const parts = [
    snapshot.workspace?.workspace_code ? `Ruang kerja ${snapshot.workspace.workspace_code}` : null,
    snapshot.affiliate_profile?.profile_code ? `Profil ${snapshot.affiliate_profile.profile_code}` : null,
    snapshot.latest_anchor?.anchor_code ? `Anchor ${snapshot.latest_anchor.anchor_code} v${snapshot.latest_anchor.version ?? 1}` : null,
    snapshot.marketplace_sources?.length ? `${snapshot.marketplace_sources.length} sumber` : null,
  ].filter(Boolean);

  return parts.length ? parts.join(" - ") : "Belum ada konteks prompt tersimpan.";
}

export function buildClipJobDraft(input: {
  content: ControllerContentDraft;
  promptPack?: ControllerPromptPackRecord | null;
  batch?: FlowBatchRecord | null;
}) {
  const content = input.content;
  const promptPack = input.promptPack ?? null;
  const batch = input.batch ?? null;
  const promptSnippet = promptPack ? buildPromptSnippet(promptPack) : content.caption_tiktok || content.caption_shopee || content.angle || content.hook_type || content.content_code;
  const promptContextSummary = promptPack ? buildPromptContextSummary(promptPack) : "Belum ada konteks prompt tersimpan.";
  const promptPrefix = [
    promptPack?.prompt_code ?? null,
    content.content_code,
    batch?.batch_code ?? null,
  ]
    .filter(Boolean)
    .join(" / ");

  return {
    prompt_prefix: promptPrefix || `${content.content_code} / clip`,
    prompt_one_paragraph: [
      promptSnippet,
      promptContextSummary,
      content.platform ? `Platform ${content.platform}.` : null,
      batch ? `Batch ${batch.batch_code}.` : null,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

function filterReadyPromptPacks(promptPacks: ControllerPromptPackRecord[]) {
  return promptPacks
    .filter((pack) => READY_CONTROLLER_PROMPT_PACK_STATUSES.includes(pack.status as (typeof READY_CONTROLLER_PROMPT_PACK_STATUSES)[number]))
    .sort((left, right) => left.created_at.localeCompare(right.created_at));
}

function buildExistingPromptPackBatchSet(batches: FlowBatchRecord[]) {
  return new Set(batches.filter((batch) => batch.prompt_pack_id && batch.status !== "CLOSED").map((batch) => batch.prompt_pack_id as string));
}

function normalizeControllerCode(value: string | null | undefined, fallback: string) {
  const normalized = readText(value)
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase();

  return normalized || fallback;
}

function controllerClipCode(index: number) {
  return `CLIP${String(index).padStart(2, "0")}`;
}

function chunkValues<T>(values: readonly T[], size = CONTROLLER_RELATION_CHUNK_SIZE) {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

function uniqueTextValues(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

async function loadWorkspaceContents(input: {
  supabase: SupabaseServerClient;
  userId: string;
  productIds: string[];
}) {
  if (!input.productIds.length) {
    return [] as ContentRecord[];
  }

  const rows: ContentRecord[] = [];

  for (const productIds of chunkValues(input.productIds)) {
    const { data, error } = await input.supabase
      .from("contents")
      .select("*")
      .eq("user_id", input.userId)
      .in("product_id", productIds)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    rows.push(...((data ?? []) as ContentRecord[]));
  }

  return rows.sort((left, right) => right.created_at.localeCompare(left.created_at) || right.id.localeCompare(left.id));
}

async function loadWorkspaceClipJobs(input: {
  supabase: SupabaseServerClient;
  userId: string;
  contentIds: string[];
  batchIds: string[];
}) {
  const rowsById = new Map<string, ClipJobRecord>();

  for (const contentIds of chunkValues(input.contentIds)) {
    const { data, error } = await input.supabase
      .from("clip_jobs")
      .select("*")
      .eq("user_id", input.userId)
      .in("content_id", contentIds)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    for (const clipJob of (data ?? []) as ClipJobRecord[]) {
      rowsById.set(clipJob.id, clipJob);
    }
  }

  for (const batchIds of chunkValues(input.batchIds)) {
    const { data, error } = await input.supabase
      .from("clip_jobs")
      .select("*")
      .eq("user_id", input.userId)
      .in("batch_id", batchIds)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    for (const clipJob of (data ?? []) as ClipJobRecord[]) {
      rowsById.set(clipJob.id, clipJob);
    }
  }

  return Array.from(rowsById.values()).sort(
    (left, right) => right.created_at.localeCompare(left.created_at) || right.id.localeCompare(left.id),
  );
}

async function loadWorkspaceGeneratedFiles(input: {
  supabase: SupabaseServerClient;
  userId: string;
  clipJobIds: string[];
}) {
  if (!input.clipJobIds.length) {
    return [] as GeneratedFileRecord[];
  }

  const rows: GeneratedFileRecord[] = [];

  for (const clipJobIds of chunkValues(input.clipJobIds)) {
    const { data, error } = await input.supabase
      .from("generated_files")
      .select("*")
      .eq("user_id", input.userId)
      .in("clip_job_id", clipJobIds)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    rows.push(...((data ?? []) as GeneratedFileRecord[]));
  }

  return rows.sort((left, right) => right.created_at.localeCompare(left.created_at) || right.id.localeCompare(left.id));
}

async function loadWorkspaceDriveItems(ids: Array<string | null | undefined>) {
  const driveItems = new Map<string, ControllerDriveItemRecord>();

  for (const driveItemIds of chunkValues(uniqueTextValues(ids))) {
    const batch = await listDriveItemsByIds(driveItemIds);

    for (const driveItem of batch) {
      driveItems.set(driveItem.id, driveItem as ControllerDriveItemRecord);
    }
  }

  return Array.from(driveItems.values()).sort(
    (left, right) => right.created_at.localeCompare(left.created_at) || right.id.localeCompare(left.id),
  );
}

async function ensureControllerContentForPromptPack(input: {
  product: ControllerProductRecord;
  promptPack: ControllerPromptPackRecord;
}) {
  const existingContents = await listContents({ productId: input.product.id, limit: 200 });
  const matchingContent =
    existingContents.find((content) => content.prompt_pack_id === input.promptPack.id) ??
    existingContents.find((content) => !content.prompt_pack_id && content.content_code === input.product.product_code) ??
    null;

  if (matchingContent?.prompt_pack_id === input.promptPack.id) {
    return matchingContent;
  }

  if (matchingContent) {
    return await updateContent(matchingContent.id, {
      prompt_pack_id: input.promptPack.id,
      status: matchingContent.status,
    });
  }

  try {
    return await createContent({
      product_id: input.product.id,
      content_code: input.product.product_code,
      platform: "SHOPEE_TIKTOK",
      prompt_pack_id: input.promptPack.id,
      status: "DRAFT",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message.toLowerCase().includes("duplicate key value")) {
      const refreshedContents = await listContents({ productId: input.product.id, limit: 200 });
      const duplicateContent = refreshedContents.find((content) => !content.prompt_pack_id && content.content_code === input.product.product_code);

      if (duplicateContent) {
        return await updateContent(duplicateContent.id, {
          prompt_pack_id: input.promptPack.id,
          status: duplicateContent.status,
        });
      }

      return await createContent({
        product_id: input.product.id,
        platform: "SHOPEE_TIKTOK",
        prompt_pack_id: input.promptPack.id,
        status: "DRAFT",
      });
    }

    throw error;
  }
}

export async function materializeFlowBatchClipJobs(batchId: string) {
  const batch = await getFlowBatchById(batchId);

  if (!batch) {
    throw new Error("Flow batch tidak ditemukan.");
  }

  if (!batch.prompt_pack_id || !batch.product_id) {
    throw new Error("Batch harus punya prompt pack dan produk.");
  }

  const [product, promptPack, existingClipJobs] = await Promise.all([
    getProductById(batch.product_id),
    getPromptPackById(batch.prompt_pack_id),
    listClipJobs({ batchId: batch.id, limit: 20 }),
  ]);

  if (!product) {
    throw new Error("Produk batch tidak ditemukan.");
  }

  if (!promptPack) {
    throw new Error("Prompt pack batch tidak ditemukan.");
  }

  assertFlowBatchPromptPackReady(promptPack);

  const content = await ensureControllerContentForPromptPack({ product, promptPack });
  const promptSet = readPromptPackEditorPromptSet(promptPack);
  const existingClipCodes = new Set(existingClipJobs.map((job) => job.clip_code));
  const createdJobs: ClipJobRecord[] = [];

  for (const [index, clipKey] of PROMPT_CLIP_KEYS.entries()) {
    const clipCode = controllerClipCode(index + 1);

    if (existingClipCodes.has(clipCode)) {
      continue;
    }

    const clip = promptSet.clips[clipKey];
    const promptParagraph =
      readText(clip.i2v_prompt) ||
      [clip.i2i_first_frame, clip.i2i_last_frame].map(readText).filter(Boolean).join(" ");

    if (!promptParagraph) {
      throw new Error("Prompt clip belum lengkap.");
    }

    createdJobs.push(
      await createClipJob({
        content_id: content.id,
        prompt_pack_id: promptPack.id,
        batch_id: batch.id,
        job_code: `${normalizeControllerCode(batch.batch_code, "BATCH")}-${clipCode}`,
        clip_code: clipCode,
        version: "V01",
        prompt_prefix: [promptPack.prompt_code, product.product_code, clipCode].filter(Boolean).join(" / "),
        prompt_one_paragraph: promptParagraph,
        status: "READY",
      }),
    );
  }

  return {
    batch,
    content,
    createdCount: createdJobs.length,
    existingCount: existingClipJobs.length,
  };
}

function summarizeUnavailableFlowAccounts(accounts: FlowAccountPoolRecord[]) {
  if (!accounts.length) {
    return "Belum ada akun Flow.";
  }

  const reasons = Array.from(new Set(accounts.flatMap((account) => account.eligibility_reasons))).slice(0, 3);
  return reasons.length ? `Tidak ada akun Flow layak: ${reasons.join(", ")}.` : "Tidak ada akun Flow yang layak.";
}

export function buildFlowAssignmentPlan(input: {
  promptPacks: ControllerPromptPackRecord[];
  accounts: FlowAccountPoolRecord[];
  existingPromptPackIds?: Set<string>;
}) {
  const readyPromptPacks = filterReadyPromptPacks(input.promptPacks);
  const existingPromptPackIds = input.existingPromptPackIds ?? new Set<string>();
  const accountPool = input.accounts.map((account) => ({ ...account }));
  const plan: ControllerAssignmentPlanItem[] = [];

  for (const promptPack of readyPromptPacks) {
    if (existingPromptPackIds.has(promptPack.id)) {
      plan.push({
        promptPackId: promptPack.id,
        promptPackCode: promptPack.prompt_code,
        productId: promptPack.product_id,
        contentId: null,
        recommendedAccountId: null,
        recommendedAccountCode: null,
        recommendedMaxJobs: 0,
        status: "SKIPPED",
        reason: "Sudah dipakai batch lain.",
      });
      continue;
    }

    const account = pickBestAvailableFlowAccount(accountPool);

    if (!account) {
      plan.push({
        promptPackId: promptPack.id,
        promptPackCode: promptPack.prompt_code,
        productId: promptPack.product_id,
        contentId: null,
        recommendedAccountId: null,
        recommendedAccountCode: null,
        recommendedMaxJobs: 0,
        status: "SKIPPED",
        reason: summarizeUnavailableFlowAccounts(accountPool),
      });
      continue;
    }

    const recommendedMaxJobs = estimateRecommendedMaxJobs(account);
    if (!recommendedMaxJobs) {
      plan.push({
        promptPackId: promptPack.id,
        promptPackCode: promptPack.prompt_code,
        productId: promptPack.product_id,
        contentId: null,
        recommendedAccountId: null,
        recommendedAccountCode: null,
        recommendedMaxJobs: 0,
        status: "SKIPPED",
        reason: "Kredit akun tidak cukup untuk satu job.",
      });
      continue;
    }

    plan.push({
      promptPackId: promptPack.id,
      promptPackCode: promptPack.prompt_code,
      productId: promptPack.product_id,
      contentId: null,
      recommendedAccountId: account.id,
      recommendedAccountCode: account.account_code,
      recommendedMaxJobs,
      status: "READY",
      reason: account.account_type === "FLOW_PLUS" ? "Pakai akun cadangan Flow Plus." : "Pakai akun Flow Free yang tersedia.",
    });

    account.open_batch_count += 1;
    account.credits_remaining = Math.max(account.credits_remaining - recommendedMaxJobs * account.credit_per_generation, 0);
    account.slots_remaining = Math.max(account.slots_remaining - 1, 0);
    account.cooldown_remaining_minutes = account.cooldown_minutes > 0 ? account.cooldown_minutes : account.cooldown_remaining_minutes;
    account.is_available =
      account.status === "ACTIVE" &&
      account.slots_remaining > 0 &&
      account.credits_remaining >= account.credit_per_generation &&
      account.cooldown_remaining_minutes === 0;
  }

  return plan;
}

export async function getControllerDashboardState() {
  const currentWorkspace = await getCurrentWorkspace();
  const targetDate = todayInJakarta();
  const flowAccountsPromise = getFlowAccountPool({ targetDate });

  if (!currentWorkspace) {
    const flowAccounts = await flowAccountsPromise;

    return {
      currentWorkspace: null,
      products: [],
      promptPacks: [],
      readyPromptPacks: [],
      flowAccounts,
      flowBatches: [],
      contents: [],
      clipJobs: [],
      generatedFiles: [],
      driveItems: [],
    } satisfies ControllerDashboardState;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Autentikasi diperlukan.");
  }

  const [products, promptPacks, flowBatches, flowAccounts] = await Promise.all([
    listProducts({ workspaceId: currentWorkspace.id, limit: 200 }),
    listPromptPacks({ workspaceId: currentWorkspace.id, limit: 200 }),
    listFlowBatches({ workspaceId: currentWorkspace.id, limit: 200 }),
    flowAccountsPromise,
  ]);

  const workspaceProducts = products as ControllerProductRecord[];
  const workspaceProductIds = workspaceProducts.map((product) => product.id);
  const contents = await loadWorkspaceContents({
    supabase,
    userId: user.id,
    productIds: workspaceProductIds,
  });
  const workspaceContentIds = contents.map((content) => content.id);
  const workspaceBatchIds = flowBatches.map((batch) => batch.id);
  const clipJobs = await loadWorkspaceClipJobs({
    supabase,
    userId: user.id,
    contentIds: workspaceContentIds,
    batchIds: workspaceBatchIds,
  });
  const generatedFiles = await loadWorkspaceGeneratedFiles({
    supabase,
    userId: user.id,
    clipJobIds: clipJobs.map((clipJob) => clipJob.id),
  });
  const driveItems = await loadWorkspaceDriveItems([
    ...clipJobs.flatMap((clipJob) => [clipJob.start_frame_drive_item_id, clipJob.last_frame_drive_item_id, clipJob.generated_drive_item_id]),
    ...generatedFiles.map((file) => file.drive_item_id),
  ]);

  return {
    currentWorkspace,
    products: workspaceProducts,
    promptPacks: promptPacks as ControllerPromptPackRecord[],
    readyPromptPacks: filterReadyPromptPacks(promptPacks as ControllerPromptPackRecord[]),
    flowAccounts,
    flowBatches,
    contents,
    clipJobs,
    generatedFiles,
    driveItems,
  } satisfies ControllerDashboardState;
}
