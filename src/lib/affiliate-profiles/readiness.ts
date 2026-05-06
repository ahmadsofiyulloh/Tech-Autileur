import type { JsonObject } from "./validation";

export type AffiliateProfileAssetAnalysisState = "READY" | "PENDING" | "OPTIONAL";

export type AffiliateProfileAssetAnalysisInput = {
  locked?: boolean | null;
  driveItemRefId?: string | null;
  analysisJson?: JsonObject | null;
};

export type AffiliateProfilePromptReadinessInput = {
  status?: string | null;
  workspace_ids?: readonly string[] | null;
  i2i_prompt_rules?: string | null;
  i2v_prompt_rules?: string | null;
  caption_rules?: string | null;
  hashtag_rules?: string | null;
  negative_prompt_rules?: string | null;
  product_positioning_notes?: string | null;
  lock_seed_character?: boolean | null;
  seed_character_drive_item_ref_id?: string | null;
  seed_character_analysis_json?: JsonObject | null;
  lock_environment?: boolean | null;
  environment_drive_item_ref_id?: string | null;
  environment_analysis_json?: JsonObject | null;
};

function readText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function readJsonDriveItemRefId(value: JsonObject | null | undefined) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const refId = value.drive_item_ref_id;

  return typeof refId === "string" && refId.trim() ? refId.trim() : null;
}

export function splitAffiliateProfileRuleText(value: string | null | undefined) {
  return typeof value === "string"
    ? value
        .split(/\r?\n+/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
    : [];
}

export function hasAffiliateProfilePromptRules(profile: AffiliateProfilePromptReadinessInput | null | undefined) {
  if (!profile) {
    return false;
  }

  return [
    profile.i2i_prompt_rules,
    profile.i2v_prompt_rules,
    profile.caption_rules,
    profile.hashtag_rules,
    profile.negative_prompt_rules,
    profile.product_positioning_notes,
  ].every((value) => splitAffiliateProfileRuleText(value).length > 0);
}

export function isAffiliateProfileAssetAnalysisReady(input: AffiliateProfileAssetAnalysisInput) {
  if (!input.locked) {
    return true;
  }

  const driveItemRefId = readText(input.driveItemRefId);

  if (!driveItemRefId) {
    return false;
  }

  return readJsonDriveItemRefId(input.analysisJson) === driveItemRefId;
}

export function getAffiliateProfileAssetAnalysisState(input: AffiliateProfileAssetAnalysisInput): AffiliateProfileAssetAnalysisState {
  if (!input.locked) {
    return "OPTIONAL";
  }

  return isAffiliateProfileAssetAnalysisReady(input) ? "READY" : "PENDING";
}

export function isAffiliateProfilePromptReady(profile: AffiliateProfilePromptReadinessInput | null | undefined) {
  if (!profile || profile.status !== "ACTIVE") {
    return false;
  }

  if (!profile.workspace_ids?.length) {
    return false;
  }

  if (!hasAffiliateProfilePromptRules(profile)) {
    return false;
  }

  if (
    !isAffiliateProfileAssetAnalysisReady({
      locked: profile.lock_seed_character ?? false,
      driveItemRefId: profile.seed_character_drive_item_ref_id,
      analysisJson: profile.seed_character_analysis_json,
    })
  ) {
    return false;
  }

  if (
    !isAffiliateProfileAssetAnalysisReady({
      locked: profile.lock_environment ?? false,
      driveItemRefId: profile.environment_drive_item_ref_id,
      analysisJson: profile.environment_analysis_json,
    })
  ) {
    return false;
  }

  return true;
}
