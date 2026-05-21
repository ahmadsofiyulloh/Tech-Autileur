import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ensureGoogleDriveFolder,
  tryGetGoogleDriveImageDataUrl,
} from "@/lib/server/google-drive";
import {
  createDriveItem,
  getDriveItemById,
  getDriveItemByDriveItemId,
  getDriveItemByDrivePath,
  updateDriveItem,
  writeGeneratedDriveFile,
  type DriveItemRecord,
} from "@/lib/server/drive-items";
import type {
  AiMediaDriveOutputProjection,
  ExternalGenerationTaskRow,
  ExternalGenerationToolType,
} from "./contracts";

// =============================================================================
// AI Media Lab Drive Output Wiring
// Server-only helper that exports a successful generation task output to Drive.
// Bytes are uploaded to Google Drive only; Supabase stores Drive metadata refs.
// =============================================================================

const AI_MEDIA_EXPORT_BRANCH_SEGMENTS = ["AffiliateAI", "05_EXPORTS", "AI_MEDIA"] as const;
const MAX_OUTPUT_BYTES = 200 * 1024 * 1024; // 200 MB safety guard for in-memory upload buffer
const PROVIDER_FETCH_TIMEOUT_MS = 60_000;

const TOOL_LABEL_SEGMENT: Record<ExternalGenerationToolType, string> = {
  MOTION_CONTROL: "motion-control",
  IMAGE_TO_VIDEO: "image-to-video",
  UPSCALER: "upscaler",
};

const ASSET_URL_KEYS = [
  "output_url",
  "download_url",
  "file_url",
  "video_url",
  "image_url",
  "result_url",
  "asset_url",
  "url",
  "src",
  "href",
] as const;

const BASE64_KEYS = ["base64", "data_base64", "image_base64", "video_base64"] as const;

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

const VIDEO_MIME_BY_EXT: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  m4v: "video/x-m4v",
};

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-m4v": "m4v",
  "application/octet-stream": "bin",
};

// =============================================================================
// Types
// =============================================================================

export type SaveAiMediaOutputResult =
  | { success: true; output: AiMediaDriveOutputProjection; alreadySaved: boolean }
  | { success: false; error: string };

type ExtractedAsset =
  | { kind: "url"; url: string; mimeHint: string | null }
  | { kind: "data-url"; mimeType: string; bytes: Buffer }
  | { kind: "base64"; mimeType: string; bytes: Buffer };

// =============================================================================
// Helpers
// =============================================================================

function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function joinDrivePath(...segments: Array<string | null | undefined>): string {
  return `/${segments
    .map((segment) => readText(segment))
    .filter(Boolean)
    .map((segment) => segment.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/")}`;
}

function safeFilenameSegment(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || "ai-media";
}

function extFromMime(mimeType: string | null): string {
  const key = (mimeType ?? "").toLowerCase();
  return EXT_BY_MIME[key] ?? "bin";
}

function mimeFromExt(ext: string): string | null {
  const lower = ext.toLowerCase();
  return IMAGE_MIME_BY_EXT[lower] ?? VIDEO_MIME_BY_EXT[lower] ?? null;
}

function extFromUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    const path = url.pathname;
    const match = path.match(/\.([A-Za-z0-9]{1,8})(?:$|\?|#)/);
    return match?.[1]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function isDataUrl(value: string): boolean {
  return /^data:[^;,]+;base64,/i.test(value);
}

function decodeDataUrl(value: string): { mimeType: string; bytes: Buffer } | null {
  const match = value.match(/^data:([^;,]+);base64,(.*)$/i);
  if (!match) return null;
  const mimeType = match[1].trim().toLowerCase() || "application/octet-stream";
  try {
    const bytes = Buffer.from(match[2], "base64");
    if (!bytes.length) return null;
    return { mimeType, bytes };
  } catch {
    return null;
  }
}

function decodeBase64String(value: string, mimeHint: string | null): { mimeType: string; bytes: Buffer } | null {
  if (!/^[A-Za-z0-9+/=\s]+$/.test(value) || value.length < 32) return null;
  try {
    const bytes = Buffer.from(value.replace(/\s+/g, ""), "base64");
    if (!bytes.length) return null;
    return {
      mimeType: (mimeHint ?? "application/octet-stream").toLowerCase(),
      bytes,
    };
  } catch {
    return null;
  }
}

function findFirstString(record: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const raw = record[key];
    const text = readText(raw);
    if (text) return text;
  }
  return null;
}

function findFirstAssetCandidate(record: Record<string, unknown>): unknown {
  if (Array.isArray(record.assets) && record.assets.length) return record.assets[0];
  if (Array.isArray(record.files) && record.files.length) return record.files[0];
  if (Array.isArray(record.outputs) && record.outputs.length) return record.outputs[0];
  return null;
}

/**
 * Extract a usable asset reference from a provider output payload.
 * Conservative: prefers explicit URL fields, falls back to data URLs / base64
 * only if no URL is present. Returns null if nothing retrievable is found.
 */
function extractAssetFromOutput(output: unknown): ExtractedAsset | null {
  if (!isRecord(output)) return null;

  // 1. Try the `output` sub-record first if present (common with Magnific-style envelopes).
  const nested = isRecord(output.output) ? output.output : null;

  for (const candidate of [output, nested].filter(Boolean) as Array<Record<string, unknown>>) {
    const url = findFirstString(candidate, ASSET_URL_KEYS);
    if (url) {
      if (isHttpUrl(url)) {
        const mimeHint = readText(candidate.mime_type) || readText(candidate.mimeType) || null;
        return { kind: "url", url, mimeHint };
      }
      if (isDataUrl(url)) {
        const decoded = decodeDataUrl(url);
        if (decoded) return { kind: "data-url", ...decoded };
      }
    }

    const assetCandidate = findFirstAssetCandidate(candidate);
    if (typeof assetCandidate === "string") {
      if (isHttpUrl(assetCandidate)) {
        return { kind: "url", url: assetCandidate, mimeHint: null };
      }
      if (isDataUrl(assetCandidate)) {
        const decoded = decodeDataUrl(assetCandidate);
        if (decoded) return { kind: "data-url", ...decoded };
      }
    } else if (isRecord(assetCandidate)) {
      const nestedUrl = findFirstString(assetCandidate, ASSET_URL_KEYS);
      if (nestedUrl && isHttpUrl(nestedUrl)) {
        const mimeHint =
          readText(assetCandidate.mime_type) || readText(assetCandidate.mimeType) || null;
        return { kind: "url", url: nestedUrl, mimeHint };
      }
      if (nestedUrl && isDataUrl(nestedUrl)) {
        const decoded = decodeDataUrl(nestedUrl);
        if (decoded) return { kind: "data-url", ...decoded };
      }
    }

    // 2. Base64 fallback only if no URL was usable.
    const mimeHint = readText(candidate.mime_type) || readText(candidate.mimeType) || null;
    for (const key of BASE64_KEYS) {
      const raw = readText(candidate[key]);
      if (!raw) continue;
      const decoded = decodeBase64String(raw, mimeHint);
      if (decoded) return { kind: "base64", ...decoded };
    }
  }

  return null;
}

async function fetchProviderAssetBytes(
  url: string,
  mimeHint: string | null,
): Promise<{ mimeType: string; bytes: Buffer }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Provider asset download gagal (${response.status}).`);
    }
    const headerMime = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? null;
    const arrayBuffer = await response.arrayBuffer();
    const bytes = Buffer.from(arrayBuffer);

    if (!bytes.length) {
      throw new Error("Provider asset kosong.");
    }
    if (bytes.length > MAX_OUTPUT_BYTES) {
      throw new Error("Output terlalu besar untuk disimpan otomatis.");
    }

    const ext = extFromUrl(url);
    const mimeType = headerMime || mimeHint || (ext ? mimeFromExt(ext) : null) || "application/octet-stream";
    return { mimeType, bytes };
  } finally {
    clearTimeout(timer);
  }
}

// =============================================================================
// Drive folder provisioning
// =============================================================================

type DriveFolderHandle = Pick<DriveItemRecord, "id" | "drive_item_id" | "drive_path" | "name">;

async function ensureExportFolderRecord(input: {
  name: string;
  drivePath: string;
  parentFolderId: string | null;
  parentRecord: DriveFolderHandle | null;
  notes: string;
}): Promise<DriveFolderHandle> {
  const driveFolder = await ensureGoogleDriveFolder({
    name: input.name,
    parentFolderId: input.parentFolderId,
  });
  const existing =
    (await getDriveItemByDriveItemId(driveFolder.id)) ??
    (await getDriveItemByDrivePath(input.drivePath));

  const payload = {
    item_type: "FOLDER" as const,
    drive_item_id: driveFolder.id,
    name: driveFolder.name,
    drive_url: driveFolder.webViewLink,
    drive_path: input.drivePath,
    purpose: "ADMIN_FOLDER" as const,
    status: "ACTIVE" as const,
    notes: input.notes,
    parent_id: input.parentRecord?.id ?? null,
    parent_drive_item_id: input.parentRecord?.drive_item_id ?? null,
  };

  const record = existing
    ? await updateDriveItem(existing.id, payload)
    : await createDriveItem(payload);

  return record;
}

/**
 * Provision (or look up) the locked AI Media export folder branch under
 * `/AffiliateAI/05_EXPORTS/AI_MEDIA/`. Server-only and owner-scoped.
 */
async function ensureAiMediaExportFolder(): Promise<DriveFolderHandle> {
  const rootFolder = await ensureExportFolderRecord({
    name: AI_MEDIA_EXPORT_BRANCH_SEGMENTS[0],
    drivePath: joinDrivePath(AI_MEDIA_EXPORT_BRANCH_SEGMENTS[0]),
    parentFolderId: null,
    parentRecord: null,
    notes: "Google Drive root for AffiliateAI.",
  });

  const exportsFolder = await ensureExportFolderRecord({
    name: AI_MEDIA_EXPORT_BRANCH_SEGMENTS[1],
    drivePath: joinDrivePath(AI_MEDIA_EXPORT_BRANCH_SEGMENTS[0], AI_MEDIA_EXPORT_BRANCH_SEGMENTS[1]),
    parentFolderId: rootFolder.drive_item_id,
    parentRecord: rootFolder,
    notes: "Exports container.",
  });

  const aiMediaFolder = await ensureExportFolderRecord({
    name: AI_MEDIA_EXPORT_BRANCH_SEGMENTS[2],
    drivePath: joinDrivePath(...AI_MEDIA_EXPORT_BRANCH_SEGMENTS),
    parentFolderId: exportsFolder.drive_item_id,
    parentRecord: exportsFolder,
    notes: "AI Media Lab generated outputs.",
  });

  return aiMediaFolder;
}

// =============================================================================
// File naming
// =============================================================================

function buildExportFileName(input: {
  toolType: ExternalGenerationToolType;
  taskId: string;
  providerTaskId: string | null;
  mimeType: string;
}): string {
  const segments = [
    TOOL_LABEL_SEGMENT[input.toolType],
    input.taskId.slice(0, 8),
    input.providerTaskId ? safeFilenameSegment(input.providerTaskId).slice(0, 16) : "noid",
  ];
  const ext = extFromMime(input.mimeType);
  return `${segments.map(safeFilenameSegment).join("_")}.${ext}`;
}

// =============================================================================
// Task lookup
// =============================================================================

async function loadOwnedTask(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  taskId: string,
): Promise<ExternalGenerationTaskRow | null> {
  const { data, error } = await supabase
    .from("external_generation_tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("id", taskId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as ExternalGenerationTaskRow | null;
}

// =============================================================================
// Logging
// =============================================================================

function nowIsoTime(): string {
  return new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function logEntry(level: "info" | "warn" | "error" | "success", message: string) {
  return { time: nowIsoTime(), level, message };
}

function appendLog(row: ExternalGenerationTaskRow, entry: ReturnType<typeof logEntry>): unknown[] {
  const existing = Array.isArray(row.log_json) ? row.log_json : [];
  return [...existing, entry];
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Save the output of a successful AI Media task to Google Drive.
 * Idempotent: repeated saves for the same task reuse the same drive_items row.
 *
 * Steps:
 *   1. Load the owner-scoped task.
 *   2. Extract a retrievable asset reference from `output_json` (URL or base64).
 *   3. Fetch bytes (server-side) and upload to Drive under
 *      `/AffiliateAI/05_EXPORTS/AI_MEDIA/`.
 *   4. Create or update the matching `drive_items` row.
 *   5. Write the resulting drive_items.id back to
 *      `external_generation_tasks.output_drive_item_ref_id`.
 *   6. Return safe Drive metadata. For images, optionally derive a transient
 *      preview data URL (never persisted).
 */
export async function saveAiMediaTaskOutputToDrive(
  taskId: string,
): Promise<SaveAiMediaOutputResult> {
  const trimmedId = readText(taskId);
  if (!trimmedId) {
    return { success: false, error: "Task tidak valid." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Autentikasi diperlukan." };
  }

  let task: ExternalGenerationTaskRow | null;
  try {
    task = await loadOwnedTask(supabase, user.id, trimmedId);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Gagal memuat task." };
  }

  if (!task) {
    return { success: false, error: "Task tidak ditemukan." };
  }
  if (task.status !== "SUCCESS") {
    return { success: false, error: "Task belum sukses." };
  }

  // Idempotent short-circuit: if already saved, refresh metadata only.
  if (task.output_drive_item_ref_id) {
    try {
      const refreshed = await refreshExistingDriveOutput(task.output_drive_item_ref_id);
      if (refreshed) {
        return { success: true, output: refreshed, alreadySaved: true };
      }
      // If the existing ref no longer resolves, fall through and re-export.
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Gagal memuat Drive output.",
      };
    }
  }

  // Extract asset.
  const asset = extractAssetFromOutput(task.output_json);
  if (!asset) {
    await supabase
      .from("external_generation_tasks")
      .update({
        log_json: appendLog(task, logEntry("warn", "Output tidak punya asset yang bisa diunduh.")),
      })
      .eq("id", task.id)
      .eq("user_id", user.id);
    return { success: false, error: "Output tidak punya asset." };
  }

  // Resolve bytes + mime.
  let bytes: Buffer;
  let mimeType: string;
  try {
    if (asset.kind === "url") {
      const fetched = await fetchProviderAssetBytes(asset.url, asset.mimeHint);
      bytes = fetched.bytes;
      mimeType = fetched.mimeType;
    } else {
      bytes = asset.bytes;
      mimeType = asset.mimeType;
      if (bytes.length > MAX_OUTPUT_BYTES) {
        return { success: false, error: "Output terlalu besar untuk disimpan otomatis." };
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal mengunduh output.";
    await supabase
      .from("external_generation_tasks")
      .update({ log_json: appendLog(task, logEntry("error", message)) })
      .eq("id", task.id)
      .eq("user_id", user.id);
    return { success: false, error: message };
  }

  // Provision Drive folder + log.
  let folder: DriveFolderHandle;
  try {
    folder = await ensureAiMediaExportFolder();
    if (!folder.drive_item_id) {
      throw new Error("Folder Drive tidak siap.");
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Folder Drive gagal disiapkan.";
    return { success: false, error: message };
  }

  const fileName = buildExportFileName({
    toolType: task.tool_type,
    taskId: task.id,
    providerTaskId: task.provider_task_id,
    mimeType,
  });
  const drivePath = joinDrivePath(folder.drive_path, fileName);

  await supabase
    .from("external_generation_tasks")
    .update({ log_json: appendLog(task, logEntry("info", `Uploading ${fileName} ke Drive.`)) })
    .eq("id", task.id)
    .eq("user_id", user.id);

  // Upload bytes; idempotent on drive_path.
  let driveRecord: DriveItemRecord;
  try {
    driveRecord = await writeGeneratedDriveFile({
      bytes,
      drivePath,
      mimeType,
      name: fileName,
      notes: `AI Media output for task ${task.id}.`,
      parentId: folder.id,
      purpose: "EXPORT_FILE",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload Drive gagal.";
    await supabase
      .from("external_generation_tasks")
      .update({ log_json: appendLog(task, logEntry("error", message)) })
      .eq("id", task.id)
      .eq("user_id", user.id);
    return { success: false, error: message };
  }

  // Persist back-reference and append success log.
  const successLog = appendLog(task, logEntry("success", "Output tersimpan di Drive."));
  const { error: updateError } = await supabase
    .from("external_generation_tasks")
    .update({
      output_drive_item_ref_id: driveRecord.id,
      log_json: successLog,
    })
    .eq("id", task.id)
    .eq("user_id", user.id);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  const previewDataUrl = await tryBuildPreviewDataUrl(driveRecord);

  return {
    success: true,
    alreadySaved: false,
    output: {
      driveItemId: driveRecord.id,
      driveFileId: driveRecord.drive_item_id,
      name: driveRecord.name,
      driveUrl: driveRecord.drive_url,
      mimeType: driveRecord.mime_type,
      sizeBytes: driveRecord.size_bytes,
      previewDataUrl,
    },
  };
}

async function refreshExistingDriveOutput(
  driveItemId: string,
): Promise<AiMediaDriveOutputProjection | null> {
  const existing = await getDriveItemById(driveItemId);
  if (!existing || existing.status === "ARCHIVED") return null;

  const previewDataUrl = await tryBuildPreviewDataUrl(existing);
  return {
    driveItemId: existing.id,
    driveFileId: existing.drive_item_id,
    name: existing.name,
    driveUrl: existing.drive_url,
    mimeType: existing.mime_type,
    sizeBytes: existing.size_bytes,
    previewDataUrl,
  };
}

async function tryBuildPreviewDataUrl(record: DriveItemRecord): Promise<string | null> {
  if (!record.drive_item_id) return null;
  if (!record.mime_type || !record.mime_type.startsWith("image/")) return null;
  return await tryGetGoogleDriveImageDataUrl({
    fileId: record.drive_item_id,
    mimeType: record.mime_type,
  });
}

// Internal: small surface for unit-style extractor tests if added later.
export const __aiMediaDriveOutputInternals = { extractAssetFromOutput };
