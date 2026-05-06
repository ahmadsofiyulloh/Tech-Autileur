import "server-only";

import { revalidatePath } from "next/cache";
import {
  createAITask,
  markTaskFailed,
  markTaskRunning,
  markTaskSuccess,
  markTaskWaitingForKey,
} from "@/lib/server/ai-task-queue";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import { isAffiliateProfileAssetAnalysisReady } from "@/lib/affiliate-profiles/readiness";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  PROMPT_CLIP_KEYS,
  PROMPT_PACK_STATUSES,
  PROMPT_READY_FOR_FLOW_STATUS,
  PROMPT_TARGET_MARKETPLACE,
  type PromptPackStatus,
  isPromptPackStatus,
  normalizePromptCode,
} from "@/lib/prompts/validation";
import type { GeminiModelName } from "@/lib/gemini/validation";
import { GEMINI_PROMPT_PACK_RESPONSE_SCHEMA } from "@/lib/gemini/json-schemas";
import { GeminiClientError } from "@/lib/server/gemini-client";
import { getGeminiSecretRotationErrorMessage, readGeminiSecretForKey } from "@/lib/server/gemini-secret";
import { generateTrackedGeminiJsonText } from "@/lib/server/gemini-usage-events";
import {
  getGeminiQuotaGroupKey,
  listQuotaAwareGeminiKeys,
  markGeminiKeySuccess,
  markGeminiQuotaGroupCooldown,
  type GeminiRoutableKey,
} from "@/lib/server/gemini-key-routing";
import {
  buildPromptPackStoragePayload,
  parsePromptPackGenerationOutput,
  readPromptPackEditorPromptSet,
  type JsonObject,
  type PromptPackPromptRulesJson,
  type PromptPackStoragePayload,
  type PromptPackGenerationOutput,
  type PromptPackVisualReferenceJson,
} from "@/lib/prompts/prompt-pack-contract";
import { getCurrentWorkspace, getWorkspaceById } from "@/lib/server/workspaces";
import {
  getAffiliateProfileById,
  getDefaultAffiliateProfileForWorkspace,
  type AffiliateProfileRecord,
} from "@/lib/server/affiliate-profiles";
import { getIntakeSessionById, getLatestIntakeSessionForProduct, listIntakeSessions } from "@/lib/server/intake";
import { getLatestMarketplaceSourceContext, type MarketplaceSourceRecord } from "@/lib/server/product-marketplace-sources";
import { getLatestProductAnchor, type ProductAnchorRecord } from "@/lib/server/product-anchors";

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
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type ProductImageRecord = {
  id: string;
  user_id: string;
  product_id: string;
  drive_item_ref_id: string;
  source_type: string;
  is_primary: boolean;
  analysis_json: JsonObject | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type PromptPackSourceDriveItemSnapshot = {
  id: string;
  name: string;
  drive_path: string;
  drive_url: string;
  mime_type: string | null;
};

type PromptPackSourceImageSnapshot = {
  id: string;
  is_primary: boolean;
  status: string;
  source_type: string;
  drive_item_ref_id: string;
  analysis_json: JsonObject | null;
  drive_item: PromptPackSourceDriveItemSnapshot | null;
};

type PromptPackRecord = {
  id: string;
  user_id: string;
  product_id: string;
  intake_session_id: string | null;
  affiliate_profile_id: string | null;
  source_product_image_id: string | null;
  prompt_code: string;
  version: number;
  status: PromptPackStatus;
  product_analysis_json: JsonObject | null;
  i2i_prompts_json: JsonObject | null;
  i2v_prompts_json: JsonObject | null;
  consistency_rules_json: JsonObject | null;
  negative_rules_json: JsonObject | null;
  personalization_json: JsonObject | null;
  ai_task_id: string | null;
  error_message: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type AiTaskRecord = {
  id: string;
  user_id: string;
  gemini_api_key_id: string | null;
  task_type: string;
  status: string;
  input_json: JsonObject;
  output_json: JsonObject | null;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

type PromptPackInput = {
  product_id: string;
  intake_session_id?: string | null;
  affiliate_profile_id?: string | null;
  source_product_image_id?: string | null;
  prompt_code?: string | null;
  version?: number;
  status?: string;
  product_analysis_json?: JsonObject | null;
  i2i_prompts_json?: JsonObject | null;
  i2v_prompts_json?: JsonObject | null;
  consistency_rules_json?: JsonObject | null;
  negative_rules_json?: JsonObject | null;
  personalization_json?: JsonObject | null;
  error_message?: string | null;
  notes?: string | null;
};

type PromptPackUpdateInput = Partial<PromptPackInput>;

type MockPromptContext = {
  promptPack: PromptPackRecord;
  product: ProductRecord;
  currentWorkspace:
    | {
        id: string;
        workspace_code: string;
        workspace_name: string;
        niche: string | null;
        drive_root_folder_ref_id: string | null;
        drive_root_folder_url: string | null;
        drive_root_folder_path: string | null;
        status: string;
        is_default: boolean;
      }
    | null;
  intakeSession: { id: string; intake_code: string; status: string; product_title: string | null; shopee_url: string | null; tiktok_url: string | null; raw_notes: string | null; parsed_metadata_json: JsonObject | null; reviewed_metadata_json: JsonObject | null; workspace_id: string | null } | null;
  affiliateProfile: AffiliateProfileRecord | null;
  latestAnchor: ProductAnchorRecord | null;
  marketplaceSources: MarketplaceSourceRecord[];
  sourceProductImage: ProductImageRecord | null;
  sourceDriveItem: { id: string; name: string; drive_path: string; drive_url: string; mime_type: string | null } | null;
};

type PromptPackGenerationMode = "mock" | "gemini";

type PromptPackGenerationContext = {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  serviceClient: ReturnType<typeof createSupabaseServiceRoleClient>;
  user: { id: string };
  promptPack: PromptPackRecord;
  product: ProductRecord;
  currentWorkspace: MockPromptContext["currentWorkspace"];
  intakeSession: MockPromptContext["intakeSession"];
  affiliateProfile: AffiliateProfileRecord | null;
  latestAnchor: ProductAnchorRecord | null;
  marketplaceSources: MarketplaceSourceRecord[];
  sourceProductImage: ProductImageRecord | null;
  sourceDriveItem: { id: string; name: string; drive_path: string; drive_url: string; mime_type: string | null } | null;
  promptContext: JsonObject;
};

function readText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableText(value: string | null | undefined) {
  const trimmed = readText(value);
  return trimmed.length > 0 ? trimmed : null;
}

function buildPromptCode(productCode: string | null | undefined) {
  const base = readText(productCode)
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const prefix = base ? `PROMPT-${base.toUpperCase()}` : "PROMPT";

  return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function assertPromptPackStatus(value: string): asserts value is PromptPackStatus {
  if (!isPromptPackStatus(value)) {
    throw new Error(`Invalid prompt pack status. Expected one of: ${PROMPT_PACK_STATUSES.join(", ")}.`);
  }
}

function ensurePromptVersion(value: number) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error("Prompt version must be a whole number greater than or equal to 1.");
  }

  return value;
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

async function requireOwnedProduct(productId: string) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, user_id, workspace_id, product_code, product_name, niche, marketplace, marketplace_product_link, status, notes, created_at, updated_at",
    )
    .eq("id", productId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Product not found.");
  }

  return { supabase, user, product: data as ProductRecord };
}

async function requireOwnedProductImage(productImageId: string, productId: string) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("product_images")
    .select("id, user_id, product_id, drive_item_ref_id, source_type, is_primary, analysis_json, status, notes, created_at, updated_at")
    .eq("id", productImageId)
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Source product image not found.");
  }

  return { supabase, user, productImage: data as ProductImageRecord };
}

async function requireOwnedPromptPack(id: string) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("prompt_packs")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Prompt pack not found.");
  }

  return { supabase, user, promptPack: data as PromptPackRecord };
}

type DriveItemRecord = {
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

function buildDriveItemSnapshot(
  item: PromptPackSourceDriveItemSnapshot | null,
): PromptPackSourceDriveItemSnapshot | null {
  if (!item) {
    return null;
  }

  return {
    id: item.id,
    name: item.name,
    drive_path: item.drive_path,
    drive_url: item.drive_url,
    mime_type: item.mime_type,
  };
}

function buildProductSnapshot(product: ProductRecord) {
  return {
    id: product.id,
    product_code: product.product_code,
    product_name: product.product_name,
    niche: product.niche,
    marketplace: product.marketplace,
    marketplace_product_link: product.marketplace_product_link,
    status: product.status,
    workspace_id: product.workspace_id,
    notes: product.notes,
  } satisfies JsonObject;
}

function buildWorkspaceSnapshot(
  workspace: {
    id: string;
    workspace_code: string;
    workspace_name: string;
    niche: string | null;
    drive_root_folder_ref_id: string | null;
    drive_root_folder_url: string | null;
    drive_root_folder_path: string | null;
    status: string;
    is_default: boolean;
  } | null,
) {
  if (!workspace) {
    return null;
  }

  return {
    id: workspace.id,
    workspace_code: workspace.workspace_code,
    workspace_name: workspace.workspace_name,
    niche: workspace.niche,
    drive_root_folder_ref_id: workspace.drive_root_folder_ref_id,
    drive_root_folder_url: workspace.drive_root_folder_url,
    drive_root_folder_path: workspace.drive_root_folder_path,
    status: workspace.status,
    is_default: workspace.is_default,
  } satisfies JsonObject;
}

function buildIntakeSessionSnapshot(session: MockPromptContext["intakeSession"]) {
  if (!session) {
    return null;
  }

  return {
    id: session.id,
    intake_code: session.intake_code,
    status: session.status,
    product_title: session.product_title,
    shopee_url: session.shopee_url,
    tiktok_url: session.tiktok_url,
    raw_notes: session.raw_notes,
    workspace_id: session.workspace_id,
    parsed_metadata_json: session.parsed_metadata_json,
    reviewed_metadata_json: session.reviewed_metadata_json,
  } satisfies JsonObject;
}

function buildAffiliateProfileSnapshot(profile: AffiliateProfileRecord | null) {
  if (!profile) {
    return null;
  }

  return {
    id: profile.id,
    profile_code: profile.profile_code,
    profile_name: profile.profile_name,
    platform: profile.platform,
    workspace_id: profile.workspace_id,
    account_label: profile.account_label,
    niche: profile.niche,
    affiliate_url: profile.affiliate_url,
    notes: profile.notes,
    rules: buildAffiliateRulePack(profile),
    seed_character: {
      locked: profile.lock_seed_character,
      notes: profile.seed_character_notes,
      drive_item_ref_id: profile.seed_character_drive_item_ref_id,
      analysis_json: profile.seed_character_analysis_json,
    },
    environment: {
      locked: profile.lock_environment,
      notes: profile.environment_notes,
      drive_item_ref_id: profile.environment_drive_item_ref_id,
      analysis_json: profile.environment_analysis_json,
    },
    status: profile.status,
    workspace_ids: profile.workspace_ids,
    default_workspace_id: profile.default_workspace_id,
  } satisfies JsonObject;
}

function buildProductAnchorSnapshot(anchor: ProductAnchorRecord | null) {
  if (!anchor) {
    return null;
  }

  return {
    id: anchor.id,
    product_id: anchor.product_id,
    intake_session_id: anchor.intake_session_id,
    source_product_image_id: anchor.source_product_image_id,
    anchor_code: anchor.anchor_code,
    version: anchor.version,
    anchor_json: anchor.anchor_json,
    vision_analysis_json: anchor.vision_analysis_json,
    marketplace_summary_json: anchor.marketplace_summary_json,
    status: anchor.status,
    notes: anchor.notes,
  } satisfies JsonObject;
}

function buildMarketplaceSourceSnapshot(source: MarketplaceSourceRecord) {
  return {
    id: source.id,
    workspace_id: source.workspace_id,
    product_id: source.product_id,
    platform: source.platform,
    product_url: source.product_url,
    affiliate_url: source.affiliate_url,
    title: source.title,
    category: source.category,
    rating_text: source.rating_text,
    sold_count_text: source.sold_count_text,
    price_text: source.price_text,
    shop_name: source.shop_name,
    screenshot_drive_item_ref_id: source.screenshot_drive_item_ref_id,
    parsed_metadata_json: source.parsed_metadata_json,
    status: source.status,
    notes: source.notes,
  } satisfies JsonObject;
}

function buildSourceImageSnapshot(image: ProductImageRecord | null, driveItem: DriveItemRecord | null) {
  if (!image) {
    return null;
  }

  return {
    id: image.id,
    product_id: image.product_id,
    drive_item_ref_id: image.drive_item_ref_id,
    source_type: image.source_type,
    is_primary: image.is_primary,
    analysis_json: image.analysis_json,
    status: image.status,
    notes: image.notes,
    drive_item: buildDriveItemSnapshot(driveItem),
  } satisfies JsonObject;
}

function buildPromptSourceImageSnapshot(
  image: ProductImageRecord | null,
  driveItem: PromptPackSourceDriveItemSnapshot | null,
): PromptPackSourceImageSnapshot | null {
  if (!image) {
    return null;
  }

  return {
    id: image.id,
    is_primary: image.is_primary,
    status: image.status,
    source_type: image.source_type,
    drive_item_ref_id: image.drive_item_ref_id,
    analysis_json: image.analysis_json,
    drive_item: buildDriveItemSnapshot(driveItem),
  };
}

function buildPromptContextSnapshot(context: {
  currentWorkspace: MockPromptContext["currentWorkspace"];
  product: ProductRecord;
  intakeSession: MockPromptContext["intakeSession"];
  affiliateProfile: AffiliateProfileRecord | null;
  latestAnchor: ProductAnchorRecord | null;
  marketplaceSources: MarketplaceSourceRecord[];
  sourceProductImage: ProductImageRecord | null;
  sourceDriveItem: DriveItemRecord | null;
}) {
  const visualParsingMode = "CACHED_JSON_METADATA";

  return {
    workspace: buildWorkspaceSnapshot(context.currentWorkspace),
    product: buildProductSnapshot(context.product),
    intake_session: buildIntakeSessionSnapshot(context.intakeSession),
    reviewed_gemini_metadata: context.intakeSession?.reviewed_metadata_json ?? null,
    affiliate_profile: buildAffiliateProfileSnapshot(context.affiliateProfile),
    latest_anchor: buildProductAnchorSnapshot(context.latestAnchor),
    marketplace_sources: context.marketplaceSources.map(buildMarketplaceSourceSnapshot),
    source_image: buildSourceImageSnapshot(context.sourceProductImage, context.sourceDriveItem),
    visual_parsing_mode: visualParsingMode,
    image_bytes_available: false,
    source_fallback_reason: "Use cached JSON metadata and Drive references; do not claim live visual parsing from links.",
  } satisfies JsonObject;
}

async function loadPromptPackGenerationContext(promptPackId: string) {
  const { supabase, user, promptPack } = await requireOwnedPromptPack(promptPackId);
  const serviceClient = createSupabaseServiceRoleClient();
  let promptPackRecord = promptPack as PromptPackRecord;

  const { data: product, error: productError } = await supabase
    .from("products")
    .select(
      "id, user_id, workspace_id, product_code, product_name, niche, marketplace, marketplace_product_link, status, notes, created_at, updated_at",
    )
    .eq("id", promptPack.product_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (productError) {
    throw new Error(productError.message);
  }

  if (!product) {
    throw new Error("Product not found.");
  }

  const currentWorkspace = product.workspace_id
    ? (await getWorkspaceById(product.workspace_id)) ?? (await getCurrentWorkspace())
    : await getCurrentWorkspace();
  let resolvedWorkspace = currentWorkspace ?? null;
  let resolvedWorkspaceId = resolvedWorkspace?.id ?? product.workspace_id ?? null;

  const sourceProductImage = promptPack.source_product_image_id
    ? (
        await supabase
          .from("product_images")
          .select("id, user_id, product_id, drive_item_ref_id, source_type, is_primary, analysis_json, status, notes, created_at, updated_at")
          .eq("id", promptPack.source_product_image_id)
          .eq("user_id", user.id)
          .eq("product_id", promptPack.product_id)
          .maybeSingle()
      ).data ?? null
    : await getPrimaryProductImageForPromptPack(promptPack.product_id);

  if (promptPack.source_product_image_id && !sourceProductImage) {
    throw new Error("Source product image not found.");
  }

  if (!sourceProductImage) {
    throw new Error("Source product image is required before prompt generation.");
  }

  const sourceDriveItem = sourceProductImage
    ? (
        await supabase
          .from("drive_items")
          .select("id, user_id, item_type, drive_item_id, parent_id, parent_drive_item_id, name, drive_url, drive_path, mime_type, size_bytes, purpose, status, notes, created_at, updated_at")
          .eq("id", sourceProductImage.drive_item_ref_id)
          .eq("user_id", user.id)
          .maybeSingle()
      ).data ?? null
    : null;

  if (!sourceDriveItem) {
    throw new Error("Source product image Drive reference is required before prompt generation.");
  }

  const intakeSession =
    promptPack.intake_session_id ? await getIntakeSessionById(promptPack.intake_session_id) : await getLatestIntakeSessionForProduct(promptPack.product_id, resolvedWorkspaceId);

  if (intakeSession && resolvedWorkspaceId && intakeSession.workspace_id && intakeSession.workspace_id !== resolvedWorkspaceId) {
    throw new Error("Intake session does not belong to the selected workspace.");
  }

  if (!intakeSession?.reviewed_metadata_json) {
    throw new Error("Review Gemini metadata before generating a prompt pack.");
  }

  if (!resolvedWorkspaceId && intakeSession?.workspace_id) {
    resolvedWorkspaceId = intakeSession.workspace_id;
    resolvedWorkspace = resolvedWorkspaceId ? await getWorkspaceById(resolvedWorkspaceId) : null;
  }

  const affiliateProfile = await (promptPack.affiliate_profile_id
    ? getAffiliateProfileById(promptPack.affiliate_profile_id)
    : getDefaultAffiliateProfileForWorkspace(resolvedWorkspaceId));

  if (affiliateProfile && resolvedWorkspaceId && !affiliateProfile.workspace_ids.includes(resolvedWorkspaceId)) {
    throw new Error("Affiliate profile must be linked to the selected workspace.");
  }

  if (!resolvedWorkspaceId && affiliateProfile?.default_workspace_id) {
    resolvedWorkspaceId = affiliateProfile.default_workspace_id;
    resolvedWorkspace = resolvedWorkspaceId ? await getWorkspaceById(resolvedWorkspaceId) : null;
  }

  if (!resolvedWorkspaceId || !resolvedWorkspace) {
    throw new Error("Affiliate Profile namespace is required before prompt generation.");
  }

  assertAffiliateProfileReadyForPromptGeneration(affiliateProfile);

  const latestAnchor = await getLatestProductAnchor({
    productId: promptPack.product_id,
    workspaceId: resolvedWorkspaceId,
    intakeSessionId: intakeSession?.id ?? null,
  });

  const marketplaceSourceContext = await getLatestMarketplaceSourceContext({
    productId: promptPack.product_id,
    workspaceId: resolvedWorkspaceId,
    limit: 25,
  });

  const promptContext = buildPromptContextSnapshot({
    currentWorkspace: resolvedWorkspace,
    product: product as ProductRecord,
    intakeSession: intakeSession
      ? {
          id: intakeSession.id,
          intake_code: intakeSession.intake_code,
          status: intakeSession.status,
          product_title: intakeSession.product_title,
          shopee_url: intakeSession.shopee_url,
          tiktok_url: intakeSession.tiktok_url,
          raw_notes: intakeSession.raw_notes,
          parsed_metadata_json: intakeSession.parsed_metadata_json,
          reviewed_metadata_json: intakeSession.reviewed_metadata_json,
          workspace_id: intakeSession.workspace_id,
        }
      : null,
    affiliateProfile,
    latestAnchor,
    marketplaceSources: marketplaceSourceContext.sources,
    sourceProductImage: sourceProductImage as ProductImageRecord | null,
    sourceDriveItem: sourceDriveItem as DriveItemRecord | null,
  });

  const promptPackReferenceUpdates: Partial<Pick<PromptPackRecord, "intake_session_id" | "affiliate_profile_id">> = {};

  if (!promptPackRecord.intake_session_id && intakeSession?.id) {
    promptPackReferenceUpdates.intake_session_id = intakeSession.id;
  }

  if (!promptPackRecord.affiliate_profile_id && affiliateProfile?.id) {
    promptPackReferenceUpdates.affiliate_profile_id = affiliateProfile.id;
  }

  if (Object.keys(promptPackReferenceUpdates).length > 0) {
    const { data: updatedPromptPack, error: updateError } = await supabase
      .from("prompt_packs")
      .update(promptPackReferenceUpdates)
      .eq("id", promptPack.id)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    promptPackRecord = updatedPromptPack as PromptPackRecord;
  }

  return {
    supabase,
    serviceClient,
    user,
    promptPack: promptPackRecord,
    product: product as ProductRecord,
    currentWorkspace: resolvedWorkspace,
    intakeSession: intakeSession
      ? {
          id: intakeSession.id,
          intake_code: intakeSession.intake_code,
          status: intakeSession.status,
          product_title: intakeSession.product_title,
          shopee_url: intakeSession.shopee_url,
          tiktok_url: intakeSession.tiktok_url,
          raw_notes: intakeSession.raw_notes,
          parsed_metadata_json: intakeSession.parsed_metadata_json,
          reviewed_metadata_json: intakeSession.reviewed_metadata_json,
          workspace_id: intakeSession.workspace_id,
        }
      : null,
    affiliateProfile,
    latestAnchor,
    marketplaceSources: marketplaceSourceContext.sources,
    sourceProductImage: sourceProductImage as ProductImageRecord | null,
    sourceDriveItem: sourceDriveItem as DriveItemRecord | null,
    promptContext,
  };
}

function buildPromptPackAnalysis(context: MockPromptContext): PromptPackGenerationOutput["product_analysis"] {
  const { promptPack, product, sourceProductImage, sourceDriveItem } = context;

  return {
    mode: "mock",
    prompt_code: promptPack.prompt_code,
    version: promptPack.version,
    product: {
      id: product.id,
      product_code: product.product_code,
      product_name: product.product_name,
      niche: product.niche,
      marketplace: product.marketplace,
      marketplace_product_link: product.marketplace_product_link,
      status: product.status,
    },
    source_image: sourceProductImage
      ? {
          id: sourceProductImage.id,
          is_primary: sourceProductImage.is_primary,
          status: sourceProductImage.status,
          source_type: sourceProductImage.source_type,
          drive_item_ref_id: sourceProductImage.drive_item_ref_id,
          analysis_json: sourceProductImage.analysis_json,
          drive_item: sourceDriveItem,
        }
      : null,
    coverage: {
      vision_analysis: 1,
      prompt_clips: PROMPT_CLIP_KEYS.length,
    },
    vision_analysis: {
      summary: `Mock vision analysis for ${product.product_name} (${promptPack.prompt_code} v${promptPack.version}).`,
      hero_direction: "Highlight the core product and keep the composition production-safe for later prompt tuning.",
      scene_constraints: [
        "Keep the product centered in the frame.",
        "Preserve the dominant brand colors.",
        "Avoid introducing extra objects that do not exist in the source image.",
      ],
      risks: sourceProductImage
        ? [
            "Text-only fallback used; image bytes are unavailable in this sprint.",
            "Mock output only. Replace with Gemini vision analysis after live runner work lands.",
          ]
        : [
            "No source product image is attached yet.",
            "Text-only fallback used; image bytes are unavailable in this sprint.",
            "Mock output only. Replace with Gemini vision analysis after live runner work lands.",
          ],
    },
  };
}

function splitRuleText(value: string | null | undefined) {
  const trimmed = readText(value);

  if (!trimmed) {
    return [];
  }

  return trimmed
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function assertAffiliateProfileReadyForPromptGeneration(profile: AffiliateProfileRecord | null) {
  if (!profile) {
    throw new Error("Affiliate Profile is required before prompt generation.");
  }

  if (profile.status !== "ACTIVE") {
    throw new Error("Affiliate Profile must be active before prompt generation.");
  }

  const missingRuleLabels = [
    ["i2i prompt rules", profile.i2i_prompt_rules],
    ["i2v prompt rules", profile.i2v_prompt_rules],
    ["caption rules", profile.caption_rules],
    ["hashtag rules", profile.hashtag_rules],
    ["negative prompt rules", profile.negative_prompt_rules],
    ["product positioning notes", profile.product_positioning_notes],
  ]
    .filter(([, value]) => splitRuleText(value).length === 0)
    .map(([label]) => label);

  if (missingRuleLabels.length) {
    throw new Error(`Affiliate Profile prompt rules are incomplete: ${missingRuleLabels.join(", ")}.`);
  }

  if (profile.lock_seed_character && !profile.seed_character_drive_item_ref_id) {
    throw new Error("Character lock is enabled but no Character Drive reference is configured.");
  }

  if (
    profile.lock_seed_character &&
    !isAffiliateProfileAssetAnalysisReady({
      locked: true,
      driveItemRefId: profile.seed_character_drive_item_ref_id,
      analysisJson: profile.seed_character_analysis_json,
    })
  ) {
    throw new Error("Character lock is enabled but Character analysis JSON is missing or stale.");
  }

  if (profile.lock_environment && !profile.environment_drive_item_ref_id) {
    throw new Error("Environment lock is enabled but no Environment Drive reference is configured.");
  }

  if (
    profile.lock_environment &&
    !isAffiliateProfileAssetAnalysisReady({
      locked: true,
      driveItemRefId: profile.environment_drive_item_ref_id,
      analysisJson: profile.environment_analysis_json,
    })
  ) {
    throw new Error("Environment lock is enabled but Environment analysis JSON is missing or stale.");
  }
}

function buildI2IPrompts(context: MockPromptContext): PromptPackGenerationOutput["i2i_prompts"] {
  const { promptPack, product, sourceProductImage, sourceDriveItem, affiliateProfile, latestAnchor } = context;

  const sourceLabel = sourceProductImage
    ? `source image row ${sourceProductImage.id}`
    : "an attached source image row";
  const anchorLabel = latestAnchor ? `anchor ${latestAnchor.anchor_code} v${latestAnchor.version}` : "the latest available anchor";
  const profileLabel = affiliateProfile ? `affiliate profile ${affiliateProfile.profile_code}` : "no affiliate profile";
  const promptRules = buildAffiliateRulePack(affiliateProfile);
  const visualReferences = [
    {
      kind: "CHARACTER",
      label: "Character",
      drive_item_ref_id: affiliateProfile?.seed_character_drive_item_ref_id ?? "",
      drive_url: "",
      drive_path: "",
      analysis_json: affiliateProfile?.seed_character_analysis_json ?? null,
    },
    {
      kind: "ENVIRONMENT",
      label: "Environment",
      drive_item_ref_id: affiliateProfile?.environment_drive_item_ref_id ?? "",
      drive_url: "",
      drive_path: "",
      analysis_json: affiliateProfile?.environment_analysis_json ?? null,
    },
    {
      kind: "PRODUCT",
      label: "Product",
      drive_item_ref_id: sourceProductImage?.drive_item_ref_id ?? "",
      drive_url: sourceDriveItem?.drive_url ?? "",
      drive_path: sourceDriveItem?.drive_path ?? "",
      analysis_json: sourceProductImage?.analysis_json ?? null,
    },
  ] satisfies PromptPackVisualReferenceJson[];

  return {
    clip_1: {
      slot: "clip_1",
      first_frame: {
        slot: "clip_1",
        frame: "first_frame",
        prompt_text: `Mock I2I First Frame Clip 1 untuk ${product.product_name} (${promptPack.prompt_code} v${promptPack.version}). Gunakan ${sourceLabel}, ${anchorLabel}, dan ${profileLabel}.`,
        visual_references: visualReferences,
        prompt_rules: {
          i2i_prompt_rules: Array.isArray(promptRules?.i2i_prompt_rules)
            ? promptRules.i2i_prompt_rules.filter((item): item is string => typeof item === "string")
            : [],
          i2v_prompt_rules: Array.isArray(promptRules?.i2v_prompt_rules)
            ? promptRules.i2v_prompt_rules.filter((item): item is string => typeof item === "string")
            : [],
          caption_rules: Array.isArray(promptRules?.caption_rules)
            ? promptRules.caption_rules.filter((item): item is string => typeof item === "string")
            : [],
          hashtag_rules: Array.isArray(promptRules?.hashtag_rules)
            ? promptRules.hashtag_rules.filter((item): item is string => typeof item === "string")
            : [],
          negative_prompt_rules: Array.isArray(promptRules?.negative_prompt_rules)
            ? promptRules.negative_prompt_rules.filter((item): item is string => typeof item === "string")
            : [],
          product_positioning_notes: Array.isArray(promptRules?.product_positioning_notes)
            ? promptRules.product_positioning_notes.filter((item): item is string => typeof item === "string")
            : [],
        },
      },
      last_frame: {
        slot: "clip_1",
        frame: "last_frame",
        prompt_text: `Mock I2I Last Frame Clip 1 untuk ${product.product_name}. Jaga siluet produk, anchor, dan persona affiliate tetap sama.`,
        visual_references: visualReferences,
        prompt_rules: {
          i2i_prompt_rules: Array.isArray(promptRules?.i2i_prompt_rules)
            ? promptRules.i2i_prompt_rules.filter((item): item is string => typeof item === "string")
            : [],
          i2v_prompt_rules: Array.isArray(promptRules?.i2v_prompt_rules)
            ? promptRules.i2v_prompt_rules.filter((item): item is string => typeof item === "string")
            : [],
          caption_rules: Array.isArray(promptRules?.caption_rules)
            ? promptRules.caption_rules.filter((item): item is string => typeof item === "string")
            : [],
          hashtag_rules: Array.isArray(promptRules?.hashtag_rules)
            ? promptRules.hashtag_rules.filter((item): item is string => typeof item === "string")
            : [],
          negative_prompt_rules: Array.isArray(promptRules?.negative_prompt_rules)
            ? promptRules.negative_prompt_rules.filter((item): item is string => typeof item === "string")
            : [],
          product_positioning_notes: Array.isArray(promptRules?.product_positioning_notes)
            ? promptRules.product_positioning_notes.filter((item): item is string => typeof item === "string")
            : [],
        },
      },
    },
    clip_2: {
      slot: "clip_2",
      first_frame: {
        slot: "clip_2",
        frame: "first_frame",
        prompt_text: `Mock I2I First Frame Clip 2 untuk ${product.product_name}. Produk tetap terbaca, anchor tetap dipakai, dan ${profileLabel} tetap konsisten.`,
        visual_references: visualReferences,
        prompt_rules: {
          i2i_prompt_rules: Array.isArray(promptRules?.i2i_prompt_rules)
            ? promptRules.i2i_prompt_rules.filter((item): item is string => typeof item === "string")
            : [],
          i2v_prompt_rules: Array.isArray(promptRules?.i2v_prompt_rules)
            ? promptRules.i2v_prompt_rules.filter((item): item is string => typeof item === "string")
            : [],
          caption_rules: Array.isArray(promptRules?.caption_rules)
            ? promptRules.caption_rules.filter((item): item is string => typeof item === "string")
            : [],
          hashtag_rules: Array.isArray(promptRules?.hashtag_rules)
            ? promptRules.hashtag_rules.filter((item): item is string => typeof item === "string")
            : [],
          negative_prompt_rules: Array.isArray(promptRules?.negative_prompt_rules)
            ? promptRules.negative_prompt_rules.filter((item): item is string => typeof item === "string")
            : [],
          product_positioning_notes: Array.isArray(promptRules?.product_positioning_notes)
            ? promptRules.product_positioning_notes.filter((item): item is string => typeof item === "string")
            : [],
        },
      },
      last_frame: {
        slot: "clip_2",
        frame: "last_frame",
        prompt_text: `Mock I2I Last Frame Clip 2 untuk ${product.product_name}. Akhiri dengan komposisi bersih dan kesinambungan dengan ${anchorLabel}.`,
        visual_references: visualReferences,
        prompt_rules: {
          i2i_prompt_rules: Array.isArray(promptRules?.i2i_prompt_rules)
            ? promptRules.i2i_prompt_rules.filter((item): item is string => typeof item === "string")
            : [],
          i2v_prompt_rules: Array.isArray(promptRules?.i2v_prompt_rules)
            ? promptRules.i2v_prompt_rules.filter((item): item is string => typeof item === "string")
            : [],
          caption_rules: Array.isArray(promptRules?.caption_rules)
            ? promptRules.caption_rules.filter((item): item is string => typeof item === "string")
            : [],
          hashtag_rules: Array.isArray(promptRules?.hashtag_rules)
            ? promptRules.hashtag_rules.filter((item): item is string => typeof item === "string")
            : [],
          negative_prompt_rules: Array.isArray(promptRules?.negative_prompt_rules)
            ? promptRules.negative_prompt_rules.filter((item): item is string => typeof item === "string")
            : [],
          product_positioning_notes: Array.isArray(promptRules?.product_positioning_notes)
            ? promptRules.product_positioning_notes.filter((item): item is string => typeof item === "string")
            : [],
        },
      },
    },
  } as PromptPackGenerationOutput["i2i_prompts"];
}

function buildI2VPrompts(context: MockPromptContext): PromptPackGenerationOutput["i2v_prompts"] {
  const { promptPack, product, sourceProductImage, sourceDriveItem, affiliateProfile, latestAnchor } = context;
  const sourceLabel = sourceProductImage ? `source image row ${sourceProductImage.id}` : "the product reference";
  const anchorLabel = latestAnchor ? `anchor ${latestAnchor.anchor_code}` : "the latest anchor";
  const profileLabel = affiliateProfile ? `affiliate profile ${affiliateProfile.profile_code}` : "default workspace personalization";
  const promptRules = buildAffiliateRulePack(affiliateProfile);
  const visualReferences = [
    {
      kind: "CHARACTER",
      label: "Character",
      drive_item_ref_id: affiliateProfile?.seed_character_drive_item_ref_id ?? "",
      drive_url: "",
      drive_path: "",
      analysis_json: affiliateProfile?.seed_character_analysis_json ?? null,
    },
    {
      kind: "ENVIRONMENT",
      label: "Environment",
      drive_item_ref_id: affiliateProfile?.environment_drive_item_ref_id ?? "",
      drive_url: "",
      drive_path: "",
      analysis_json: affiliateProfile?.environment_analysis_json ?? null,
    },
    {
      kind: "PRODUCT",
      label: "Product",
      drive_item_ref_id: sourceProductImage?.drive_item_ref_id ?? "",
      drive_url: sourceDriveItem?.drive_url ?? "",
      drive_path: sourceDriveItem?.drive_path ?? "",
      analysis_json: sourceProductImage?.analysis_json ?? null,
    },
  ] satisfies PromptPackVisualReferenceJson[];
  const promptRulesJson = {
    i2i_prompt_rules: Array.isArray(promptRules?.i2i_prompt_rules)
      ? promptRules.i2i_prompt_rules.filter((item): item is string => typeof item === "string")
      : [],
    i2v_prompt_rules: Array.isArray(promptRules?.i2v_prompt_rules)
      ? promptRules.i2v_prompt_rules.filter((item): item is string => typeof item === "string")
      : [],
    caption_rules: Array.isArray(promptRules?.caption_rules)
      ? promptRules.caption_rules.filter((item): item is string => typeof item === "string")
      : [],
    hashtag_rules: Array.isArray(promptRules?.hashtag_rules)
      ? promptRules.hashtag_rules.filter((item): item is string => typeof item === "string")
      : [],
    negative_prompt_rules: Array.isArray(promptRules?.negative_prompt_rules)
      ? promptRules.negative_prompt_rules.filter((item): item is string => typeof item === "string")
      : [],
    product_positioning_notes: Array.isArray(promptRules?.product_positioning_notes)
      ? promptRules.product_positioning_notes.filter((item): item is string => typeof item === "string")
      : [],
  } satisfies PromptPackPromptRulesJson;

  return {
    clip_1: {
      slot: "clip_1",
      prompt_text: `Mock I2V Prompt Clip 1 untuk ${product.product_name} (${promptPack.prompt_code} v${promptPack.version}). Gunakan ${sourceLabel}, ${anchorLabel}, dan ${profileLabel}.`,
      visual_references: visualReferences,
      prompt_rules: promptRulesJson,
      continuity: {
        first_frame_hint: "Start with a stable product-first opening.",
        last_frame_hint: "End with continuity toward the product reveal.",
      },
    },
    clip_2: {
      slot: "clip_2",
      prompt_text: `Mock I2V Prompt Clip 2 untuk ${product.product_name}. Lanjutkan identitas produk, kontinuitas anchor, dan aturan personalisasi yang sama.`,
      visual_references: visualReferences,
      prompt_rules: promptRulesJson,
      continuity: {
        first_frame_hint: "Continue from the previous frame with the same character and environment references.",
        last_frame_hint: "Resolve with the same product identity and affiliate style constraints.",
      },
    },
  } as PromptPackGenerationOutput["i2v_prompts"];
}

function readJsonString(record: JsonObject | null | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function reviewedMetadata(context: MockPromptContext) {
  return (context.intakeSession?.reviewed_metadata_json ?? null) as JsonObject | null;
}

function buildCaption(context: MockPromptContext) {
  const metadata = reviewedMetadata(context);
  const captionParts = [
    readJsonString(metadata, "nama_produk") || context.product.product_name,
    readJsonString(metadata, "selling_angle"),
    readJsonString(metadata, "use_case"),
  ].filter(Boolean);

  return captionParts.join(" - ");
}

function buildTags(context: MockPromptContext) {
  const metadata = reviewedMetadata(context);
  const profileTags = splitRuleText(context.affiliateProfile?.hashtag_rules).join(" ");
  const baseTags = [
    readJsonString(metadata, "keyword_cari_etalase"),
    context.product.niche,
    context.affiliateProfile?.niche,
    profileTags,
  ].filter(Boolean);

  return baseTags.join(" ");
}

function readJsonRecord(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readRegenerationInstruction(promptPack: PromptPackRecord) {
  const personalization = readJsonRecord(promptPack.personalization_json);
  const regeneration = readJsonRecord(personalization.regeneration_request);
  const instruction = regeneration.revision_instruction;

  return typeof instruction === "string" ? instruction.trim() : "";
}

function buildNegativePromptRules(context: MockPromptContext) {
  if (!context.affiliateProfile) {
    return [] as string[];
  }

  return splitRuleText(context.affiliateProfile.negative_prompt_rules);
}

function buildSeedCharacterState(context: MockPromptContext): PromptPackGenerationOutput["seed_character"] {
  if (!context.affiliateProfile?.lock_seed_character) {
    return {
      locked: false,
      notes: "No locked seed character configured.",
      drive_item_ref_id: null,
    };
  }

  return {
    locked: true,
    notes:
      readText(context.affiliateProfile.seed_character_notes) ||
      `Use the locked seed character for ${context.affiliateProfile.profile_code}.`,
    drive_item_ref_id: context.affiliateProfile.seed_character_drive_item_ref_id,
  } as PromptPackGenerationOutput["seed_character"];
}

function buildEnvironmentState(context: MockPromptContext): PromptPackGenerationOutput["environment"] {
  if (!context.affiliateProfile?.lock_environment) {
    return {
      locked: false,
      notes: "No locked environment configured.",
      drive_item_ref_id: null,
    };
  }

  return {
    locked: true,
    notes:
      readText(context.affiliateProfile.environment_notes) ||
      `Use the locked environment for ${context.affiliateProfile.profile_code}.`,
    drive_item_ref_id: context.affiliateProfile.environment_drive_item_ref_id,
  } as PromptPackGenerationOutput["environment"];
}

function buildConsistencyRules(context: MockPromptContext): PromptPackGenerationOutput["consistency_rules"] {
  const { promptPack, product, sourceProductImage, affiliateProfile, latestAnchor, currentWorkspace, marketplaceSources } = context;

  return [
    "Keep product identity and proportions consistent across all clips.",
    "Do not invent props, text, or packaging that are not visible in the source reference.",
    "Keep the palette, light direction, and product silhouette stable.",
    "Preserve the same product-first composition in every slot.",
    sourceProductImage ? "Treat the selected source product image row as the canonical visual anchor." : "Attach a primary source image row before live generation.",
    latestAnchor ? `Use anchor ${latestAnchor.anchor_code} v${latestAnchor.version} as the latest continuity reference.` : "Use the latest relevant product anchor when one exists.",
    affiliateProfile ? `Honor affiliate profile ${affiliateProfile.profile_code} positioning, caption, hashtag, and negative prompt rules.` : "Fallback to empty personalization if no affiliate profile is selected.",
    currentWorkspace ? `Keep this prompt pack within workspace ${currentWorkspace.workspace_code}.` : "No workspace is selected; keep the context unassigned.",
    marketplaceSources.length ? `Incorporate ${marketplaceSources.length} marketplace source record(s) into continuity checks.` : "No marketplace sources are attached yet.",
    `Maintain prompt pack identity ${promptPack.prompt_code} for product ${product.product_name}.`,
  ] as PromptPackGenerationOutput["consistency_rules"];
}

function buildPromptPackTaskInput(context: PromptPackGenerationContext, generationMode: PromptPackGenerationMode) {
  return {
    prompt_pack_id: context.promptPack.id,
    prompt_code: context.promptPack.prompt_code,
    version: context.promptPack.version,
    product_id: context.product.id,
    product_code: context.product.product_code,
    workspace_id: context.currentWorkspace?.id ?? context.product.workspace_id ?? null,
    intake_session_id: context.intakeSession?.id ?? context.promptPack.intake_session_id ?? null,
    affiliate_profile_id: context.affiliateProfile?.id ?? context.promptPack.affiliate_profile_id ?? null,
    source_product_image_id: context.sourceProductImage?.id ?? null,
    source_drive_item_id: context.sourceProductImage?.drive_item_ref_id ?? null,
    latest_anchor_id: context.latestAnchor?.id ?? null,
    marketplace_source_ids: context.marketplaceSources.map((source) => source.id),
    prompt_context: context.promptContext,
    prompt_set: readPromptPackEditorPromptSet(context.promptPack),
    revision_instruction: readRegenerationInstruction(context.promptPack) || null,
    mode: generationMode,
  };
}

function compactText(value: unknown, maxLength = 480) {
  if (typeof value !== "string") {
    return "";
  }

  const compacted = value.replace(/\s+/g, " ").trim();
  return compacted.length > maxLength ? `${compacted.slice(0, Math.max(maxLength - 3, 0)).trimEnd()}...` : compacted;
}

function compactRuleLines(value: string | null | undefined, maxLines = 8, maxLength = 220) {
  return splitRuleText(value)
    .map((line) => compactText(line, maxLength))
    .filter(Boolean)
    .slice(0, maxLines);
}

function buildAffiliateRulePack(profile: AffiliateProfileRecord | null) {
  if (!profile) {
    return null;
  }

  return {
    i2i_prompt_rules: compactRuleLines(profile.i2i_prompt_rules),
    i2v_prompt_rules: compactRuleLines(profile.i2v_prompt_rules),
    caption_rules: compactRuleLines(profile.caption_rules, 6),
    hashtag_rules: compactRuleLines(profile.hashtag_rules, 6, 120),
    negative_prompt_rules: compactRuleLines(profile.negative_prompt_rules, 10),
    product_positioning_notes: compactRuleLines(profile.product_positioning_notes, 6),
  } satisfies JsonObject;
}

function buildReviewedPromptEssentials(context: PromptPackGenerationContext) {
  const metadata = (context.intakeSession?.reviewed_metadata_json ?? {}) as JsonObject;

  return {
    nama_produk: readJsonString(metadata, "nama_produk") || context.product.product_name,
    keyword_cari_etalase: readJsonString(metadata, "keyword_cari_etalase") || context.product.niche || "",
    deskripsi_visual: compactText(readJsonString(metadata, "deskripsi_visual")),
    use_case: compactText(readJsonString(metadata, "use_case")),
    pain_point: compactText(readJsonString(metadata, "pain_point")),
    selling_angle: compactText(readJsonString(metadata, "selling_angle")),
    target_viewer: compactText(readJsonString(metadata, "target_viewer")),
  } satisfies JsonObject;
}

function buildPromptContextForModel(context: PromptPackGenerationContext) {
  const profile = context.affiliateProfile;

  return {
    product: {
      id: context.product.id,
      product_code: context.product.product_code,
      product_name: context.product.product_name,
      niche: context.product.niche,
      marketplace: context.product.marketplace,
      marketplace_product_link: context.product.marketplace_product_link,
      status: context.product.status,
    },
    workspace: context.currentWorkspace
      ? {
          id: context.currentWorkspace.id,
          workspace_code: context.currentWorkspace.workspace_code,
          workspace_name: context.currentWorkspace.workspace_name,
          niche: context.currentWorkspace.niche,
        }
      : null,
    reviewed_prompt_essentials: buildReviewedPromptEssentials(context),
    affiliate_profile: profile
      ? {
          id: profile.id,
          profile_code: profile.profile_code,
          profile_name: profile.profile_name,
          platform: profile.platform,
          account_label: profile.account_label,
          niche: profile.niche,
          affiliate_url: profile.affiliate_url,
          rules: buildAffiliateRulePack(profile),
          seed_character: {
            locked: profile.lock_seed_character,
            notes: compactText(profile.seed_character_notes),
            drive_item_ref_id: profile.seed_character_drive_item_ref_id,
            analysis_json: profile.seed_character_analysis_json,
          },
          environment: {
            locked: profile.lock_environment,
            notes: compactText(profile.environment_notes),
            drive_item_ref_id: profile.environment_drive_item_ref_id,
            analysis_json: profile.environment_analysis_json,
          },
        }
      : null,
    source_image: buildPromptSourceImageSnapshot(context.sourceProductImage, context.sourceDriveItem),
    marketplace_sources: context.marketplaceSources.slice(0, 6).map((source) => ({
      platform: source.platform,
      title: compactText(source.title, 180),
      category: compactText(source.category, 120),
      rating_text: compactText(source.rating_text, 80),
      sold_count_text: compactText(source.sold_count_text, 80),
      price_text: compactText(source.price_text, 80),
      shop_name: compactText(source.shop_name, 120),
    })),
    latest_anchor: context.latestAnchor
      ? {
          anchor_code: context.latestAnchor.anchor_code,
          version: context.latestAnchor.version,
          status: context.latestAnchor.status,
        }
      : null,
    visual_parsing_mode: "CACHED_JSON_METADATA",
    image_bytes_available: false,
    source_fallback_reason: "Prompt generation uses reviewed metadata, cached asset JSON, and Drive references only; do not claim fresh visual parsing from links.",
  } satisfies JsonObject;
}

function buildPromptPackGenerationPrompt(context: PromptPackGenerationContext, selectedGeminiKey: { id: string; label: string; model_name: string; role: string }) {
  const { promptPack } = context;
  const promptSet = readPromptPackEditorPromptSet(promptPack);
  const revisionInstruction = readRegenerationInstruction(promptPack);
  const promptContextForModel = buildPromptContextForModel(context);

  return [
    "You are generating a structured prompt pack for a single-owner affiliate content workflow.",
    "Return JSON only. Do not use markdown, code fences, or commentary.",
    "The JSON object must contain exactly these top-level keys: product_analysis, i2i_prompts, i2v_prompts, caption, tags, negative_prompt_rules, consistency_rules.",
    "Do not emit prompt_context, target_marketplace, seed_character, environment, prompt_rules, or visual_references. The server injects those after validation.",
    "If image_bytes_available is false, use cached JSON metadata only and do not claim live visual parsing from links.",
    "Apply affiliate rules explicitly; they are validated as mandatory before generation:",
    "- i2i_prompt_rules must shape every i2i_prompts.clip_n.first_frame.prompt_text and i2i_prompts.clip_n.last_frame.prompt_text.",
    "- i2v_prompt_rules must shape every i2v_prompts.clip_n.prompt_text.",
    "- caption_rules must shape caption.",
    "- hashtag_rules must shape tags.",
    "- negative_prompt_rules must populate negative_prompt_rules.",
    "- product_positioning_notes must shape product_analysis.vision_analysis.hero_direction and the selling angle.",
    "Required slots:",
    "- i2i_prompts: clip_1 and clip_2",
    "- i2v_prompts: clip_1 and clip_2",
    "Each i2i clip object must include slot, first_frame, and last_frame, and each frame must include slot, frame, and prompt_text.",
    "Each i2v clip object must include slot, prompt_text, and continuity.",
    "product_analysis must include mode, prompt_code, version, product, source_image, coverage, and vision_analysis.",
    "product_analysis.product must echo the source product fields from prompt_context_for_model.product and must copy product.status exactly from the source product record.",
    "product_analysis.source_image must echo the source image fields from prompt_context_for_model.source_image when a source image exists and must copy source_image.status, source_image.source_type, source_image.drive_item_ref_id, and source_image.analysis_json exactly.",
    "caption must be a shared caption string.",
    "tags must be one compact hashtag string.",
    "negative_prompt_rules and consistency_rules must each be arrays of strings.",
    "Keep output concise. Avoid repeating long context or Drive URLs.",
    "",
    "Context:",
    JSON.stringify(
      {
        prompt_pack: {
          id: promptPack.id,
          prompt_code: promptPack.prompt_code,
          version: promptPack.version,
          status: promptPack.status,
        },
        prompt_context_for_model: promptContextForModel,
        existing_prompt_set: promptSet,
        revision_instruction: revisionInstruction || null,
        generation_policy: {
          model_name: selectedGeminiKey.model_name,
          key_label: selectedGeminiKey.label,
          key_role: selectedGeminiKey.role,
        },
      },
      null,
      2,
    ),
  ].join("\n");
}

export async function getPrimaryProductImageForPromptPack(productId: string) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("product_images")
    .select("id, user_id, product_id, drive_item_ref_id, source_type, is_primary, analysis_json, status, notes, created_at, updated_at")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .eq("is_primary", true)
    .in("status", ["ATTACHED", "ANALYZED"])
    .order("created_at", { ascending: true })
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as ProductImageRecord | null;
}

function sanitizeGeminiFailureMessage(error: unknown) {
  if (error instanceof GeminiClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Prompt pack generation failed.";
}

async function updatePromptPackGenerationResult(
  context: PromptPackGenerationContext,
  taskId: string,
  outputJson: PromptPackGenerationOutput,
) {
  const storagePayload = buildPromptPackStoragePayload(outputJson, context.promptContext);
  storagePayload.personalization_json = {
    ...storagePayload.personalization_json,
    prompt_context: context.promptContext,
  };
  const { data, error } = await context.supabase
    .from("prompt_packs")
    .update({
      ai_task_id: taskId,
      status: "GENERATED",
      error_message: null,
      ...storagePayload,
    })
    .eq("id", context.promptPack.id)
    .eq("user_id", context.user.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/prompts");
  revalidatePath(`/products/${context.product.id}`);
  return data as PromptPackRecord;
}

async function updatePromptPackGenerationFailure(context: PromptPackGenerationContext, taskId: string, message: string) {
  const { error } = await context.supabase
    .from("prompt_packs")
    .update({
      ai_task_id: taskId,
      status: "ERROR",
      error_message: message,
    })
    .eq("id", context.promptPack.id)
    .eq("user_id", context.user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/prompts");
  revalidatePath(`/products/${context.product.id}`);
}

export async function createPromptPackGenerationTask(
  promptPackId: string,
  options?: { maxRetries?: number; generationMode?: PromptPackGenerationMode },
) {
  const context = await loadPromptPackGenerationContext(promptPackId);
  const generationMode = options?.generationMode ?? "gemini";
  const maxRetries = options?.maxRetries ?? 3;

  const taskInput = buildPromptPackTaskInput(
    context,
    generationMode,
  );

  const task = (await createAITask({
    taskType: "PROMPT_PACK_GENERATION",
    inputJson: taskInput,
    maxRetries,
  })) as AiTaskRecord;

  const { data, error } = await context.supabase
    .from("prompt_packs")
    .update({
      ai_task_id: task.id,
      status: "QUEUED",
      error_message: null,
    })
    .eq("id", promptPackId)
    .eq("user_id", context.user.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/prompts");
  revalidatePath(`/products/${context.product.id}`);
  return {
    promptPack: data as PromptPackRecord,
    task,
    taskInput,
    context,
  };
}

export async function completePromptPackFromMockTask(promptPackId: string, taskId: string) {
  const context = await loadPromptPackGenerationContext(promptPackId);
  const mockContext: MockPromptContext = {
    promptPack: context.promptPack,
    product: context.product,
    currentWorkspace: context.currentWorkspace,
    intakeSession: context.intakeSession,
    affiliateProfile: context.affiliateProfile,
    latestAnchor: context.latestAnchor,
    marketplaceSources: context.marketplaceSources,
    sourceProductImage: context.sourceProductImage,
    sourceDriveItem: context.sourceDriveItem,
  };

  const outputJson = {
    product_analysis: buildPromptPackAnalysis(mockContext),
    prompt_context: context.promptContext,
    i2i_prompts: buildI2IPrompts(mockContext),
    i2v_prompts: buildI2VPrompts(mockContext),
    caption: buildCaption(mockContext),
    tags: buildTags(mockContext),
    target_marketplace: PROMPT_TARGET_MARKETPLACE,
    negative_prompt_rules: buildNegativePromptRules(mockContext),
    consistency_rules: buildConsistencyRules(mockContext),
    seed_character: buildSeedCharacterState(mockContext),
    environment: buildEnvironmentState(mockContext),
  } as PromptPackGenerationOutput;

  const promptPack = await updatePromptPackGenerationResult(context, taskId, outputJson);

  return {
    promptPack,
    outputJson,
  };
}

export async function runMockPromptPackTask(promptPackId: string, taskId: string) {
  await markTaskRunning(taskId);

  try {
    const completed = await completePromptPackFromMockTask(promptPackId, taskId);
    const task = await markTaskSuccess(taskId, completed.outputJson);

    return {
      task,
      promptPack: completed.promptPack,
      message: "Mock prompt pack output generated.",
    };
  } catch (error) {
    const message = sanitizeGeminiFailureMessage(error);
    try {
      await markTaskFailed(taskId, message, { retryable: false });
    } catch {
      // Preserve the original error if task failure update also fails.
    }

    try {
      const context = await loadPromptPackGenerationContext(promptPackId);
      await updatePromptPackGenerationFailure(context, taskId, message);
    } catch {
      // Preserve the original error if prompt pack failure update also fails.
    }

    throw new Error(message);
  }
}

type GeminiSelectedKey = GeminiRoutableKey;

function buildGeminiKeySelectionLabel(key: GeminiSelectedKey) {
  return `${key.label} (${key.model_name})`;
}

async function selectPromptPackGeminiKey(
  context: PromptPackGenerationContext,
  excludedQuotaGroups: ReadonlySet<string>,
) {
  const keys = await listQuotaAwareGeminiKeys({
    userId: context.user.id,
    purpose: "PROMPT_PACK_GENERATION",
    excludedQuotaGroups,
    serviceClient: context.serviceClient,
  });
  let sawSecretDecryptionFailure = false;

  for (const geminiKey of keys) {
    const secretResult = await readGeminiSecretForKey(context.serviceClient, context.user.id, geminiKey.id);
    sawSecretDecryptionFailure ||= secretResult.decryptFailed;

    if (!secretResult.secret) {
      continue;
    }

    return {
      key: geminiKey,
      secret: secretResult.secret,
    };
  }

  if (sawSecretDecryptionFailure) {
    throw new Error(getGeminiSecretRotationErrorMessage());
  }

  return null;
}

async function markPromptPackWaitingForGeminiKey(
  context: PromptPackGenerationContext,
  promptPackId: string,
  taskId: string,
  message: string,
) {
  const waitingTask = await markTaskWaitingForKey(taskId, message);
  const { error } = await context.supabase
    .from("prompt_packs")
    .update({
      ai_task_id: taskId,
      status: "QUEUED",
      error_message: message,
    })
    .eq("id", promptPackId)
    .eq("user_id", context.user.id);

  if (error) {
    throw new Error(error.message);
  }

  return {
    task: waitingTask,
    promptPack: context.promptPack,
    message,
  };
}

export async function runRealPromptPackTask(promptPackId: string, taskId: string) {
  const context = await loadPromptPackGenerationContext(promptPackId);
  await markTaskRunning(taskId);
  const excludedQuotaGroups = new Set<string>();

  while (true) {
    const selected = await selectPromptPackGeminiKey(context, excludedQuotaGroups);

    if (!selected) {
      return markPromptPackWaitingForGeminiKey(
        context,
        promptPackId,
        taskId,
        "No eligible Gemini key is available for prompt-pack generation.",
      );
    }

    const selectedKey = selected.key;
    const { error: taskKeyUpdateError } = await context.serviceClient
      .from("ai_tasks")
      .update({
        gemini_api_key_id: selectedKey.id,
      })
      .eq("id", taskId)
      .eq("user_id", context.user.id);

    if (taskKeyUpdateError) {
      const message = sanitizeGeminiFailureMessage(new Error(taskKeyUpdateError.message));
      await markTaskFailed(taskId, message, { retryable: false }).catch(() => undefined);
      throw new Error(message);
    }

    const { error: generatingUpdateError } = await context.supabase
      .from("prompt_packs")
      .update({
        ai_task_id: taskId,
        status: "GENERATING",
        error_message: null,
      })
      .eq("id", promptPackId)
      .eq("user_id", context.user.id);

    if (generatingUpdateError) {
      const message = sanitizeGeminiFailureMessage(new Error(generatingUpdateError.message));
      await markTaskFailed(taskId, message, { retryable: false }).catch(() => undefined);
      throw new Error(message);
    }

    try {
      const response = await generateTrackedGeminiJsonText({
        aiTaskId: taskId,
        geminiApiKey: selectedKey,
        taskType: "PROMPT_PACK_GENERATION",
        userId: context.user.id,
        request: {
          modelName: selectedKey.model_name as GeminiModelName,
          apiKey: selected.secret,
          prompt: buildPromptPackGenerationPrompt(context, selectedKey),
          temperature: 0.2,
          maxOutputTokens: 4096,
          timeoutMs: 120_000,
          responseJsonSchema: GEMINI_PROMPT_PACK_RESPONSE_SCHEMA,
        },
      });

      const outputJson = parsePromptPackGenerationOutput(response.text, {
        fallbackProductStatus: context.product.status,
        fallbackSourceImage: buildPromptSourceImageSnapshot(context.sourceProductImage, context.sourceDriveItem),
        serverPromptContext: context.promptContext,
      });
      const promptPack = await updatePromptPackGenerationResult(context, taskId, outputJson);
      const task = await markTaskSuccess(taskId, outputJson);

      await markGeminiKeySuccess({
        serviceClient: context.serviceClient,
        userId: context.user.id,
        key: selectedKey,
      }).catch(() => undefined);

      return {
        task,
        promptPack,
        message: `Prompt pack generated with Gemini using ${buildGeminiKeySelectionLabel(selectedKey)}.`,
      };
    } catch (error) {
      if (error instanceof GeminiClientError && error.status === 429) {
        const retryAfterSeconds = error.retryAfterSeconds ?? 900;
        const cooldownUntil = retryAfterSeconds > 0 ? new Date(Date.now() + retryAfterSeconds * 1000).toISOString() : null;
        const nextStatus = retryAfterSeconds > 0 ? "COOLDOWN" : "RATE_LIMITED";
        const quotaGroup = getGeminiQuotaGroupKey(selectedKey);

        excludedQuotaGroups.add(quotaGroup);

        await markGeminiQuotaGroupCooldown({
          serviceClient: context.serviceClient,
          userId: context.user.id,
          key: selectedKey,
          nextStatus,
          cooldownUntil,
        }).catch(() => undefined);

        continue;
      }

      const message = sanitizeGeminiFailureMessage(error);
      const failedTask = await markTaskFailed(taskId, message, { retryable: false });

      try {
        await updatePromptPackGenerationFailure(context, taskId, message);
      } catch {
        // Preserve the original failure if prompt pack update also fails.
      }

      return {
        task: failedTask,
        promptPack: context.promptPack,
        message,
      };
    }
  }
}

export async function createMockPromptPackOutput(id: string) {
  const created = await createPromptPackGenerationTask(id, { generationMode: "mock", maxRetries: 0 });
  const completed = await runMockPromptPackTask(id, created.task.id);

  return completed.promptPack;
}

export async function listPromptPacks(input?: {
  productId?: string;
  workspaceId?: string | null;
  status?: PromptPackStatus | string;
  limit?: number;
}) {
  const { supabase, user } = await requireUser();

  if (input?.status) {
    assertPromptPackStatus(input.status);
  }

  const limit = Math.min(Math.max(input?.limit ?? 100, 1), 200);
  let query = supabase
    .from("prompt_packs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (input?.productId) {
    query = query.eq("product_id", input.productId);
  }

  if (input?.workspaceId) {
    const { data: workspaceProducts, error: workspaceProductsError } = await supabase
      .from("products")
      .select("id")
      .eq("user_id", user.id)
      .eq("workspace_id", input.workspaceId);

    if (workspaceProductsError) {
      throw new Error(workspaceProductsError.message);
    }

    const productIds = (workspaceProducts ?? []).map((product) => product.id);

    if (!productIds.length) {
      return [];
    }

    query = query.in("product_id", productIds);
  }

  if (input?.status) {
    query = query.eq("status", input.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as PromptPackRecord[];
}

export async function getPromptPackById(id: string) {
  const { promptPack } = await requireOwnedPromptPack(id);
  return promptPack;
}

export async function createPromptPack(input: PromptPackInput) {
  const { supabase, user, product } = await requireOwnedProduct(input.product_id);
  const status = input.status ?? "DRAFT";
  assertPromptPackStatus(status);
  const version = ensurePromptVersion(input.version ?? 1);
  let resolvedWorkspaceId = product.workspace_id ?? (await getCurrentWorkspace())?.id ?? null;
  const explicitIntakeSessionId = normalizeNullableText(input.intake_session_id);
  const explicitSourceProductImageId = normalizeNullableText(input.source_product_image_id);
  const explicitAffiliateProfileId = normalizeNullableText(input.affiliate_profile_id);
  const intakeSession = explicitIntakeSessionId
    ? await getIntakeSessionById(explicitIntakeSessionId)
    : (
        await listIntakeSessions({
          productId: product.id,
          workspaceId: resolvedWorkspaceId,
          limit: 25,
        })
      ).find((session) => session.status === "REVIEWED" || Boolean(session.reviewed_metadata_json)) ?? null;
  const sourceProductImage = explicitSourceProductImageId
    ? (await requireOwnedProductImage(explicitSourceProductImageId, input.product_id)).productImage
    : await getPrimaryProductImageForPromptPack(input.product_id);
  const affiliateProfile = explicitAffiliateProfileId
    ? await getAffiliateProfileById(explicitAffiliateProfileId)
    : await getDefaultAffiliateProfileForWorkspace(resolvedWorkspaceId);
  const sourceProductImageId = sourceProductImage?.id ?? null;
  const intakeSessionId = intakeSession?.id ?? null;
  const affiliateProfileId = affiliateProfile?.id ?? null;

  if (!intakeSession || !intakeSession.reviewed_metadata_json) {
    throw new Error("Review Gemini metadata before generating a prompt pack.");
  }

  if (intakeSession.product_id !== input.product_id) {
    throw new Error("Intake session must belong to the selected product.");
  }

  if (resolvedWorkspaceId && intakeSession.workspace_id && intakeSession.workspace_id !== resolvedWorkspaceId) {
    throw new Error("Intake session must belong to the selected workspace.");
  }

  if (sourceProductImageId && !sourceProductImage) {
    throw new Error("Source product image not found.");
  }

  if (!sourceProductImage) {
    throw new Error("Source product image is required before prompt generation.");
  }

  if (affiliateProfile && resolvedWorkspaceId && !affiliateProfile.workspace_ids.includes(resolvedWorkspaceId)) {
    throw new Error("Affiliate profile must be linked to the selected workspace.");
  }

  if (!resolvedWorkspaceId && affiliateProfile?.default_workspace_id) {
    resolvedWorkspaceId = affiliateProfile.default_workspace_id;
  }

  if (!resolvedWorkspaceId) {
    throw new Error("Affiliate Profile namespace is required before prompt generation.");
  }

  assertAffiliateProfileReadyForPromptGeneration(affiliateProfile);

  const { data, error } = await supabase
    .from("prompt_packs")
    .insert({
      user_id: user.id,
      product_id: input.product_id,
      intake_session_id: intakeSessionId,
      affiliate_profile_id: affiliateProfileId,
      source_product_image_id: sourceProductImageId,
      prompt_code: normalizePromptCode(input.prompt_code ?? buildPromptCode(product.product_code)),
      version,
      status,
      product_analysis_json: input.product_analysis_json ?? null,
      i2i_prompts_json: input.i2i_prompts_json ?? null,
      i2v_prompts_json: input.i2v_prompts_json ?? null,
      consistency_rules_json: input.consistency_rules_json ?? null,
      negative_rules_json: input.negative_rules_json ?? null,
      personalization_json: input.personalization_json ?? null,
      ai_task_id: null,
      error_message: normalizeNullableText(input.error_message),
      notes: normalizeNullableText(input.notes),
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/prompts");
  revalidatePath(`/products/${input.product_id}`);
  return data as PromptPackRecord;
}

export async function updatePromptPack(id: string, input: PromptPackUpdateInput) {
  const { supabase, user, promptPack } = await requireOwnedPromptPack(id);

  if (input.status) {
    assertPromptPackStatus(input.status);
  }

  const nextProductId = input.product_id ?? promptPack.product_id;
  const nextSourceProductImageId =
    input.source_product_image_id === undefined
      ? promptPack.source_product_image_id
      : normalizeNullableText(input.source_product_image_id);
  const nextIntakeSessionId =
    input.intake_session_id === undefined
      ? input.product_id !== undefined
        ? null
        : promptPack.intake_session_id
      : normalizeNullableText(input.intake_session_id);
  const nextAffiliateProfileId =
    input.affiliate_profile_id === undefined
      ? input.product_id !== undefined
        ? null
        : promptPack.affiliate_profile_id
      : normalizeNullableText(input.affiliate_profile_id);
  const nextProduct = input.product_id !== undefined ? await requireOwnedProduct(input.product_id) : null;
  const resolvedWorkspaceId = nextProduct?.product.workspace_id ?? (await getCurrentWorkspace())?.id ?? null;

  if (nextSourceProductImageId) {
    await requireOwnedProductImage(nextSourceProductImageId, nextProductId);
  }

  if (nextIntakeSessionId) {
    const intakeSession = await getIntakeSessionById(nextIntakeSessionId);

    if (intakeSession.product_id !== nextProductId) {
      throw new Error("Intake session must belong to the selected product.");
    }

    if (resolvedWorkspaceId && intakeSession.workspace_id && intakeSession.workspace_id !== resolvedWorkspaceId) {
      throw new Error("Intake session must belong to the selected workspace.");
    }
  }

  if (nextAffiliateProfileId) {
    const affiliateProfile = await getAffiliateProfileById(nextAffiliateProfileId);

    if (resolvedWorkspaceId && !affiliateProfile.workspace_ids.includes(resolvedWorkspaceId)) {
      throw new Error("Affiliate profile must be linked to the selected workspace.");
    }
  }

  const { data, error } = await supabase
    .from("prompt_packs")
    .update({
      ...(input.product_id !== undefined ? { product_id: input.product_id } : {}),
      ...(input.source_product_image_id !== undefined
        ? { source_product_image_id: nextSourceProductImageId }
        : input.product_id !== undefined
          ? { source_product_image_id: null }
          : {}),
      ...(input.intake_session_id !== undefined
        ? { intake_session_id: nextIntakeSessionId }
        : input.product_id !== undefined
          ? { intake_session_id: null }
          : {}),
      ...(input.affiliate_profile_id !== undefined
        ? { affiliate_profile_id: nextAffiliateProfileId }
        : input.product_id !== undefined
          ? { affiliate_profile_id: null }
          : {}),
      ...(input.prompt_code !== undefined && input.prompt_code !== null
        ? { prompt_code: normalizePromptCode(input.prompt_code) }
        : {}),
      ...(input.version !== undefined ? { version: ensurePromptVersion(input.version) } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.product_analysis_json !== undefined ? { product_analysis_json: input.product_analysis_json } : {}),
      ...(input.i2i_prompts_json !== undefined ? { i2i_prompts_json: input.i2i_prompts_json } : {}),
      ...(input.i2v_prompts_json !== undefined ? { i2v_prompts_json: input.i2v_prompts_json } : {}),
      ...(input.consistency_rules_json !== undefined ? { consistency_rules_json: input.consistency_rules_json } : {}),
      ...(input.negative_rules_json !== undefined ? { negative_rules_json: input.negative_rules_json } : {}),
      ...(input.personalization_json !== undefined ? { personalization_json: input.personalization_json } : {}),
      ...(input.error_message !== undefined ? { error_message: normalizeNullableText(input.error_message) } : {}),
      ...(input.notes !== undefined ? { notes: normalizeNullableText(input.notes) } : {}),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/prompts");
  revalidatePath(`/products/${nextProductId}`);
  return data as PromptPackRecord;
}

function assertPromptSetReadyForFlow(promptPack: PromptPackRecord) {
  const promptSet = readPromptPackEditorPromptSet(promptPack);

  for (const clipKey of PROMPT_CLIP_KEYS) {
    const clip = promptSet.clips[clipKey];

    if (!readText(clip.i2i_first_frame) || !readText(clip.i2i_last_frame) || !readText(clip.i2v_prompt)) {
      throw new Error("Complete both clips before marking the selected version ready for Flow.");
    }
  }

  if (!readText(promptSet.caption) || !readText(promptSet.tags)) {
    throw new Error("Caption and tags are required before marking the selected version ready for Flow.");
  }
}

async function nextPromptPackVersion(input: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  promptCode: string;
}) {
  const { data, error } = await input.supabase
    .from("prompt_packs")
    .select("version")
    .eq("user_id", input.userId)
    .eq("prompt_code", input.promptCode)
    .order("version", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  const latestVersion = (data?.[0]?.version as number | undefined) ?? 0;
  return latestVersion + 1;
}

export async function createPromptPackRegenerationVersion(
  id: string,
  input?: {
    storagePayload?: PromptPackStoragePayload;
    revisionInstruction?: string | null;
    productId?: string | null;
    intakeSessionId?: string | null;
    affiliateProfileId?: string | null;
    sourceProductImageId?: string | null;
    notes?: string | null;
  },
) {
  const { supabase, user, promptPack } = await requireOwnedPromptPack(id);
  const nextVersion = await nextPromptPackVersion({
    supabase,
    userId: user.id,
    promptCode: promptPack.prompt_code,
  });
  if (!input?.storagePayload) {
    throw new Error("Regeneration requires strict copy prompt JSON payload.");
  }

  const storagePayload = input.storagePayload;
  const revisionInstruction = normalizeNullableText(input?.revisionInstruction);
  const personalization = {
    ...storagePayload.personalization_json,
    ...(revisionInstruction
      ? {
          regeneration_request: {
            source_prompt_pack_id: promptPack.id,
            source_version: promptPack.version,
            revision_instruction: revisionInstruction,
            requested_at: new Date().toISOString(),
          },
        }
      : {}),
  } satisfies JsonObject;

  return await createPromptPack({
    product_id: normalizeNullableText(input?.productId) ?? promptPack.product_id,
    intake_session_id:
      input?.intakeSessionId === undefined ? promptPack.intake_session_id : normalizeNullableText(input.intakeSessionId),
    affiliate_profile_id:
      input?.affiliateProfileId === undefined ? promptPack.affiliate_profile_id : normalizeNullableText(input.affiliateProfileId),
    source_product_image_id:
      input?.sourceProductImageId === undefined ? promptPack.source_product_image_id : normalizeNullableText(input.sourceProductImageId),
    prompt_code: promptPack.prompt_code,
    version: nextVersion,
    status: "DRAFT",
    product_analysis_json: promptPack.product_analysis_json,
    i2i_prompts_json: storagePayload.i2i_prompts_json,
    i2v_prompts_json: storagePayload.i2v_prompts_json,
    consistency_rules_json: promptPack.consistency_rules_json,
    negative_rules_json: promptPack.negative_rules_json,
    personalization_json: personalization,
    notes: input?.notes === undefined ? promptPack.notes : normalizeNullableText(input.notes),
  });
}

export async function markPromptPackReadyForFlow(id: string) {
  const { supabase, user, promptPack } = await requireOwnedPromptPack(id);
  assertPromptSetReadyForFlow(promptPack);

  const { error: resetError } = await supabase
    .from("prompt_packs")
    .update({
      status: "GENERATED",
    })
    .eq("user_id", user.id)
    .eq("prompt_code", promptPack.prompt_code)
    .eq("product_id", promptPack.product_id)
    .eq("status", PROMPT_READY_FOR_FLOW_STATUS)
    .neq("id", promptPack.id);

  if (resetError) {
    throw new Error(resetError.message);
  }

  const { data, error } = await supabase
    .from("prompt_packs")
    .update({
      status: PROMPT_READY_FOR_FLOW_STATUS,
      error_message: null,
    })
    .eq("id", promptPack.id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/prompts");
  revalidatePath(`/products/${promptPack.product_id}`);
  return data as PromptPackRecord;
}

export async function archivePromptPack(id: string) {
  return await updatePromptPack(id, { status: "ARCHIVED" });
}
