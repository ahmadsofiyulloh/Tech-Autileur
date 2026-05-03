"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  archiveAffiliateProfile,
  createAffiliateProfile,
  getAffiliateProfileById,
  updateAffiliateProfile,
} from "@/lib/server/affiliate-profiles";
import { buildAffiliateProfileCode } from "@/lib/affiliate-profiles/validation";
import { uploadAffiliateProfileAsset } from "@/lib/server/affiliate-profile-assets";
import {
  disableHelperApiToken as disableStoredHelperApiToken,
  upsertHelperApiToken,
} from "@/lib/server/helper-api-tokens";
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

function redirectWithMessage(path: string, key: "error" | "message", message: string): never {
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
  revalidatePath("/settings/flow");
}

function safeReturnPath(value: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
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
        drive_root_folder_ref_id: readText(formData, "drive_root_folder_ref_id"),
        drive_root_folder_url: readText(formData, "drive_root_folder_url"),
        drive_root_folder_path: readText(formData, "drive_root_folder_path"),
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
        drive_root_folder_ref_id: readText(formData, "drive_root_folder_ref_id"),
        drive_root_folder_url: readText(formData, "drive_root_folder_url"),
        drive_root_folder_path: readText(formData, "drive_root_folder_path"),
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
      message = "Drive folder created";
    } else if (intent === "archive_workspace") {
      if (!id) {
        throw new Error("Missing workspace id.");
      }

      await archiveWorkspace(id);
      message = "Workspace archived";
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

function affiliateProfileInputFromForm(formData: FormData, options?: { profileCode?: string }) {
  return {
    ...(options?.profileCode ? { profile_code: options.profileCode } : {}),
    profile_name: readText(formData, "profile_name"),
    platform: readText(formData, "platform"),
    account_label: readText(formData, "account_label"),
    niche: readText(formData, "niche"),
    affiliate_url: readText(formData, "affiliate_url"),
    i2i_prompt_rules: readText(formData, "i2i_prompt_rules"),
    i2v_prompt_rules: readText(formData, "i2v_prompt_rules"),
    caption_rules: readText(formData, "caption_rules"),
    hashtag_rules: readText(formData, "hashtag_rules"),
    negative_prompt_rules: readText(formData, "negative_prompt_rules"),
    lock_seed_character: readBoolean(formData, "lock_seed_character"),
    seed_character_drive_item_ref_id: readText(formData, "seed_character_drive_item_ref_id"),
    lock_environment: readBoolean(formData, "lock_environment"),
    environment_drive_item_ref_id: readText(formData, "environment_drive_item_ref_id"),
    status: readText(formData, "status"),
    workspace_ids: readTextList(formData, "workspace_ids"),
    default_workspace_id: readText(formData, "default_workspace_id") || null,
  };
}

function affiliateProfilePersonalizationInputFromForm(formData: FormData) {
  return {
    i2i_prompt_rules: readText(formData, "i2i_prompt_rules"),
    i2v_prompt_rules: readText(formData, "i2v_prompt_rules"),
    caption_rules: readText(formData, "caption_rules"),
    hashtag_rules: readText(formData, "hashtag_rules"),
    negative_prompt_rules: readText(formData, "negative_prompt_rules"),
    lock_seed_character: readBoolean(formData, "lock_seed_character"),
    seed_character_drive_item_ref_id: readText(formData, "seed_character_drive_item_ref_id"),
    lock_environment: readBoolean(formData, "lock_environment"),
    environment_drive_item_ref_id: readText(formData, "environment_drive_item_ref_id"),
  };
}

async function resolveAffiliateProfileAssetRef(input: {
  formData: FormData;
  profileCode: string;
  kind: "CHARACTER" | "ENVIRONMENT";
}) {
  const currentRefKey = input.kind === "CHARACTER" ? "current_seed_character_drive_item_ref_id" : "current_environment_drive_item_ref_id";
  const pickerRefKey = input.kind === "CHARACTER" ? "seed_character_drive_item_ref_id" : "environment_drive_item_ref_id";
  const clearKey = input.kind === "CHARACTER" ? "clear_seed_character_drive_item_ref_id" : "clear_environment_drive_item_ref_id";
  const fileKey = input.kind === "CHARACTER" ? "seed_character_file" : "environment_file";
  const file = readFile(input.formData, fileKey);
  const currentRef = readText(input.formData, currentRefKey);
  const pickerRef = readText(input.formData, pickerRefKey);

  if (file) {
    const asset = await uploadAffiliateProfileAsset({
      profileCode: input.profileCode,
      kind: input.kind,
      file,
    });

    return asset.id;
  }

  if (readBoolean(input.formData, clearKey)) {
    return null;
  }

  return pickerRef || currentRef || null;
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
      const seedCharacterDriveItemRefId = await resolveAffiliateProfileAssetRef({
        formData,
        profileCode,
        kind: "CHARACTER",
      });
      const environmentDriveItemRefId = await resolveAffiliateProfileAssetRef({
        formData,
        profileCode,
        kind: "ENVIRONMENT",
      });

      await createAffiliateProfile({
        ...baseInput,
        seed_character_drive_item_ref_id: seedCharacterDriveItemRefId,
        environment_drive_item_ref_id: environmentDriveItemRefId,
      });
      message = "Affiliate profile created";
    } else if (intent === "update_affiliate_profile") {
      if (!id) {
        throw new Error("Missing affiliate profile id.");
      }

      const existingProfile = await getAffiliateProfileById(id);
      const baseInput = affiliateProfileInputFromForm(formData);
      const seedCharacterDriveItemRefId = await resolveAffiliateProfileAssetRef({
        formData,
        profileCode: existingProfile.profile_code,
        kind: "CHARACTER",
      });
      const environmentDriveItemRefId = await resolveAffiliateProfileAssetRef({
        formData,
        profileCode: existingProfile.profile_code,
        kind: "ENVIRONMENT",
      });

      await updateAffiliateProfile(id, {
        ...baseInput,
        seed_character_drive_item_ref_id: seedCharacterDriveItemRefId,
        environment_drive_item_ref_id: environmentDriveItemRefId,
      });
      message = "Affiliate profile updated";
    } else if (intent === "update_affiliate_personalization") {
      if (!id) {
        throw new Error("Missing affiliate profile id.");
      }

      await updateAffiliateProfile(id, affiliateProfilePersonalizationInputFromForm(formData));
      message = "Prompt personalization updated";
    } else if (intent === "archive_affiliate_profile") {
      if (!id) {
        throw new Error("Missing affiliate profile id.");
      }

      await archiveAffiliateProfile(id);
      message = "Affiliate profile archived";
    } else {
      throw new Error("Unsupported affiliate profile action.");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Affiliate profile operation failed.";
    fail(errorMessage, returnTo);
  }

  revalidateSettingsSurface();
  done(message, returnTo);
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
      message = "App API Token disabled";
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
