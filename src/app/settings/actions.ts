"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  activateAffiliateProfileNamespace,
  archiveAffiliateProfile,
  createAffiliateProfile,
  getAffiliateProfileById,
  setDefaultAffiliateProfileForWorkspace,
  updateAffiliateProfile,
} from "@/lib/server/affiliate-profiles";
import { buildAffiliateProfileCode } from "@/lib/affiliate-profiles/validation";
import {
  AFFILIATE_PROFILE_ASSET_REANALYSIS_INITIAL_STATE,
  buildAffiliateProfileAssetReanalysisState,
  canonicalizeAffiliateProfileAssetAnalysisJson,
  formatAffiliateProfileAssetKind,
  type AffiliateProfileAssetKind,
  type AffiliateProfileAssetReanalysisResult,
  type AffiliateProfileAssetReanalysisState,
} from "@/lib/affiliate-profiles/asset-reanalysis";
import {
  getGeminiTemporaryUnavailableRetryMessage,
  isGeminiTemporaryUnavailableMessage,
} from "@/lib/gemini/error-message";
import {
  analyzeAffiliateProfileAsset,
} from "@/lib/server/affiliate-profile-asset-analysis";
import { uploadAffiliateProfileAsset } from "@/lib/server/affiliate-profile-assets";
import { isAffiliateProfileAssetAnalysisReady } from "@/lib/affiliate-profiles/readiness";
import {
  disableHelperApiToken as disableStoredHelperApiToken,
  upsertHelperApiToken,
} from "@/lib/server/helper-api-tokens";
import { disconnectGoogleDriveConnection } from "@/lib/server/google-drive-connections";
import {
  archiveWorkspace,
  createWorkspace,
  provisionWorkspaceDriveStructure,
  setCurrentWorkspace,
  setDefaultWorkspace,
  updateWorkspace,
} from "@/lib/server/workspaces";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function readFile(formData: FormData, key: string) {
  const value = formData.get(key);

  if (value instanceof File && value.size > 0) {
    return value;
  }

  return null;
}

function readTextList(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
}

function redirectWithMessage(path: string, key: "error" | "message" | "warning", message: string): never {
  const returnTo = safeReturnPath(path);
  const separator = returnTo.includes("?") ? "&" : "?";

  redirect(`${returnTo}${separator}${key}=${encodeURIComponent(message)}`);
}

function fail(message: string, path = "/settings"): never {
  redirectWithMessage(path, "error", message);
}

function done(message: string, path = "/settings"): never {
  redirectWithMessage(path, "message", message);
}

function revalidateWorkspaceSurfaces() {
  revalidatePath("/settings");
  revalidatePath("/settings/workspace");
  revalidatePath("/settings/affiliate-profiles");
  revalidatePath("/settings/drive");
  revalidatePath("/drive");
  revalidatePath("/products/new");
  revalidatePath("/", "layout");
}

function revalidateSettingsSurface() {
  revalidatePath("/settings");
  revalidatePath("/settings/workspace");
  revalidatePath("/settings/affiliate-profiles");
  revalidatePath("/settings/gemini");
  revalidatePath("/settings/drive");
  revalidatePath("/settings/account");
}

function revalidateAffiliateProfileSurfaces() {
  revalidateSettingsSurface();
  revalidatePath("/prompts");
  revalidatePath("/products/new");
  revalidatePath("/", "layout");
}

function safeReturnPath(value: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/products/new";
  }

  return value;
}

export async function saveWorkspace(formData: FormData) {
  const intent = readText(formData, "intent");
  const id = readText(formData, "id");
  const returnTo = safeReturnPath(readText(formData, "return_to") || "/settings/workspace");
  let message = "Workspace saved";

  try {
    if (intent === "create_workspace") {
      await createWorkspace({
        workspace_name: readText(formData, "workspace_name"),
        niche: readText(formData, "niche"),
        is_default: readBoolean(formData, "is_default"),
      });
      message = "Workspace created";
    } else if (intent === "update_workspace") {
      if (!id) {
        throw new Error("Missing workspace id.");
      }

      await updateWorkspace(id, {
        workspace_name: readText(formData, "workspace_name"),
        niche: readText(formData, "niche"),
        status: readText(formData, "status"),
        is_default: readBoolean(formData, "is_default"),
      });
      message = "Workspace updated";
    } else if (intent === "set_current_workspace") {
      await setCurrentWorkspace(readText(formData, "current_workspace_id") || null);
      message = "Current workspace updated";
    } else if (intent === "set_default_workspace") {
      if (!id) {
        throw new Error("Missing workspace id.");
      }

      await setDefaultWorkspace(id);
      message = "Default workspace updated";
    } else if (intent === "provision_workspace_drive") {
      if (!id) {
        throw new Error("Missing workspace id.");
      }

      await provisionWorkspaceDriveStructure(id);
      message = "Folder Drive disinkronkan";
    } else if (intent === "archive_workspace") {
      if (!id) {
        throw new Error("Missing workspace id.");
      }

      await archiveWorkspace(id);
      message = "Data dihapus.";
    } else {
      throw new Error("Unsupported workspace action.");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Workspace operation failed.";
    fail(errorMessage, returnTo);
  }

  revalidateWorkspaceSurfaces();
  done(message, returnTo);
}

function affiliateProfileInputFromForm(formData: FormData, options?: { profileCode?: string; preserveRemovedFields?: boolean }) {
  const accountLabel = options?.preserveRemovedFields
    ? readText(formData, "account_label") || readText(formData, "current_account_label")
    : readText(formData, "account_label");
  const affiliateUrl = options?.preserveRemovedFields
    ? readText(formData, "affiliate_url") || readText(formData, "current_affiliate_url")
    : readText(formData, "affiliate_url");

  return {
    ...(options?.profileCode ? { profile_code: options.profileCode } : {}),
    profile_name: readText(formData, "profile_name"),
    platform: readText(formData, "platform"),
    account_label: accountLabel,
    niche: readText(formData, "niche"),
    affiliate_url: affiliateUrl,
    i2i_prompt_rules: readText(formData, "i2i_prompt_rules"),
    i2v_prompt_rules: readText(formData, "i2v_prompt_rules"),
    caption_rules: readText(formData, "caption_rules"),
    hashtag_rules: readText(formData, "hashtag_rules"),
    negative_prompt_rules: readText(formData, "negative_prompt_rules"),
    product_positioning_notes: readText(formData, "product_positioning_notes"),
    lock_seed_character: readBoolean(formData, "lock_seed_character"),
    seed_character_drive_item_ref_id: readText(formData, "seed_character_drive_item_ref_id"),
    lock_environment: readBoolean(formData, "lock_environment"),
    environment_drive_item_ref_id: readText(formData, "environment_drive_item_ref_id"),
    status: readText(formData, "status"),
    workspace_ids: readTextList(formData, "workspace_ids"),
    default_workspace_id: readText(formData, "default_workspace_id") || null,
  };
}

async function resolveAffiliateProfileNamespace(input: {
  profileName: string;
  niche?: string | null;
  workspaceIds: string[];
  defaultWorkspaceId: string | null;
  existingWorkspaceIds?: string[];
  existingDefaultWorkspaceId?: string | null;
}) {
  const existingWorkspaceId = input.existingDefaultWorkspaceId ?? input.existingWorkspaceIds?.[0] ?? null;
  const namespaceWorkspaceId = input.defaultWorkspaceId ?? input.workspaceIds[0] ?? existingWorkspaceId;

  if (namespaceWorkspaceId) {
    return {
      workspace_ids: [namespaceWorkspaceId],
      default_workspace_id: namespaceWorkspaceId,
    };
  }

  const workspace = await createWorkspace({
    workspace_name: input.profileName,
    niche: input.niche,
    is_default: false,
  });

  return {
    workspace_ids: [workspace.id],
    default_workspace_id: workspace.id,
  };
}

function affiliateProfilePersonalizationInputFromForm(
  formData: FormData,
  existingProfile?: {
    seed_character_drive_item_ref_id?: string | null;
    environment_drive_item_ref_id?: string | null;
  } | null,
) {
  const seedCharacterAsset = readAffiliateProfileAssetFormState(
    formData,
    "CHARACTER",
    existingProfile?.seed_character_drive_item_ref_id,
  );
  const environmentAsset = readAffiliateProfileAssetFormState(
    formData,
    "ENVIRONMENT",
    existingProfile?.environment_drive_item_ref_id,
  );

  return {
    i2i_prompt_rules: readText(formData, "i2i_prompt_rules"),
    i2v_prompt_rules: readText(formData, "i2v_prompt_rules"),
    caption_rules: readText(formData, "caption_rules"),
    hashtag_rules: readText(formData, "hashtag_rules"),
    negative_prompt_rules: readText(formData, "negative_prompt_rules"),
    product_positioning_notes: readText(formData, "product_positioning_notes"),
    lock_seed_character: readBoolean(formData, "lock_seed_character"),
    seed_character_drive_item_ref_id: seedCharacterAsset.driveItemRefId,
    lock_environment: readBoolean(formData, "lock_environment"),
    environment_drive_item_ref_id: environmentAsset.driveItemRefId,
  };
}

type AffiliateProfileAssetFormState = {
  locked: boolean;
  driveItemRefId: string | null;
  file: File | null;
  clearRequested: boolean;
};

function readAffiliateProfileAssetFormState(
  formData: FormData,
  kind: AffiliateProfileAssetKind,
  existingDriveItemRefId?: string | null,
): AffiliateProfileAssetFormState {
  const currentRefKey = kind === "CHARACTER" ? "current_seed_character_drive_item_ref_id" : "current_environment_drive_item_ref_id";
  const pickerRefKey = kind === "CHARACTER" ? "seed_character_drive_item_ref_id" : "environment_drive_item_ref_id";
  const clearKey = kind === "CHARACTER" ? "clear_seed_character_drive_item_ref_id" : "clear_environment_drive_item_ref_id";
  const fileKey = kind === "CHARACTER" ? "seed_character_file" : "environment_file";
  const lockKey = kind === "CHARACTER" ? "lock_seed_character" : "lock_environment";
  const clearRequested = readBoolean(formData, clearKey);
  const currentRef = readText(formData, currentRefKey);
  const pickerRef = readText(formData, pickerRefKey);

  return {
    locked: readBoolean(formData, lockKey),
    driveItemRefId: clearRequested ? null : pickerRef || currentRef || existingDriveItemRefId || null,
    file: readFile(formData, fileKey),
    clearRequested,
  };
}

function assertNoDirectAffiliateProfileAssetSave(input: {
  seedCharacterAsset: AffiliateProfileAssetFormState;
  environmentAsset: AffiliateProfileAssetFormState;
}) {
  if (input.seedCharacterAsset.file || input.environmentAsset.file) {
    throw new Error("Analisis aset dulu sebelum menyimpan profile.");
  }
}

function assertAffiliateProfileAssetAnalysisCanBeSaved(input: {
  kind: AffiliateProfileAssetKind;
  locked: boolean;
  driveItemRefId: string | null;
  analysisJson: Parameters<typeof isAffiliateProfileAssetAnalysisReady>[0]["analysisJson"];
}) {
  if (
    input.locked &&
    input.driveItemRefId &&
    !isAffiliateProfileAssetAnalysisReady({
      locked: input.locked,
      driveItemRefId: input.driveItemRefId,
      analysisJson: input.analysisJson,
    })
  ) {
    throw new Error(`Analisis ulang ${formatAffiliateProfileAssetKind(input.kind)} dulu sebelum menyimpan profile.`);
  }
}

function readAffiliateProfileAssetDraft(
  formData: FormData,
  existingProfile?: {
    seed_character_drive_item_ref_id?: string | null;
    environment_drive_item_ref_id?: string | null;
  } | null,
) {
  const seedCharacterAsset = readAffiliateProfileAssetFormState(
    formData,
    "CHARACTER",
    existingProfile?.seed_character_drive_item_ref_id,
  );
  const environmentAsset = readAffiliateProfileAssetFormState(
    formData,
    "ENVIRONMENT",
    existingProfile?.environment_drive_item_ref_id,
  );

  return {
    lock_seed_character: seedCharacterAsset.locked,
    seed_character_drive_item_ref_id: seedCharacterAsset.driveItemRefId,
    seed_character_file: seedCharacterAsset.file,
    clear_seed_character_drive_item_ref_id: seedCharacterAsset.clearRequested,
    lock_environment: environmentAsset.locked,
    environment_drive_item_ref_id: environmentAsset.driveItemRefId,
    environment_file: environmentAsset.file,
    clear_environment_drive_item_ref_id: environmentAsset.clearRequested,
  };
}

export async function saveAffiliateProfile(formData: FormData) {
  const intent = readText(formData, "intent");
  const id = readText(formData, "id");
  const returnTo = safeReturnPath(readText(formData, "return_to") || "/settings/affiliate-profiles");
  let message = "Affiliate profile saved";

  try {
    if (intent === "create_affiliate_profile") {
      const profileCode = buildAffiliateProfileCode(readText(formData, "profile_name"));
      const baseInput = affiliateProfileInputFromForm(formData, { profileCode });
      const seedCharacterAsset = readAffiliateProfileAssetFormState(formData, "CHARACTER");
      const environmentAsset = readAffiliateProfileAssetFormState(formData, "ENVIRONMENT");
      assertNoDirectAffiliateProfileAssetSave({ seedCharacterAsset, environmentAsset });
      const namespaceInput = await resolveAffiliateProfileNamespace({
        profileName: baseInput.profile_name,
        niche: baseInput.niche,
        workspaceIds: baseInput.workspace_ids,
        defaultWorkspaceId: baseInput.default_workspace_id,
      });

      assertAffiliateProfileAssetAnalysisCanBeSaved({
        kind: "CHARACTER",
        locked: seedCharacterAsset.locked,
        driveItemRefId: seedCharacterAsset.driveItemRefId,
        analysisJson: null,
      });
      assertAffiliateProfileAssetAnalysisCanBeSaved({
        kind: "ENVIRONMENT",
        locked: environmentAsset.locked,
        driveItemRefId: environmentAsset.driveItemRefId,
        analysisJson: null,
      });

      await createAffiliateProfile({
        ...baseInput,
        ...namespaceInput,
        seed_character_drive_item_ref_id: seedCharacterAsset.driveItemRefId,
        environment_drive_item_ref_id: environmentAsset.driveItemRefId,
      });
      message = "Affiliate profile created";
    } else if (intent === "update_affiliate_profile") {
      if (!id) {
        throw new Error("Missing affiliate profile id.");
      }

      const existingProfile = await getAffiliateProfileById(id);
      const baseInput = affiliateProfileInputFromForm(formData, { preserveRemovedFields: true });
      const namespaceInput = await resolveAffiliateProfileNamespace({
        profileName: baseInput.profile_name,
        niche: baseInput.niche,
        workspaceIds: baseInput.workspace_ids,
        defaultWorkspaceId: baseInput.default_workspace_id,
        existingWorkspaceIds: existingProfile.workspace_ids,
        existingDefaultWorkspaceId: existingProfile.default_workspace_id,
      });
      const seedCharacterAsset = readAffiliateProfileAssetFormState(
        formData,
        "CHARACTER",
        existingProfile.seed_character_drive_item_ref_id,
      );
      const environmentAsset = readAffiliateProfileAssetFormState(
        formData,
        "ENVIRONMENT",
        existingProfile.environment_drive_item_ref_id,
      );
      assertNoDirectAffiliateProfileAssetSave({ seedCharacterAsset, environmentAsset });
      assertAffiliateProfileAssetAnalysisCanBeSaved({
        kind: "CHARACTER",
        locked: seedCharacterAsset.locked,
        driveItemRefId: seedCharacterAsset.driveItemRefId,
        analysisJson: existingProfile.seed_character_analysis_json,
      });
      assertAffiliateProfileAssetAnalysisCanBeSaved({
        kind: "ENVIRONMENT",
        locked: environmentAsset.locked,
        driveItemRefId: environmentAsset.driveItemRefId,
        analysisJson: existingProfile.environment_analysis_json,
      });

      await updateAffiliateProfile(id, {
        ...baseInput,
        ...namespaceInput,
        seed_character_drive_item_ref_id: seedCharacterAsset.driveItemRefId,
        seed_character_analysis_json: seedCharacterAsset.driveItemRefId ? existingProfile.seed_character_analysis_json : null,
        environment_drive_item_ref_id: environmentAsset.driveItemRefId,
        environment_analysis_json: environmentAsset.driveItemRefId ? existingProfile.environment_analysis_json : null,
      });
      message = "Affiliate profile updated";
    } else if (intent === "update_affiliate_personalization") {
      if (!id) {
        throw new Error("Missing affiliate profile id.");
      }

      const existingProfile = await getAffiliateProfileById(id);
      const seedCharacterAsset = readAffiliateProfileAssetFormState(
        formData,
        "CHARACTER",
        existingProfile.seed_character_drive_item_ref_id,
      );
      const environmentAsset = readAffiliateProfileAssetFormState(
        formData,
        "ENVIRONMENT",
        existingProfile.environment_drive_item_ref_id,
      );
      assertNoDirectAffiliateProfileAssetSave({ seedCharacterAsset, environmentAsset });
      assertAffiliateProfileAssetAnalysisCanBeSaved({
        kind: "CHARACTER",
        locked: seedCharacterAsset.locked,
        driveItemRefId: seedCharacterAsset.driveItemRefId,
        analysisJson: existingProfile.seed_character_analysis_json,
      });
      assertAffiliateProfileAssetAnalysisCanBeSaved({
        kind: "ENVIRONMENT",
        locked: environmentAsset.locked,
        driveItemRefId: environmentAsset.driveItemRefId,
        analysisJson: existingProfile.environment_analysis_json,
      });

      await updateAffiliateProfile(id, affiliateProfilePersonalizationInputFromForm(formData, existingProfile));
      message = "Prompt personalization updated";
    } else if (intent === "archive_affiliate_profile") {
      if (!id) {
        throw new Error("Missing affiliate profile id.");
      }

      await archiveAffiliateProfile(id);
      message = "Data dihapus.";
    } else {
      throw new Error("Unsupported affiliate profile action.");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Affiliate profile operation failed.";
    fail(errorMessage, returnTo);
  }

  revalidateAffiliateProfileSurfaces();
  done(message, returnTo);
}

async function analyzeAffiliateProfileAssetWithState(input: {
  profileCode: string;
  kind: AffiliateProfileAssetKind;
  locked: boolean;
  driveItemRefId: string | null;
  file: File | null;
  profileId: string;
  results: AffiliateProfileAssetReanalysisResult[];
}) {
  const label = formatAffiliateProfileAssetKind(input.kind);
  let driveItemRefId = input.driveItemRefId;

  if (!input.locked) {
    input.results.push({
      kind: input.kind,
      status: "skipped",
      message: "Lock nonaktif; dilewati.",
      driveItemRefId,
      analysisStored: false,
    });
    return;
  }

  try {
    if (input.file) {
      const asset = await uploadAffiliateProfileAsset({
        profileCode: input.profileCode,
        kind: input.kind,
        file: input.file,
      });

      driveItemRefId = asset.id;
    }

    if (!driveItemRefId) {
      input.results.push({
        kind: input.kind,
        status: "warning",
        message: `Referensi ${label} belum dipilih.`,
        driveItemRefId: null,
        analysisStored: false,
      });
      return;
    }

    const analysisJson = await analyzeAffiliateProfileAsset({
      profileCode: input.profileCode,
      kind: input.kind,
      driveItemId: driveItemRefId,
    });

    const normalizedAnalysisJson = canonicalizeAffiliateProfileAssetAnalysisJson(analysisJson, driveItemRefId);

    if (!normalizedAnalysisJson) {
      throw new Error(`${label} analysis failed.`);
    }

    await updateAffiliateProfile(input.profileId, {
      ...(input.kind === "CHARACTER"
        ? {
            seed_character_drive_item_ref_id: driveItemRefId,
            seed_character_analysis_json: normalizedAnalysisJson,
          }
        : {
            environment_drive_item_ref_id: driveItemRefId,
            environment_analysis_json: normalizedAnalysisJson,
          }),
    });

    input.results.push({
      kind: input.kind,
      status: "success",
      message: `JSON disimpan dengan ref aktif.`,
      driveItemRefId,
      analysisStored: true,
    });
  } catch (error) {
    if (error instanceof Error && isGeminiTemporaryUnavailableMessage(error.message)) {
      input.results.push({
        kind: input.kind,
        status: "warning",
        message: getGeminiTemporaryUnavailableRetryMessage(),
        driveItemRefId,
        analysisStored: false,
      });
      return;
    }

    const errorMessage = error instanceof Error ? error.message : `${label} analysis failed.`;
    input.results.push({
      kind: input.kind,
      status: "error",
      message: errorMessage,
      driveItemRefId,
      analysisStored: false,
    });
  }
}

export async function reanalyzeAffiliateProfileAssets(
  _previousState: AffiliateProfileAssetReanalysisState,
  formData: FormData,
): Promise<AffiliateProfileAssetReanalysisState> {
  const id = readText(formData, "id");

  if (!id) {
    return {
      ...AFFILIATE_PROFILE_ASSET_REANALYSIS_INITIAL_STATE,
      status: "error",
      title: "Analisis aset gagal",
      message: "Missing affiliate profile id.",
    };
  }

  try {
    const profile = await getAffiliateProfileById(id);
    const draft = readAffiliateProfileAssetDraft(formData, profile);

    await updateAffiliateProfile(id, {
      lock_seed_character: draft.lock_seed_character,
      ...(draft.clear_seed_character_drive_item_ref_id
        ? {
            seed_character_drive_item_ref_id: null,
            seed_character_analysis_json: null,
          }
        : {}),
      lock_environment: draft.lock_environment,
      ...(draft.clear_environment_drive_item_ref_id
        ? {
            environment_drive_item_ref_id: null,
            environment_analysis_json: null,
          }
        : {}),
    });

    const results: AffiliateProfileAssetReanalysisResult[] = [];

    await analyzeAffiliateProfileAssetWithState({
      profileCode: profile.profile_code,
      kind: "CHARACTER",
      locked: draft.lock_seed_character,
      driveItemRefId: draft.seed_character_drive_item_ref_id,
      file: draft.clear_seed_character_drive_item_ref_id ? null : draft.seed_character_file,
      profileId: id,
      results,
    });

    await analyzeAffiliateProfileAssetWithState({
      profileCode: profile.profile_code,
      kind: "ENVIRONMENT",
      locked: draft.lock_environment,
      driveItemRefId: draft.environment_drive_item_ref_id,
      file: draft.clear_environment_drive_item_ref_id ? null : draft.environment_file,
      profileId: id,
      results,
    });

    revalidateAffiliateProfileSurfaces();
    return buildAffiliateProfileAssetReanalysisState(results);
  } catch (error) {
    if (error instanceof Error && isGeminiTemporaryUnavailableMessage(error.message)) {
      return {
        ...AFFILIATE_PROFILE_ASSET_REANALYSIS_INITIAL_STATE,
        status: "warning",
        title: "Analisis aset ditunda",
        message: getGeminiTemporaryUnavailableRetryMessage(),
      };
    }

    const errorMessage = error instanceof Error ? error.message : "Affiliate profile analysis failed.";
    return {
      ...AFFILIATE_PROFILE_ASSET_REANALYSIS_INITIAL_STATE,
      status: "error",
      title: "Analisis aset gagal",
      message: errorMessage,
    };
  }
}

export async function reanalyzeAffiliateProfileAsset(formData: FormData) {
  return await reanalyzeAffiliateProfileAssets(AFFILIATE_PROFILE_ASSET_REANALYSIS_INITIAL_STATE, formData);
}

export async function setDefaultAffiliateProfile(formData: FormData) {
  const profileId = readText(formData, "affiliate_profile_id");
  const workspaceId = readText(formData, "workspace_id");
  const returnTo = safeReturnPath(readText(formData, "return_to") || "/settings");

  try {
    if (!profileId) {
      throw new Error("Missing affiliate profile id.");
    }

    if (!workspaceId) {
      throw new Error("Missing workspace id.");
    }

    await setDefaultAffiliateProfileForWorkspace(profileId, workspaceId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Affiliate profile operation failed.";
    fail(errorMessage, returnTo);
  }

  done("Default affiliate profile updated", returnTo);
}

export async function activateAffiliateProfile(formData: FormData) {
  const profileId = readText(formData, "affiliate_profile_id");
  const returnTo = safeReturnPath(readText(formData, "return_to") || "/settings");

  try {
    if (!profileId) {
      throw new Error("Missing affiliate profile id.");
    }

    await activateAffiliateProfileNamespace(profileId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Affiliate profile operation failed.";
    fail(errorMessage, returnTo);
  }

  revalidateAffiliateProfileSurfaces();
  done("Akun Affiliate aktif diperbarui", returnTo);
}

export async function saveHelperApiToken(formData: FormData) {
  const intent = readText(formData, "intent");
  const id = readText(formData, "id");
  const rawToken = readText(formData, "raw_token");
  const returnTo = safeReturnPath(readText(formData, "return_to") || "/settings/account");
  let message = "App API Token saved";

  try {
    if (intent === "save_helper_api_token") {
      if (!rawToken) {
        throw new Error("Token value is required.");
      }

      await upsertHelperApiToken({
        rawToken,
      });
      message = "App API Token saved";
    } else if (intent === "disable_helper_api_token") {
      if (!id) {
        throw new Error("Missing helper token id.");
      }

      await disableStoredHelperApiToken(id);
      message = "Token dicabut.";
    } else {
      throw new Error("Unsupported helper token action.");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Helper token operation failed.";
    fail(errorMessage, returnTo);
  }

  revalidateSettingsSurface();
  done(message, returnTo);
}

export async function disconnectGoogleDrive(formData: FormData) {
  const returnTo = safeReturnPath(readText(formData, "return_to") || "/settings");

  try {
    await disconnectGoogleDriveConnection();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Drive disconnect failed.";
    fail(errorMessage, returnTo);
  }

  revalidateSettingsSurface();
  done("Google Drive diputuskan.", returnTo);
}

export async function setCurrentWorkspaceFromShell(formData: FormData) {
  const workspaceId = readText(formData, "current_workspace_id") || null;
  const returnTo = safeReturnPath(readText(formData, "return_to"));

  try {
    await setCurrentWorkspace(workspaceId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Workspace operation failed.";
    redirect(`/settings?error=${encodeURIComponent(errorMessage)}`);
  }

  revalidateWorkspaceSurfaces();
  redirect(returnTo);
}
