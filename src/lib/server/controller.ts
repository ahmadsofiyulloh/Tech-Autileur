import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentWorkspace, type WorkspaceRecord } from "@/lib/server/workspaces";
import { listProducts } from "@/lib/server/products";
import { listPromptPacks } from "@/lib/server/prompt-packs";
import { listDriveItems } from "@/lib/server/drive-items";
import { createContent, listContents, type ContentRecord, buildContentCode } from "@/lib/server/contents";
import {
  createFlowBatch,
  listFlowBatches,
  type FlowBatchRecord,
  buildFlowBatchCode,
} from "@/lib/server/flow-batches";
import {
  createFlowAccount,
  getFlowAccountPool,
  pickBestAvailableFlowAccount,
  type FlowAccountPoolRecord,
  type FlowAccountRecord,
  estimateRecommendedMaxJobs,
} from "@/lib/server/flow-accounts";
import { createClipJob, listClipJobs, listGeneratedFiles, type ClipJobRecord, type GeneratedFileRecord } from "@/lib/server/clip-jobs";

export const READY_CONTROLLER_PROMPT_PACK_STATUSES = ["GENERATED", "NEEDS_REVIEW", "APPROVED"] as const;

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
  currentWorkspace?: { workspace_code?: string; workspace_name?: string } | null;
  affiliateProfile?: { profile_code?: string; profile_name?: string } | null;
  latestAnchor?: { anchor_code?: string; version?: number } | null;
  marketplaceSources?: unknown[] | null;
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

  return {
    currentWorkspace: isRecord(context.currentWorkspace)
      ? {
          workspace_code: typeof context.currentWorkspace.workspace_code === "string" ? context.currentWorkspace.workspace_code : undefined,
          workspace_name: typeof context.currentWorkspace.workspace_name === "string" ? context.currentWorkspace.workspace_name : undefined,
        }
      : null,
    affiliateProfile: isRecord(context.affiliateProfile)
      ? {
          profile_code: typeof context.affiliateProfile.profile_code === "string" ? context.affiliateProfile.profile_code : undefined,
          profile_name: typeof context.affiliateProfile.profile_name === "string" ? context.affiliateProfile.profile_name : undefined,
        }
      : null,
    latestAnchor: isRecord(context.latestAnchor)
      ? {
          anchor_code: typeof context.latestAnchor.anchor_code === "string" ? context.latestAnchor.anchor_code : undefined,
          version: typeof context.latestAnchor.version === "number" ? context.latestAnchor.version : undefined,
        }
      : null,
    marketplaceSources: Array.isArray(context.marketplaceSources) ? context.marketplaceSources : null,
  };
}

function firstPromptFromObject(value: unknown) {
  if (!isRecord(value)) {
    return "";
  }

  const prompt = value.prompt;
  return typeof prompt === "string" ? prompt.trim() : "";
}

function buildPromptSnippet(promptPack: ControllerPromptPackRecord) {
  const i2v = promptPack.i2v_prompts_json;
  const i2i = promptPack.i2i_prompts_json;
  const candidates = [
    firstPromptFromObject(i2v?.clip_01),
    firstPromptFromObject(i2v?.clip_02),
    firstPromptFromObject(i2i?.clip_01_start_frame),
    firstPromptFromObject(i2i?.clip_01_last_frame),
  ];

  return candidates.find(Boolean) ?? `Prompt pack ${promptPack.prompt_code} v${promptPack.version}.`;
}

export function buildPromptContextSummary(promptPack: ControllerPromptPackRecord) {
  const snapshot = toPromptPackContextSnapshot(promptPack);
  const parts = [
    snapshot.currentWorkspace?.workspace_code ? `WS ${snapshot.currentWorkspace.workspace_code}` : null,
    snapshot.affiliateProfile?.profile_code ? `Profile ${snapshot.affiliateProfile.profile_code}` : null,
    snapshot.latestAnchor?.anchor_code ? `Anchor ${snapshot.latestAnchor.anchor_code} v${snapshot.latestAnchor.version ?? 1}` : null,
    snapshot.marketplaceSources?.length ? `${snapshot.marketplaceSources.length} source(s)` : null,
  ].filter(Boolean);

  return parts.length ? parts.join(" · ") : "No persisted prompt context.";
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
  const promptContextSummary = promptPack ? buildPromptContextSummary(promptPack) : "No persisted prompt context.";
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
        reason: "Already assigned to a batch.",
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
        reason: "No available Flow account meets credit and slot requirements.",
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
        reason: "Available account does not have enough credit for a job.",
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
      reason: account.account_type === "FLOW_PLUS" ? "Fallback to Flow Plus reserve account." : "Assigned to an available Flow Free account.",
    });

    account.open_batch_count += 1;
    account.credits_remaining = Math.max(account.credits_remaining - recommendedMaxJobs * account.credit_per_generation, 0);
    account.slots_remaining = Math.max(account.slots_remaining - 1, 0);
    account.is_available = account.status === "ACTIVE" && account.slots_remaining > 0 && account.credits_remaining >= account.credit_per_generation;
  }

  return plan;
}

async function ensureContentForPromptPack(
  promptPack: ControllerPromptPackRecord,
  product: ControllerProductRecord,
  existingContents: ContentRecord[],
) {
  const existing = existingContents.find((content) => content.prompt_pack_id === promptPack.id && content.product_id === product.id);

  if (existing) {
    return existing;
  }

  return await createContent({
    product_id: product.id,
    content_code: buildContentCode(product.product_code),
    platform: product.marketplace,
    hook_type: "EXECUTION",
    angle: null,
    caption_tiktok: null,
    caption_shopee: null,
    prompt_pack_id: promptPack.id,
    status: "READY",
  });
}

export async function getControllerDashboardState() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  const targetDate = todayInJakarta();
  const [currentWorkspace, products, promptPacks, flowAccounts, flowBatches, contents, clipJobs, generatedFiles, driveItems] =
    await Promise.all([
      getCurrentWorkspace(),
      listProducts({ limit: 200 }),
      listPromptPacks({ limit: 200 }),
      getFlowAccountPool({ targetDate, limit: 200 }),
      listFlowBatches({ limit: 200 }),
      listContents({ limit: 200 }),
      listClipJobs({ limit: 200 }),
      listGeneratedFiles({ limit: 200 }),
      listDriveItems({ limit: 200 }),
    ]);

  return {
    currentWorkspace,
    products: products as ControllerProductRecord[],
    promptPacks: promptPacks as ControllerPromptPackRecord[],
    readyPromptPacks: filterReadyPromptPacks(promptPacks as ControllerPromptPackRecord[]),
    flowAccounts,
    flowBatches,
    contents,
    clipJobs,
    generatedFiles,
    driveItems: driveItems as ControllerDriveItemRecord[],
  } satisfies ControllerDashboardState;
}

export async function autoAssignReadyPromptPacks(input?: { targetDate?: string | null }) {
  const state = await getControllerDashboardState();
  const existingPromptPackIds = buildExistingPromptPackBatchSet(state.flowBatches);
  const plan = buildFlowAssignmentPlan({
    promptPacks: state.promptPacks,
    accounts: state.flowAccounts,
    existingPromptPackIds,
  });
  const targetDate = input?.targetDate?.trim() || todayInJakarta();
  const createdBatches: FlowBatchRecord[] = [];
  const createdContents: ContentRecord[] = [];
  let skipped = 0;

  for (const item of plan) {
    if (item.status !== "READY" || !item.recommendedAccountId) {
      skipped += 1;
      continue;
    }

    const promptPack = state.promptPacks.find((entry) => entry.id === item.promptPackId);
    const product = state.products.find((entry) => entry.id === item.productId);

    if (!promptPack || !product) {
      skipped += 1;
      continue;
    }

    const content = await ensureContentForPromptPack(promptPack, product, state.contents);
    createdContents.push(content);

    const batch = await createFlowBatch({
      workspace_id: product.workspace_id ?? state.currentWorkspace?.id ?? null,
      product_id: product.id,
      prompt_pack_id: promptPack.id,
      flow_account_id: item.recommendedAccountId,
      batch_code: buildFlowBatchCode({
        promptPackCode: promptPack.prompt_code,
        accountCode: item.recommendedAccountCode,
        targetDate,
      }),
      target_date: targetDate,
      model: "google-flow",
      max_jobs: item.recommendedMaxJobs,
      status: "READY_TO_EXPORT",
    });

    createdBatches.push(batch);
  }

  return {
    createdBatches,
    createdContents,
    skipped,
    plan,
  };
}

