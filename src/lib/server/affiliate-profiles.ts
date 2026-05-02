import "server-only";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  AFFILIATE_PLATFORMS,
  AFFILIATE_PROFILE_STATUSES,
  assertAffiliatePlatform,
  assertAffiliateProfileStatus,
  normalizeAffiliateProfileCode,
  normalizeAffiliateProfileRulesText,
  normalizeAffiliateProfileUuid,
  normalizeNullableAffiliateProfileText,
  normalizeNullableAffiliateProfileUuid,
  readAffiliateProfileText,
  validateAffiliateProfileInput,
  type AffiliatePlatform,
  type AffiliateProfileInput,
  type AffiliateProfileStatus,
} from "@/lib/affiliate-profiles/validation";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type AffiliateProfileContext = {
  supabase: SupabaseServerClient;
  user: {
    id: string;
  };
};

export type AffiliateProfileRecord = {
  id: string;
  user_id: string;
  workspace_id: string;
  profile_code: string;
  profile_name: string;
  platform: AffiliatePlatform;
  account_label: string | null;
  niche: string | null;
  affiliate_url: string | null;
  notes: string | null;
  i2i_prompt_rules: string;
  i2v_prompt_rules: string;
  caption_rules: string;
  hashtag_rules: string;
  negative_prompt_rules: string;
  product_positioning_notes: string;
  lock_seed_character: boolean;
  seed_character_notes: string;
  seed_character_drive_item_ref_id: string | null;
  lock_environment: boolean;
  environment_notes: string;
  environment_drive_item_ref_id: string | null;
  status: AffiliateProfileStatus;
  created_at: string;
  updated_at: string;
};

type AffiliateProfileUpdateInput = Partial<AffiliateProfileInput>;

function errorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : "";
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
    ? error.message
    : "Affiliate profile operation failed.";
}

export function isAffiliateProfileSchemaMissingError(error: unknown) {
  const message = errorMessage(error).toLowerCase();

  return (
    errorCode(error) === "42P01" ||
    errorCode(error) === "42704" ||
    message.includes("affiliate profile schema is not applied") ||
    (message.includes("relation") && message.includes("affiliate_profiles") && message.includes("does not exist")) ||
    (message.includes("type") &&
      (message.includes("affiliate_platform") || message.includes("affiliate_profile_status")) &&
      message.includes("does not exist"))
  );
}

function affiliateProfileSchemaMissingError() {
  return new Error("Affiliate profile schema is not applied yet. Apply the Sprint 13 migration first.");
}

function throwAffiliateProfileError(error: unknown): never {
  if (isAffiliateProfileSchemaMissingError(error)) {
    throw affiliateProfileSchemaMissingError();
  }

  throw new Error(errorMessage(error));
}

async function requireUser(): Promise<AffiliateProfileContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  return { supabase, user };
}

async function requireOwnedActiveWorkspace(context: AffiliateProfileContext, workspaceId: string) {
  const { data, error } = await context.supabase
    .from("workspaces")
    .select("id")
    .eq("id", workspaceId)
    .eq("user_id", context.user.id)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (error) {
    throwAffiliateProfileError(error);
  }

  if (!data) {
    throw new Error("Choose an active workspace.");
  }
}

async function requireOwnedDriveItem(context: AffiliateProfileContext, driveItemId: string) {
  const { data, error } = await context.supabase
    .from("drive_items")
    .select("id")
    .eq("id", driveItemId)
    .eq("user_id", context.user.id)
    .maybeSingle();

  if (error) {
    throwAffiliateProfileError(error);
  }

  if (!data) {
    throw new Error("Drive reference not found.");
  }
}

async function requireOwnedAffiliateProfile(context: AffiliateProfileContext, id: string) {
  const { data, error } = await context.supabase
    .from("affiliate_profiles")
    .select("*")
    .eq("id", id)
    .eq("user_id", context.user.id)
    .maybeSingle();

  if (error) {
    throwAffiliateProfileError(error);
  }

  if (!data) {
    throw new Error("Affiliate profile not found.");
  }

  return data as AffiliateProfileRecord;
}

async function validateReferences(context: AffiliateProfileContext, input: {
  workspace_id?: string | null;
  seed_character_drive_item_ref_id?: string | null;
  environment_drive_item_ref_id?: string | null;
}) {
  if (input.workspace_id) {
    await requireOwnedActiveWorkspace(context, input.workspace_id);
  }

  if (input.seed_character_drive_item_ref_id) {
    await requireOwnedDriveItem(context, input.seed_character_drive_item_ref_id);
  }

  if (input.environment_drive_item_ref_id) {
    await requireOwnedDriveItem(context, input.environment_drive_item_ref_id);
  }
}

function buildAffiliateProfileUpdatePayload(input: AffiliateProfileUpdateInput) {
  const payload: Partial<{
    workspace_id: string;
    profile_code: string;
    profile_name: string;
    platform: AffiliatePlatform;
    account_label: string | null;
    niche: string | null;
    affiliate_url: string | null;
    notes: string | null;
    i2i_prompt_rules: string;
    i2v_prompt_rules: string;
    caption_rules: string;
    hashtag_rules: string;
    negative_prompt_rules: string;
    product_positioning_notes: string;
    lock_seed_character: boolean;
    seed_character_notes: string;
    seed_character_drive_item_ref_id: string | null;
    lock_environment: boolean;
    environment_notes: string;
    environment_drive_item_ref_id: string | null;
    status: AffiliateProfileStatus;
  }> = {};

  if (input.workspace_id !== undefined) {
    payload.workspace_id = normalizeAffiliateProfileUuid(input.workspace_id, "Choose a workspace.");
  }

  if (input.profile_code !== undefined) {
    const profileCode = normalizeAffiliateProfileCode(input.profile_code);

    if (!profileCode) {
      throw new Error("Profile code is required.");
    }

    payload.profile_code = profileCode;
  }

  if (input.profile_name !== undefined) {
    const profileName = readAffiliateProfileText(input.profile_name);

    if (!profileName) {
      throw new Error("Profile name is required.");
    }

    payload.profile_name = profileName;
  }

  if (input.platform !== undefined) {
    assertAffiliatePlatform(input.platform);
    payload.platform = input.platform;
  }

  if (input.account_label !== undefined) {
    payload.account_label = normalizeNullableAffiliateProfileText(input.account_label);
  }

  if (input.niche !== undefined) {
    payload.niche = normalizeNullableAffiliateProfileText(input.niche);
  }

  if (input.affiliate_url !== undefined) {
    payload.affiliate_url = normalizeNullableAffiliateProfileText(input.affiliate_url);
  }

  if (input.notes !== undefined) {
    payload.notes = normalizeNullableAffiliateProfileText(input.notes);
  }

  if (input.i2i_prompt_rules !== undefined) {
    payload.i2i_prompt_rules = normalizeAffiliateProfileRulesText(input.i2i_prompt_rules);
  }

  if (input.i2v_prompt_rules !== undefined) {
    payload.i2v_prompt_rules = normalizeAffiliateProfileRulesText(input.i2v_prompt_rules);
  }

  if (input.caption_rules !== undefined) {
    payload.caption_rules = normalizeAffiliateProfileRulesText(input.caption_rules);
  }

  if (input.hashtag_rules !== undefined) {
    payload.hashtag_rules = normalizeAffiliateProfileRulesText(input.hashtag_rules);
  }

  if (input.negative_prompt_rules !== undefined) {
    payload.negative_prompt_rules = normalizeAffiliateProfileRulesText(input.negative_prompt_rules);
  }

  if (input.product_positioning_notes !== undefined) {
    payload.product_positioning_notes = normalizeAffiliateProfileRulesText(input.product_positioning_notes);
  }

  if (input.lock_seed_character !== undefined) {
    payload.lock_seed_character = input.lock_seed_character;
  }

  if (input.seed_character_notes !== undefined) {
    payload.seed_character_notes = normalizeAffiliateProfileRulesText(input.seed_character_notes);
  }

  if (input.seed_character_drive_item_ref_id !== undefined) {
    payload.seed_character_drive_item_ref_id = normalizeNullableAffiliateProfileUuid(
      input.seed_character_drive_item_ref_id,
      "Seed character Drive reference must be a valid row id.",
    );
  }

  if (input.lock_environment !== undefined) {
    payload.lock_environment = input.lock_environment;
  }

  if (input.environment_notes !== undefined) {
    payload.environment_notes = normalizeAffiliateProfileRulesText(input.environment_notes);
  }

  if (input.environment_drive_item_ref_id !== undefined) {
    payload.environment_drive_item_ref_id = normalizeNullableAffiliateProfileUuid(
      input.environment_drive_item_ref_id,
      "Environment Drive reference must be a valid row id.",
    );
  }

  if (input.status !== undefined) {
    assertAffiliateProfileStatus(input.status);
    payload.status = input.status;
  }

  return payload;
}

export async function createAffiliateProfile(input: AffiliateProfileInput) {
  const context = await requireUser();
  const payload = validateAffiliateProfileInput(input);

  await validateReferences(context, payload);

  const { data, error } = await context.supabase
    .from("affiliate_profiles")
    .insert({
      user_id: context.user.id,
      ...payload,
    })
    .select("*")
    .single();

  if (error) {
    throwAffiliateProfileError(error);
  }

  revalidatePath("/settings");
  return data as AffiliateProfileRecord;
}

export async function listAffiliateProfiles(input?: {
  workspaceId?: string | null;
  status?: AffiliateProfileStatus | string;
  platform?: AffiliatePlatform | string;
  limit?: number;
}) {
  const context = await requireUser();

  if (input?.status) {
    assertAffiliateProfileStatus(input.status);
  }

  if (input?.platform) {
    assertAffiliatePlatform(input.platform);
  }

  const limit = Math.min(Math.max(input?.limit ?? 100, 1), 200);
  let query = context.supabase
    .from("affiliate_profiles")
    .select("*")
    .eq("user_id", context.user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (input?.workspaceId) {
    query = query.eq("workspace_id", input.workspaceId);
  }

  if (input?.status) {
    query = query.eq("status", input.status);
  }

  if (input?.platform) {
    query = query.eq("platform", input.platform);
  }

  const { data, error } = await query;

  if (error) {
    throwAffiliateProfileError(error);
  }

  return (data ?? []) as AffiliateProfileRecord[];
}

export async function updateAffiliateProfile(id: string, input: AffiliateProfileUpdateInput) {
  const context = await requireUser();
  await requireOwnedAffiliateProfile(context, id);
  const payload = buildAffiliateProfileUpdatePayload(input);

  if (!Object.keys(payload).length) {
    throw new Error("No affiliate profile changes provided.");
  }

  await validateReferences(context, payload);

  const { data, error } = await context.supabase
    .from("affiliate_profiles")
    .update(payload)
    .eq("id", id)
    .eq("user_id", context.user.id)
    .select("*")
    .single();

  if (error) {
    throwAffiliateProfileError(error);
  }

  revalidatePath("/settings");
  return data as AffiliateProfileRecord;
}

export async function archiveAffiliateProfile(id: string) {
  return await updateAffiliateProfile(id, { status: "ARCHIVED" });
}

export { AFFILIATE_PLATFORMS, AFFILIATE_PROFILE_STATUSES };
