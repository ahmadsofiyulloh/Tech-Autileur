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

type AffiliateProfileRow = {
  id: string;
  user_id: string;
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

export type AffiliateProfileWorkspaceLinkRecord = {
  id: string;
  user_id: string;
  workspace_id: string;
  affiliate_profile_id: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type AffiliateProfileRecord = AffiliateProfileRow & {
  workspace_ids: string[];
  default_workspace_id: string | null;
  workspace_id: string | null;
};

type AffiliateProfileMutationInput = AffiliateProfileInput & {
  workspace_ids?: string[] | null;
  default_workspace_id?: string | null;
};

type AffiliateProfileUpdateInput = Partial<AffiliateProfileInput> & {
  workspace_ids?: string[] | null;
  default_workspace_id?: string | null;
};

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
    message.includes("schema cache") ||
    (message.includes("could not find the table") && message.includes("affiliate_profile_workspace_links")) ||
    (message.includes("could not find the table") && message.includes("affiliate_profiles")) ||
    (message.includes("relation") && message.includes("affiliate_profiles") && message.includes("does not exist")) ||
    (message.includes("relation") && message.includes("affiliate_profile_workspace_links") && message.includes("does not exist")) ||
    (message.includes("type") &&
      (message.includes("affiliate_platform") || message.includes("affiliate_profile_status")) &&
      message.includes("does not exist"))
  );
}

function affiliateProfileSchemaMissingError() {
  return new Error("Affiliate profile schema is not applied yet. Apply the affiliate profile migration first.");
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

async function requireOwnedAffiliateProfileRow(context: AffiliateProfileContext, id: string) {
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

  return data as AffiliateProfileRow;
}

async function requireOwnedAffiliateProfile(context: AffiliateProfileContext, id: string) {
  const profile = await requireOwnedAffiliateProfileRow(context, id);
  return await hydrateAffiliateProfileRecord(context, profile);
}

async function validateReferences(context: AffiliateProfileContext, input: {
  seed_character_drive_item_ref_id?: string | null;
  environment_drive_item_ref_id?: string | null;
}) {
  if (input.seed_character_drive_item_ref_id) {
    await requireOwnedDriveItem(context, input.seed_character_drive_item_ref_id);
  }

  if (input.environment_drive_item_ref_id) {
    await requireOwnedDriveItem(context, input.environment_drive_item_ref_id);
  }
}

function normalizeWorkspaceIds(input: string[] | string | null | undefined) {
  const values = Array.isArray(input) ? input : typeof input === "string" ? [input] : [];
  return Array.from(
    new Set(
      values
        .map((value) => normalizeNullableAffiliateProfileUuid(value, "Workspace reference must be a valid row id."))
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

async function requireAffiliateProfileWorkspaceLink(context: AffiliateProfileContext, profileId: string, workspaceId: string) {
  const { data, error } = await context.supabase
    .from("affiliate_profile_workspace_links")
    .select("id")
    .eq("user_id", context.user.id)
    .eq("affiliate_profile_id", profileId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    throwAffiliateProfileError(error);
  }

  if (!data) {
    throw new Error("Affiliate profile must be linked to the selected workspace.");
  }
}

async function loadAffiliateProfileWorkspaceLinks(context: AffiliateProfileContext, profileIds: string[]) {
  if (!profileIds.length) {
    return [] as AffiliateProfileWorkspaceLinkRecord[];
  }

  const { data, error } = await context.supabase
    .from("affiliate_profile_workspace_links")
    .select("*")
    .eq("user_id", context.user.id)
    .in("affiliate_profile_id", profileIds)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    throwAffiliateProfileError(error);
  }

  return (data ?? []) as AffiliateProfileWorkspaceLinkRecord[];
}

async function hydrateAffiliateProfileRecord(context: AffiliateProfileContext, profile: AffiliateProfileRow) {
  const links = await loadAffiliateProfileWorkspaceLinks(context, [profile.id]);
  return {
    ...profile,
    workspace_ids: links.map((link) => link.workspace_id),
    default_workspace_id: links.find((link) => link.is_default)?.workspace_id ?? null,
    workspace_id: links.find((link) => link.is_default)?.workspace_id ?? links[0]?.workspace_id ?? null,
  } satisfies AffiliateProfileRecord;
}

async function hydrateAffiliateProfileRows(context: AffiliateProfileContext, profiles: AffiliateProfileRow[]) {
  if (!profiles.length) {
    return [] as AffiliateProfileRecord[];
  }

  const links = await loadAffiliateProfileWorkspaceLinks(
    context,
    profiles.map((profile) => profile.id),
  );
  const linksByProfileId = new Map<string, AffiliateProfileWorkspaceLinkRecord[]>();

  for (const link of links) {
    const existing = linksByProfileId.get(link.affiliate_profile_id) ?? [];
    existing.push(link);
    linksByProfileId.set(link.affiliate_profile_id, existing);
  }

  return profiles.map((profile) => {
    const profileLinks = linksByProfileId.get(profile.id) ?? [];
    return {
      ...profile,
      workspace_ids: profileLinks.map((link) => link.workspace_id),
      default_workspace_id: profileLinks.find((link) => link.is_default)?.workspace_id ?? null,
      workspace_id: profileLinks.find((link) => link.is_default)?.workspace_id ?? profileLinks[0]?.workspace_id ?? null,
    } satisfies AffiliateProfileRecord;
  });
}

async function syncAffiliateProfileWorkspaceLinks(
  context: AffiliateProfileContext,
  profileId: string,
  workspaceIds: string[] | null | undefined,
  defaultWorkspaceId: string | null | undefined,
) {
  const uniqueWorkspaceIds = normalizeWorkspaceIds(workspaceIds ?? []);
  const normalizedDefaultWorkspaceId =
    defaultWorkspaceId === undefined || defaultWorkspaceId === null || defaultWorkspaceId === ""
      ? uniqueWorkspaceIds[0] ?? null
      : normalizeNullableAffiliateProfileUuid(defaultWorkspaceId, "Choose a default workspace.");
  const selectedWorkspaceIds = Array.from(new Set([...uniqueWorkspaceIds, normalizedDefaultWorkspaceId].filter(Boolean) as string[]));

  if (!selectedWorkspaceIds.length) {
    const { error: deleteError } = await context.supabase
      .from("affiliate_profile_workspace_links")
      .delete()
      .eq("user_id", context.user.id)
      .eq("affiliate_profile_id", profileId);

    if (deleteError) {
      throwAffiliateProfileError(deleteError);
    }

    return;
  }

  for (const workspaceId of selectedWorkspaceIds) {
    await requireOwnedActiveWorkspace(context, workspaceId);
  }

  const { error: clearDefaultError } = await context.supabase
    .from("affiliate_profile_workspace_links")
    .update({ is_default: false })
    .eq("user_id", context.user.id)
    .in("workspace_id", selectedWorkspaceIds)
    .neq("affiliate_profile_id", profileId)
    .eq("is_default", true);

  if (clearDefaultError) {
    throwAffiliateProfileError(clearDefaultError);
  }

  const { error: deleteError } = await context.supabase
    .from("affiliate_profile_workspace_links")
    .delete()
    .eq("user_id", context.user.id)
    .eq("affiliate_profile_id", profileId);

  if (deleteError) {
    throwAffiliateProfileError(deleteError);
  }

  const { error: insertError } = await context.supabase.from("affiliate_profile_workspace_links").insert(
    selectedWorkspaceIds.map((workspaceId) => ({
      user_id: context.user.id,
      workspace_id: workspaceId,
      affiliate_profile_id: profileId,
      is_default: workspaceId === normalizedDefaultWorkspaceId,
    })),
  );

  if (insertError) {
    throwAffiliateProfileError(insertError);
  }
}

function buildAffiliateProfileUpdatePayload(input: AffiliateProfileUpdateInput) {
  const payload: Partial<{
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

  if (input.profile_code !== undefined && input.profile_code !== null) {
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

export async function createAffiliateProfile(input: AffiliateProfileMutationInput) {
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

  const profile = data as AffiliateProfileRow;
  const workspaceIds = normalizeWorkspaceIds(input.workspace_ids ?? []);

  if (workspaceIds.length) {
    await syncAffiliateProfileWorkspaceLinks(context, profile.id, workspaceIds, input.default_workspace_id);
  }

  revalidatePath("/settings");
  return await requireOwnedAffiliateProfile(context, profile.id);
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

  const rows = (data ?? []) as AffiliateProfileRow[];
  const hydrated = await hydrateAffiliateProfileRows(context, rows);

  if (!input?.workspaceId) {
    return hydrated;
  }

  return hydrated.filter((profile) => profile.workspace_ids.includes(input.workspaceId!));
}

export async function listAffiliateProfileWorkspaceLinks(input?: {
  workspaceId?: string | null;
  affiliateProfileId?: string | null;
  limit?: number;
}) {
  const context = await requireUser();
  const limit = Math.min(Math.max(input?.limit ?? 200, 1), 500);
  let query = context.supabase
    .from("affiliate_profile_workspace_links")
    .select("*")
    .eq("user_id", context.user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (input?.workspaceId) {
    query = query.eq("workspace_id", input.workspaceId);
  }

  if (input?.affiliateProfileId) {
    query = query.eq("affiliate_profile_id", input.affiliateProfileId);
  }

  const { data, error } = await query;

  if (error) {
    throwAffiliateProfileError(error);
  }

  return (data ?? []) as AffiliateProfileWorkspaceLinkRecord[];
}

export async function getAffiliateProfileById(id: string) {
  const context = await requireUser();
  return await requireOwnedAffiliateProfile(context, id);
}

export async function getDefaultAffiliateProfileForWorkspace(workspaceId: string | null) {
  if (!workspaceId) {
    return null;
  }

  const context = await requireUser();
  const { data: defaultLink, error: linkError } = await context.supabase
    .from("affiliate_profile_workspace_links")
    .select("affiliate_profile_id")
    .eq("user_id", context.user.id)
    .eq("workspace_id", workspaceId)
    .eq("is_default", true)
    .maybeSingle();

  if (linkError) {
    throwAffiliateProfileError(linkError);
  }

  if (!defaultLink?.affiliate_profile_id) {
    return null;
  }

  const profile = await requireOwnedAffiliateProfile(context, defaultLink.affiliate_profile_id);

  return profile.status === "ACTIVE" ? profile : null;
}

export async function setDefaultAffiliateProfileForWorkspace(profileId: string, workspaceId: string) {
  const context = await requireUser();
  const profile = await requireOwnedAffiliateProfile(context, profileId);

  await requireOwnedActiveWorkspace(context, workspaceId);

  if (!profile.workspace_ids.includes(workspaceId)) {
    throw new Error("Affiliate profile must be linked to the selected workspace.");
  }

  const { error: clearDefaultError } = await context.supabase
    .from("affiliate_profile_workspace_links")
    .update({ is_default: false })
    .eq("user_id", context.user.id)
    .eq("workspace_id", workspaceId)
    .eq("is_default", true);

  if (clearDefaultError) {
    throwAffiliateProfileError(clearDefaultError);
  }

  const { data: updatedLink, error: updateDefaultError } = await context.supabase
    .from("affiliate_profile_workspace_links")
    .update({ is_default: true })
    .eq("user_id", context.user.id)
    .eq("workspace_id", workspaceId)
    .eq("affiliate_profile_id", profileId)
    .select("id")
    .maybeSingle();

  if (updateDefaultError) {
    throwAffiliateProfileError(updateDefaultError);
  }

  if (!updatedLink) {
    throw new Error("Affiliate profile must be linked to the selected workspace.");
  }

  revalidatePath("/settings");
  revalidatePath("/settings/affiliate-profiles");
  revalidatePath("/prompts");
  revalidatePath("/products/new");

  return profile;
}

export async function resolvePromptAffiliateProfile(input: { workspaceId: string | null; affiliateProfileId?: string | null }) {
  const context = await requireUser();

  if (input.affiliateProfileId) {
    const profile = await requireOwnedAffiliateProfile(context, input.affiliateProfileId);

    if (input.workspaceId) {
      await requireAffiliateProfileWorkspaceLink(context, profile.id, input.workspaceId);
    }

    return profile;
  }

  if (!input.workspaceId) {
    return null;
  }

  return await getDefaultAffiliateProfileForWorkspace(input.workspaceId);
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

  const nextProfile = data as AffiliateProfileRow;

  if (input.workspace_ids !== undefined || input.default_workspace_id !== undefined) {
    await syncAffiliateProfileWorkspaceLinks(context, id, input.workspace_ids ?? [], input.default_workspace_id);
  }

  revalidatePath("/settings");
  return await requireOwnedAffiliateProfile(context, nextProfile.id);
}

export async function archiveAffiliateProfile(id: string) {
  await updateAffiliateProfile(id, { status: "ARCHIVED" });

  const context = await requireUser();
  const { error } = await context.supabase
    .from("affiliate_profile_workspace_links")
    .update({ is_default: false })
    .eq("affiliate_profile_id", id)
    .eq("user_id", context.user.id)
    .eq("is_default", true);

  if (error) {
    throwAffiliateProfileError(error);
  }

  revalidatePath("/settings");
  return await requireOwnedAffiliateProfile(context, id);
}

export { AFFILIATE_PLATFORMS, AFFILIATE_PROFILE_STATUSES };
