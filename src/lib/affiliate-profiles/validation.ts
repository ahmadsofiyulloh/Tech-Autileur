export const AFFILIATE_PLATFORMS = ["TIKTOK", "SHOPEE", "OTHER"] as const;

export const AFFILIATE_PROFILE_STATUSES = ["ACTIVE", "PAUSED", "ARCHIVED"] as const;

export type AffiliatePlatform = (typeof AFFILIATE_PLATFORMS)[number];
export type AffiliateProfileStatus = (typeof AFFILIATE_PROFILE_STATUSES)[number];

export type AffiliateProfileInput = {
  profile_code?: string | null;
  profile_name: string;
  platform?: string;
  account_label?: string | null;
  niche?: string | null;
  affiliate_url?: string | null;
  notes?: string | null;
  i2i_prompt_rules?: string | null;
  i2v_prompt_rules?: string | null;
  caption_rules?: string | null;
  hashtag_rules?: string | null;
  negative_prompt_rules?: string | null;
  product_positioning_notes?: string | null;
  lock_seed_character?: boolean;
  seed_character_notes?: string | null;
  seed_character_drive_item_ref_id?: string | null;
  lock_environment?: boolean;
  environment_notes?: string | null;
  environment_drive_item_ref_id?: string | null;
  status?: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isAffiliatePlatform(value: string): value is AffiliatePlatform {
  return (AFFILIATE_PLATFORMS as readonly string[]).includes(value);
}

export function isAffiliateProfileStatus(value: string): value is AffiliateProfileStatus {
  return (AFFILIATE_PROFILE_STATUSES as readonly string[]).includes(value);
}

export function readAffiliateProfileText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeAffiliateProfileCode(value: string) {
  return readAffiliateProfileText(value).replace(/\s+/g, "_").toUpperCase();
}

export function buildAffiliateProfileCode(value: string) {
  const base =
    readAffiliateProfileText(value)
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .toUpperCase()
      .slice(0, 24) || "PROFILE";

  return `${base}_${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export function normalizeNullableAffiliateProfileText(value: string | null | undefined) {
  const trimmed = readAffiliateProfileText(value);
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeAffiliateProfileRulesText(value: string | null | undefined) {
  return readAffiliateProfileText(value);
}

export function normalizeAffiliateProfileUuid(value: string | null | undefined, message = "Reference must be a valid row id.") {
  const trimmed = readAffiliateProfileText(value);

  if (!trimmed || !UUID_PATTERN.test(trimmed)) {
    throw new Error(message);
  }

  return trimmed;
}

export function normalizeNullableAffiliateProfileUuid(value: string | null | undefined, message = "Reference must be a valid row id.") {
  const trimmed = readAffiliateProfileText(value);

  if (!trimmed) {
    return null;
  }

  if (!UUID_PATTERN.test(trimmed)) {
    throw new Error(message);
  }

  return trimmed;
}

export function assertAffiliatePlatform(value: string): asserts value is AffiliatePlatform {
  if (!isAffiliatePlatform(value)) {
    throw new Error(`Invalid affiliate platform. Expected one of: ${AFFILIATE_PLATFORMS.join(", ")}.`);
  }
}

export function assertAffiliateProfileStatus(value: string): asserts value is AffiliateProfileStatus {
  if (!isAffiliateProfileStatus(value)) {
    throw new Error(`Invalid affiliate profile status. Expected one of: ${AFFILIATE_PROFILE_STATUSES.join(", ")}.`);
  }
}

export function validateAffiliateProfileInput(input: AffiliateProfileInput) {
  const profileName = readAffiliateProfileText(input.profile_name);
  const profileCode = input.profile_code ? normalizeAffiliateProfileCode(input.profile_code) : buildAffiliateProfileCode(profileName);
  const platform = input.platform || "TIKTOK";
  const status = input.status || "ACTIVE";

  if (!profileName) {
    throw new Error("Profile name is required.");
  }

  assertAffiliatePlatform(platform);
  assertAffiliateProfileStatus(status);

  return {
    profile_code: profileCode,
    profile_name: profileName,
    platform,
    account_label: normalizeNullableAffiliateProfileText(input.account_label),
    niche: normalizeNullableAffiliateProfileText(input.niche),
    affiliate_url: normalizeNullableAffiliateProfileText(input.affiliate_url),
    notes: normalizeNullableAffiliateProfileText(input.notes),
    i2i_prompt_rules: normalizeAffiliateProfileRulesText(input.i2i_prompt_rules),
    i2v_prompt_rules: normalizeAffiliateProfileRulesText(input.i2v_prompt_rules),
    caption_rules: normalizeAffiliateProfileRulesText(input.caption_rules),
    hashtag_rules: normalizeAffiliateProfileRulesText(input.hashtag_rules),
    negative_prompt_rules: normalizeAffiliateProfileRulesText(input.negative_prompt_rules),
    product_positioning_notes: normalizeAffiliateProfileRulesText(input.product_positioning_notes),
    lock_seed_character: input.lock_seed_character ?? true,
    seed_character_notes: normalizeAffiliateProfileRulesText(input.seed_character_notes),
    seed_character_drive_item_ref_id: normalizeNullableAffiliateProfileUuid(
      input.seed_character_drive_item_ref_id,
      "Seed character Drive reference must be a valid row id.",
    ),
    lock_environment: input.lock_environment ?? true,
    environment_notes: normalizeAffiliateProfileRulesText(input.environment_notes),
    environment_drive_item_ref_id: normalizeNullableAffiliateProfileUuid(
      input.environment_drive_item_ref_id,
      "Environment Drive reference must be a valid row id.",
    ),
    status,
  };
}
