"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAiMediaTask } from "@/lib/server/ai-media/tasks";
import { saveAiMediaTaskOutputToDrive } from "@/lib/server/ai-media/drive-output";
import { ensureGoogleDriveFolder } from "@/lib/server/google-drive";
import {
  createDriveItem,
  getDriveItemByDriveItemId,
  getDriveItemByDrivePath,
  updateDriveItem,
  uploadDriveItemFile,
} from "@/lib/server/drive-items";
import type {
  AiMediaDriveOutputProjection,
  AiMediaGenerationTaskProjection,
  ExternalGenerationToolType,
} from "@/lib/server/ai-media";

export type GenerateMediaActionResult =
  | { success: true; task: AiMediaGenerationTaskProjection }
  | { success: false; error: string };

function readNumber(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function readString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function readToolType(formData: FormData): ExternalGenerationToolType | null {
  const raw = formData.get("tool_type");
  if (raw === "MOTION_CONTROL" || raw === "IMAGE_TO_VIDEO" || raw === "UPSCALER") {
    return raw;
  }
  return null;
}

function pathForTool(toolType: ExternalGenerationToolType): string {
  if (toolType === "MOTION_CONTROL") return "/tools/ai-media/motion-control";
  if (toolType === "IMAGE_TO_VIDEO") return "/tools/ai-media/image-to-video";
  return "/tools/ai-media/upscaler";
}

export async function generateAiMediaTaskAction(
  formData: FormData,
): Promise<GenerateMediaActionResult> {
  const toolType = readToolType(formData);
  if (!toolType) {
    return { success: false, error: "Tool type tidak valid." };
  }

  // Build a sanitized input payload from form data.
  // Only safe primitives are allowed in input_json.
  const inputPayload: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (
      key === "tool_type" ||
      key === "source_image_drive_item_ref_id" ||
      key === "source_motion_drive_item_ref_id" ||
      key === "model_name" ||
      key === "selected_key_id" ||
      key === "priority"
    ) {
      continue;
    }
    if (typeof value === "string") {
      inputPayload[key] = value;
    }
  }

  const result = await createAiMediaTask({
    provider: "magnific",
    toolType,
    modelName: readString(formData.get("model_name")),
    selectedKeyId: readString(formData.get("selected_key_id")),
    sourceImageDriveItemRefId: readString(formData.get("source_image_drive_item_ref_id")),
    sourceMotionDriveItemRefId: readString(formData.get("source_motion_drive_item_ref_id")),
    inputPayload,
    priority: readNumber(formData.get("priority")) ?? 100,
  });

  if (result.success) {
    revalidatePath(pathForTool(toolType));
    revalidatePath("/tools/ai-media");
  }

  return result;
}

// =============================================================================
// Source File Upload — uploads user-selected image/video to Drive, returns ref ID
// =============================================================================

export type UploadSourceFileActionResult =
  | { success: true; driveItemRefId: string; name: string; mimeType: string | null }
  | { success: false; error: string };

const MAX_SOURCE_FILE_BYTES = 100 * 1024 * 1024; // 100 MB

const AI_MEDIA_SOURCE_FOLDER_SEGMENTS = ["AffiliateAI", "05_EXPORTS", "AI_MEDIA", "sources"] as const;

function joinDrivePath(...segments: Array<string | null | undefined>): string {
  return `/${segments
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean)
    .map((s) => s.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/")}`;
}

async function ensureAiMediaSourceFolder(): Promise<{ id: string; driveItemId: string; drivePath: string }> {
  const rootFolder = await ensureGoogleDriveFolder({ name: AI_MEDIA_SOURCE_FOLDER_SEGMENTS[0] });
  const exportsFolder = await ensureGoogleDriveFolder({
    name: AI_MEDIA_SOURCE_FOLDER_SEGMENTS[1],
    parentFolderId: rootFolder.id,
  });
  const aiMediaFolder = await ensureGoogleDriveFolder({
    name: AI_MEDIA_SOURCE_FOLDER_SEGMENTS[2],
    parentFolderId: exportsFolder.id,
  });
  const sourcesFolder = await ensureGoogleDriveFolder({
    name: AI_MEDIA_SOURCE_FOLDER_SEGMENTS[3],
    parentFolderId: aiMediaFolder.id,
  });

  const drivePath = joinDrivePath(...AI_MEDIA_SOURCE_FOLDER_SEGMENTS);
  const existing =
    (await getDriveItemByDriveItemId(sourcesFolder.id)) ??
    (await getDriveItemByDrivePath(drivePath));

  const payload = {
    item_type: "FOLDER" as const,
    drive_item_id: sourcesFolder.id,
    name: sourcesFolder.name,
    drive_url: sourcesFolder.webViewLink,
    drive_path: drivePath,
    purpose: "ADMIN_FOLDER" as const,
    status: "ACTIVE" as const,
    notes: "AI Media Lab source files.",
    parent_id: null,
    parent_drive_item_id: aiMediaFolder.id,
  };

  const record = existing
    ? await updateDriveItem(existing.id, payload)
    : await createDriveItem(payload);

  if (!record.drive_item_id) {
    throw new Error("Source folder Drive tidak siap.");
  }

  return { id: record.id, driveItemId: record.drive_item_id, drivePath: record.drive_path };
}

export async function uploadAiMediaSourceFileAction(
  formData: FormData,
): Promise<UploadSourceFileActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Autentikasi diperlukan." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) {
    return { success: false, error: "File tidak valid." };
  }

  if (file.size > MAX_SOURCE_FILE_BYTES) {
    return { success: false, error: "File terlalu besar (maks 100 MB)." };
  }

  const purpose = readString(formData.get("purpose")) ?? "SOURCE_IMAGE";
  if (purpose !== "SOURCE_IMAGE" && purpose !== "RAW_CLIP") {
    return { success: false, error: "Purpose tidak valid." };
  }

  try {
    const folder = await ensureAiMediaSourceFolder();
    const driveItem = await uploadDriveItemFile({
      file,
      parentId: folder.id,
      name: file.name,
      purpose,
      notes: "AI Media Lab source upload.",
    });

    revalidatePath("/drive");

    return {
      success: true,
      driveItemRefId: driveItem.id,
      name: driveItem.name,
      mimeType: driveItem.mime_type,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload gagal.";
    return { success: false, error: message };
  }
}

export type SaveMediaOutputActionResult =
  | { success: true; output: AiMediaDriveOutputProjection; alreadySaved: boolean }
  | { success: false; error: string };

export async function saveAiMediaOutputAction(
  taskId: string,
): Promise<SaveMediaOutputActionResult> {
  if (typeof taskId !== "string" || !taskId.trim()) {
    return { success: false, error: "Task tidak valid." };
  }

  const result = await saveAiMediaTaskOutputToDrive(taskId.trim());

  if (result.success) {
    revalidatePath("/tools/ai-media");
    revalidatePath("/tools/ai-media/motion-control");
    revalidatePath("/tools/ai-media/image-to-video");
    revalidatePath("/tools/ai-media/upscaler");
    revalidatePath("/tools/ai-media/history");
    revalidatePath("/drive");
  }

  return result;
}
