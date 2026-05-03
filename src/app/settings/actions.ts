"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  archiveAffiliateProfile,
  createAffiliateProfile,
  updateAffiliateProfile,
} from "@/lib/server/affiliate-profiles";
import {
  disableHelperApiToken as disableStoredHelperApiToken,
  upsertHelperApiToken,
} from "@/lib/server/helper-api-tokens";
import {
  archiveFlowAccount,
  createFlowAccount,
} from "@/lib/server/flow-accounts";
import {
  archiveWorkspace,
  createWorkspace,
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

function readOptionalNumber(formData: FormData, key: string) {
  const value = readText(formData, key);

  if (!value) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${key} must be a non-negative number.`);
  }

  return parsed;
}

function fail(message: string): never {
  redirect(`/settings?error=${encodeURIComponent(message)}`);
}

function done(message: string): never {
  redirect(`/settings?message=${encodeURIComponent(message)}`);
}

function revalidateWorkspaceSurfaces() {
  revalidatePath("/settings");
  revalidatePath("/", "layout");
}

function revalidateSettingsSurface() {
  revalidatePath("/settings");
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
  let message = "Workspace saved";

  try {
    if (intent === "create_workspace") {
      await createWorkspace({
        workspace_code: readText(formData, "workspace_code"),
        workspace_name: readText(formData, "workspace_name"),
        niche: readText(formData, "niche"),
        drive_root_folder_ref_id: readText(formData, "drive_root_folder_ref_id"),
        drive_root_folder_url: readText(formData, "drive_root_folder_url"),
        drive_root_folder_path: readText(formData, "drive_root_folder_path"),
        is_default: readBoolean(formData, "is_default"),
        notes: readText(formData, "notes"),
      });
      message = "Workspace created";
    } else if (intent === "update_workspace") {
      if (!id) {
        throw new Error("Missing workspace id.");
      }

      await updateWorkspace(id, {
        workspace_code: readText(formData, "workspace_code"),
        workspace_name: readText(formData, "workspace_name"),
        niche: readText(formData, "niche"),
        drive_root_folder_ref_id: readText(formData, "drive_root_folder_ref_id"),
        drive_root_folder_url: readText(formData, "drive_root_folder_url"),
        drive_root_folder_path: readText(formData, "drive_root_folder_path"),
        status: readText(formData, "status"),
        is_default: readBoolean(formData, "is_default"),
        notes: readText(formData, "notes"),
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
    fail(errorMessage);
  }

  revalidateWorkspaceSurfaces();
  done(message);
}

function affiliateProfileInputFromForm(formData: FormData) {
  return {
    workspace_id: readText(formData, "workspace_id"),
    profile_code: readText(formData, "profile_code"),
    profile_name: readText(formData, "profile_name"),
    platform: readText(formData, "platform"),
    account_label: readText(formData, "account_label"),
    niche: readText(formData, "niche"),
    affiliate_url: readText(formData, "affiliate_url"),
    notes: readText(formData, "notes"),
    i2i_prompt_rules: readText(formData, "i2i_prompt_rules"),
    i2v_prompt_rules: readText(formData, "i2v_prompt_rules"),
    caption_rules: readText(formData, "caption_rules"),
    hashtag_rules: readText(formData, "hashtag_rules"),
    negative_prompt_rules: readText(formData, "negative_prompt_rules"),
    product_positioning_notes: readText(formData, "product_positioning_notes"),
    lock_seed_character: readBoolean(formData, "lock_seed_character"),
    seed_character_notes: readText(formData, "seed_character_notes"),
    seed_character_drive_item_ref_id: readText(formData, "seed_character_drive_item_ref_id"),
    lock_environment: readBoolean(formData, "lock_environment"),
    environment_notes: readText(formData, "environment_notes"),
    environment_drive_item_ref_id: readText(formData, "environment_drive_item_ref_id"),
    status: readText(formData, "status"),
  };
}

function affiliateProfilePersonalizationInputFromForm(formData: FormData) {
  return {
    i2i_prompt_rules: readText(formData, "i2i_prompt_rules"),
    i2v_prompt_rules: readText(formData, "i2v_prompt_rules"),
    caption_rules: readText(formData, "caption_rules"),
    hashtag_rules: readText(formData, "hashtag_rules"),
    negative_prompt_rules: readText(formData, "negative_prompt_rules"),
    product_positioning_notes: readText(formData, "product_positioning_notes"),
    lock_seed_character: readBoolean(formData, "lock_seed_character"),
    seed_character_notes: readText(formData, "seed_character_notes"),
    seed_character_drive_item_ref_id: readText(formData, "seed_character_drive_item_ref_id"),
    lock_environment: readBoolean(formData, "lock_environment"),
    environment_notes: readText(formData, "environment_notes"),
    environment_drive_item_ref_id: readText(formData, "environment_drive_item_ref_id"),
  };
}

export async function saveAffiliateProfile(formData: FormData) {
  const intent = readText(formData, "intent");
  const id = readText(formData, "id");
  let message = "Affiliate profile saved";

  try {
    if (intent === "create_affiliate_profile") {
      await createAffiliateProfile(affiliateProfileInputFromForm(formData));
      message = "Affiliate profile created";
    } else if (intent === "update_affiliate_profile") {
      if (!id) {
        throw new Error("Missing affiliate profile id.");
      }

      await updateAffiliateProfile(id, affiliateProfileInputFromForm(formData));
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
    fail(errorMessage);
  }

  revalidateSettingsSurface();
  done(message);
}

export async function saveFlowAccount(formData: FormData) {
  const intent = readText(formData, "intent");
  const id = readText(formData, "id");
  let message = "Flow account saved";

  try {
    if (intent === "create_flow_account") {
      await createFlowAccount({
        account_code: readText(formData, "account_code"),
        account_type: readText(formData, "account_type"),
        observed_daily_credit: readOptionalNumber(formData, "observed_daily_credit"),
        observed_monthly_credit: readOptionalNumber(formData, "observed_monthly_credit"),
        credit_per_generation: readOptionalNumber(formData, "credit_per_generation"),
        max_parallel_allowed: readOptionalNumber(formData, "max_parallel_allowed"),
        cooldown_minutes: readOptionalNumber(formData, "cooldown_minutes"),
        status: readText(formData, "status"),
        notes: readText(formData, "notes"),
      });
      message = "Flow account created";
    } else if (intent === "archive_flow_account") {
      if (!id) {
        throw new Error("Missing flow account id.");
      }

      await archiveFlowAccount(id);
      message = "Flow account archived";
    } else {
      throw new Error("Unsupported flow account action.");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Flow account operation failed.";
    fail(errorMessage);
  }

  revalidateSettingsSurface();
  done(message);
}

export async function saveHelperApiToken(formData: FormData) {
  const intent = readText(formData, "intent");
  const id = readText(formData, "id");
  const tokenCode = readText(formData, "token_code");
  const rawToken = readText(formData, "raw_token");
  let message = "App API Token saved";

  try {
    if (intent === "save_helper_api_token") {
      if (!rawToken) {
        throw new Error("Token value is required.");
      }

      await upsertHelperApiToken({
        tokenCode,
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
    fail(errorMessage);
  }

  revalidateSettingsSurface();
  done(message);
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
