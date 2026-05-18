import "server-only";

import type { AffiliateProfilePromptReadinessInput } from "@/lib/affiliate-profiles/readiness";
import { getDefaultAffiliateProfileForWorkspace, listAffiliateProfiles } from "@/lib/server/affiliate-profiles";
import { getCurrentWorkspace } from "@/lib/server/workspaces";
import { getPromptLaunchReadiness } from "@/lib/prompts/prompt-launch-readiness";
import {
  projectPromptReadiness,
  type PromptReadinessAiTaskInput,
  type PromptReadinessIntakeInput,
  type PromptReadinessMarketplaceEvidenceInput,
  type PromptReadinessProductInput,
  type PromptReadinessProjection,
  type PromptReadinessPromptPackInput,
  type PromptReadinessSourceImageInput,
} from "@/lib/prompts/prompt-readiness-projection";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ProductReadinessRow = PromptReadinessProductInput & {
  user_id: string;
  workspace_id: string | null;
  product_code: string;
  product_name: string;
  niche: string | null;
  marketplace: string | null;
  marketplace_product_link: string | null;
  created_at: string;
  updated_at: string;
};

type SourceImageReadinessRow = PromptReadinessSourceImageInput & {
  id: string;
  user_id: string;
  product_id: string;
  drive_item_ref_id: string;
  source_type: string;
  is_primary: boolean;
  status: string;
  created_at: string;
  updated_at: string;
};

type MarketplaceReadinessRow = PromptReadinessMarketplaceEvidenceInput & {
  id: string;
  user_id: string;
  workspace_id: string | null;
  product_id: string;
  platform: string;
  screenshot_drive_item_ref_id: string | null;
  parsed_metadata_json: unknown;
  status: string;
  created_at: string;
  updated_at: string;
};

type IntakeReadinessRow = PromptReadinessIntakeInput & {
  id: string;
  user_id: string;
  workspace_id: string | null;
  product_id: string | null;
  product_photo_drive_item_ref_id: string | null;
  screenshot_drive_item_ref_id: string | null;
  parsed_metadata_json: unknown;
  reviewed_metadata_json: unknown;
  status: string;
  created_at: string;
  updated_at: string;
};

type PromptPackReadinessRow = PromptReadinessPromptPackInput & {
  id: string;
  user_id: string;
  product_id: string;
  intake_session_id: string | null;
  affiliate_profile_id: string | null;
  source_product_image_id: string | null;
  prompt_code: string;
  version: number;
  status: string;
  ai_task_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type AiTaskReadinessRow = PromptReadinessAiTaskInput & {
  id: string;
  task_type: string;
  status: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type AffiliateProfileReadinessRow = AffiliateProfilePromptReadinessInput & {
  id: string;
};

export type PromptReadinessProjectionContext = {
  defaultAffiliateProfile?: AffiliateProfileReadinessRow | null;
  affiliateProfiles?: readonly AffiliateProfileReadinessRow[] | null;
};

export type PromptReadinessProjectionRow = PromptReadinessProjection & {
  product: ProductReadinessRow;
  sourceImage: SourceImageReadinessRow | null;
  intakeSession: IntakeReadinessRow | null;
  promptPack: PromptPackReadinessRow | null;
  aiTask: AiTaskReadinessRow | null;
  affiliateProfileId: string | null;
};

export type ListPromptReadinessProjectionsInput = {
  workspaceId?: string | null;
  productIds?: readonly string[];
  limit?: number;
  affiliateProfileContext?: PromptReadinessProjectionContext;
};

function clampLimit(value: number | undefined) {
  return Math.min(Math.max(value ?? 100, 1), 200);
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

function timestampOf(value: { updated_at?: string | null; created_at?: string | null } | null | undefined) {
  const rawValue = value?.updated_at ?? value?.created_at ?? "";
  const timestamp = rawValue ? new Date(rawValue).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function latestByTimestamp<T extends { updated_at?: string | null; created_at?: string | null }>(items: readonly T[]) {
  return [...items].sort((left, right) => timestampOf(right) - timestampOf(left))[0] ?? null;
}

function selectSourceImage(images: readonly SourceImageReadinessRow[], promptPack: PromptPackReadinessRow | null) {
  if (promptPack?.source_product_image_id) {
    const promptSourceImage = images.find((image) => image.id === promptPack.source_product_image_id) ?? null;

    if (promptSourceImage) {
      return promptSourceImage;
    }
  }

  const activeImages = images.filter((image) => ["ATTACHED", "ANALYZED"].includes(image.status));
  return activeImages.find((image) => image.is_primary) ?? latestByTimestamp(activeImages);
}

function selectIntakeSession(sessions: readonly IntakeReadinessRow[], promptPack: PromptPackReadinessRow | null) {
  if (promptPack?.intake_session_id) {
    const promptIntakeSession = sessions.find((session) => session.id === promptPack.intake_session_id) ?? null;

    if (promptIntakeSession) {
      return promptIntakeSession;
    }
  }

  const activeSessions = sessions.filter((session) => session.status !== "ARCHIVED");
  const reviewedSessions = activeSessions.filter((session) => Boolean(session.reviewed_metadata_json));

  return latestByTimestamp(reviewedSessions) ?? latestByTimestamp(activeSessions);
}

function selectPromptTask(promptPack: PromptPackReadinessRow | null, tasks: readonly AiTaskReadinessRow[]) {
  if (promptPack?.ai_task_id) {
    return tasks.find((task) => task.id === promptPack.ai_task_id) ?? null;
  }

  return latestByTimestamp(tasks);
}

function selectAffiliateProfileId(promptPack: PromptPackReadinessRow | null, defaultAffiliateProfileId: string | null) {
  return promptPack?.affiliate_profile_id ?? defaultAffiliateProfileId;
}

async function loadPromptReadinessAffiliateProfileContext(input: {
  workspaceId: string | null;
  context?: PromptReadinessProjectionContext;
}) {
  const defaultAffiliateProfilePromise =
    input.context?.defaultAffiliateProfile !== undefined
      ? Promise.resolve(input.context.defaultAffiliateProfile)
      : getDefaultAffiliateProfileForWorkspace(input.workspaceId ?? null);
  const affiliateProfilesPromise =
    input.context?.affiliateProfiles !== undefined
      ? Promise.resolve(input.context.affiliateProfiles ?? [])
      : listAffiliateProfiles({ workspaceId: input.workspaceId, status: "ACTIVE", limit: 200 });

  const [defaultAffiliateProfile, affiliateProfiles] = await Promise.all([
    defaultAffiliateProfilePromise,
    affiliateProfilesPromise,
  ]);

  return {
    defaultAffiliateProfile,
    affiliateProfiles,
  };
}

export async function listPromptReadinessProjections(
  input?: ListPromptReadinessProjectionsInput,
): Promise<PromptReadinessProjectionRow[]> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  const workspaceId = input?.workspaceId === undefined ? (await getCurrentWorkspace())?.id ?? null : input.workspaceId;
  const requestedProductIds = uniqueTextValues(input?.productIds ?? []);

  if (input?.productIds && requestedProductIds.length === 0) {
    return [];
  }

  let productsQuery = supabase
    .from("products")
    .select(
      "id, user_id, workspace_id, product_code, product_name, niche, marketplace, marketplace_product_link, status, created_at, updated_at",
    )
    .eq("user_id", user.id)
    .neq("status", "ARCHIVED")
    .order("created_at", { ascending: false })
    .limit(clampLimit(input?.limit));

  if (workspaceId) {
    productsQuery = productsQuery.eq("workspace_id", workspaceId);
  }

  if (requestedProductIds.length) {
    productsQuery = productsQuery.in("id", requestedProductIds);
  }

  const { data: productsData, error: productsError } = await productsQuery;

  if (productsError) {
    throw new Error(productsError.message);
  }

  const products = (productsData ?? []) as ProductReadinessRow[];
  const productIds = products.map((product) => product.id);

  if (!productIds.length) {
    return [];
  }

  const { defaultAffiliateProfile, affiliateProfiles } = await loadPromptReadinessAffiliateProfileContext({
    workspaceId,
    context: input?.affiliateProfileContext,
  });

  const [imageResult, marketplaceResult, intakeResult, promptPackResult] = await Promise.all([
    supabase
      .from("product_images")
      .select("id, user_id, product_id, drive_item_ref_id, source_type, is_primary, status, created_at, updated_at")
      .eq("user_id", user.id)
      .in("product_id", productIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("product_marketplace_sources")
      .select(
        "id, user_id, workspace_id, product_id, platform, screenshot_drive_item_ref_id, parsed_metadata_json, status, created_at, updated_at",
      )
      .eq("user_id", user.id)
      .in("product_id", productIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("product_intake_sessions")
      .select(
        "id, user_id, workspace_id, product_id, product_photo_drive_item_ref_id, screenshot_drive_item_ref_id, parsed_metadata_json, reviewed_metadata_json, status, created_at, updated_at",
      )
      .eq("user_id", user.id)
      .in("product_id", productIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("prompt_packs")
      .select(
        "id, user_id, product_id, intake_session_id, affiliate_profile_id, source_product_image_id, prompt_code, version, status, ai_task_id, error_message, created_at, updated_at",
      )
      .eq("user_id", user.id)
      .in("product_id", productIds)
      .order("created_at", { ascending: false }),
  ]);

  if (imageResult.error) {
    throw new Error(imageResult.error.message);
  }

  if (marketplaceResult.error) {
    throw new Error(marketplaceResult.error.message);
  }

  if (intakeResult.error) {
    throw new Error(intakeResult.error.message);
  }

  if (promptPackResult.error) {
    throw new Error(promptPackResult.error.message);
  }

  const sourceImages = (imageResult.data ?? []) as SourceImageReadinessRow[];
  const marketplaceSources = (marketplaceResult.data ?? []) as MarketplaceReadinessRow[];
  const intakeSessions = (intakeResult.data ?? []) as IntakeReadinessRow[];
  const promptPacks = (promptPackResult.data ?? []) as PromptPackReadinessRow[];
  const taskIds = uniqueTextValues(promptPacks.map((pack) => pack.ai_task_id));
  const aiTaskResult = taskIds.length
    ? await supabase
        .from("ai_tasks")
        .select("id, task_type, status, error_message, created_at, updated_at")
        .eq("user_id", user.id)
        .in("id", taskIds)
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  if (aiTaskResult.error) {
    throw new Error(aiTaskResult.error.message);
  }

  const aiTasks = (aiTaskResult.data ?? []) as AiTaskReadinessRow[];
  const imagesByProductId = groupByProductId(sourceImages);
  const marketplaceByProductId = groupByProductId(marketplaceSources);
  const intakeByProductId = groupByProductId(intakeSessions);
  const promptPacksByProductId = groupByProductId(promptPacks);
  const taskMap = new Map(aiTasks.map((task) => [task.id, task]));
  const profileMap = new Map(affiliateProfiles.map((profile) => [profile.id, profile]));
  const defaultAffiliateProfileId = defaultAffiliateProfile?.id ?? null;

  return products.map((product) => {
    const productImages = imagesByProductId.get(product.id) ?? [];
    const productMarketplaceSources = marketplaceByProductId.get(product.id) ?? [];
    const productIntakeSessions = intakeByProductId.get(product.id) ?? [];
    const productPromptPacks = promptPacksByProductId.get(product.id) ?? [];
    const promptPack = latestByTimestamp(productPromptPacks.filter((pack) => pack.status !== "ARCHIVED"));
    const sourceImage = selectSourceImage(productImages, promptPack);
    const intakeSession = selectIntakeSession(productIntakeSessions, promptPack);
    const promptPackTask = promptPack?.ai_task_id ? taskMap.get(promptPack.ai_task_id) ?? null : null;
    const productTasks = promptPackTask ? [promptPackTask] : [];
    const aiTask = selectPromptTask(promptPack, productTasks);
    const affiliateProfileId = selectAffiliateProfileId(promptPack, defaultAffiliateProfileId);
    const affiliateProfile = affiliateProfileId
      ? profileMap.get(affiliateProfileId) ?? (defaultAffiliateProfile?.id === affiliateProfileId ? defaultAffiliateProfile : null)
      : null;
    const sourceImageDriveItemRefId = sourceImage?.drive_item_ref_id ?? intakeSession?.product_photo_drive_item_ref_id ?? null;
    const marketplaceEvidenceDriveItemRefId =
      productMarketplaceSources.find((source) => source.status !== "ARCHIVED" && source.screenshot_drive_item_ref_id)
        ?.screenshot_drive_item_ref_id ??
      intakeSession?.screenshot_drive_item_ref_id ??
      null;
    const launchReadiness = getPromptLaunchReadiness({
      productId: product.id,
      intakeSessionId: intakeSession?.id ?? null,
      affiliateProfileId,
      hasReviewedMetadata: Boolean(intakeSession?.reviewed_metadata_json),
      reviewedMetadata: intakeSession?.reviewed_metadata_json ?? null,
      sourceImageDriveItemRefId,
      affiliateProfile,
    });
    const projection = projectPromptReadiness({
      product,
      sourceImageDriveItemRefId,
      marketplaceEvidenceDriveItemRefId,
      sourceImages: productImages,
      marketplaceSources: productMarketplaceSources,
      intakeSessions: productIntakeSessions,
      promptPacks: productPromptPacks,
      aiTasks: productTasks,
      affiliateProfile,
      launchReadiness,
    });

    return {
      ...projection,
      product,
      sourceImage,
      intakeSession,
      promptPack,
      aiTask,
      affiliateProfileId,
    };
  });
}
