"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
