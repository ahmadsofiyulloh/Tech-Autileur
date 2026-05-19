import "server-only";

import { revalidatePath } from "next/cache.js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getGoogleDriveFileMetadata,
  replaceGoogleDriveBufferContent,
  replaceGoogleDriveFileContent,
  trashGoogleDriveItem,
  updateGoogleDriveFileMetadata,
  uploadBufferToGoogleDrive,
  uploadFileToGoogleDrive,
  type GoogleDriveFileMetadata,
} from "@/lib/server/google-drive";
import {
  DRIVE_ITEM_PURPOSES,
  DRIVE_ITEM_STATUSES,
  DRIVE_ITEM_TYPES,
  type DriveItemPurpose,
  type DriveItemStatus,
  type DriveItemType,
  isDriveItemPurpose,
  isDriveItemStatus,
  isDriveItemType,
} from "@/lib/drive/validation";

export type DriveItemRecord = {
  id: string;
  user_id: string;
  item_type: DriveItemType;
  drive_item_id: string | null;
  parent_id: string | null;
  parent_drive_item_id: string | null;
  name: string;
  drive_url: string;
  drive_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  checksum: string | null;
  drive_modified_at: string | null;
  purpose: DriveItemPurpose;
  status: DriveItemStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type DriveItemInput = {
  id?: string;
  item_type: string;
  drive_item_id?: string | null;
  parent_id?: string | null;
  parent_drive_item_id?: string | null;
  name: string;
  drive_url: string;
  drive_path: string;
  mime_type?: string | null;
  size_bytes?: number | null;
  checksum?: string | null;
  drive_modified_at?: string | null;
  purpose?: string;
  status?: string;
  notes?: string | null;
};

type DriveFileMutationInput = {
  file: File;
  parentId: string;
  name?: string | null;
  purpose?: string | null;
  notes?: string | null;
};

type AttachDriveFileInput = {
  driveItemIdOrUrl: string;
  parentId?: string | null;
  purpose?: string | null;
  drivePath?: string | null;
  notes?: string | null;
};

type GeneratedDriveFileInput = {
  bytes: Buffer | string;
  name: string;
  mimeType: string;
  parentId?: string | null;
  parentDriveFolderId?: string | null;
  drivePath?: string | null;
  purpose?: string | null;
  notes?: string | null;
  description?: string | null;
};

const GOOGLE_DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

function readUserFacingText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function assertDriveItemType(value: string): asserts value is DriveItemType {
  if (!isDriveItemType(value)) {
    throw new Error(`Invalid Drive item type. Expected one of: ${DRIVE_ITEM_TYPES.join(", ")}.`);
  }
}

function assertDriveItemPurpose(value: string): asserts value is DriveItemPurpose {
  if (!isDriveItemPurpose(value)) {
    throw new Error(`Invalid Drive item purpose. Expected one of: ${DRIVE_ITEM_PURPOSES.join(", ")}.`);
  }
}

function assertDriveItemStatus(value: string): asserts value is DriveItemStatus {
  if (!isDriveItemStatus(value)) {
    throw new Error(`Invalid Drive item status. Expected one of: ${DRIVE_ITEM_STATUSES.join(", ")}.`);
  }
}

function normalizeNullableText(value: string | null | undefined) {
  const trimmed = readUserFacingText(value);
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNullableNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("size_bytes must be null or a non-negative number.");
  }

  return Math.trunc(parsed);
}

function normalizeNullableTimestamp(value: string | null | undefined) {
  const trimmed = readUserFacingText(value);

  if (!trimmed) {
    return null;
  }

  const parsed = Date.parse(trimmed);

  if (Number.isNaN(parsed)) {
    throw new Error("drive_modified_at must be a valid ISO timestamp.");
  }

  return new Date(parsed).toISOString();
}

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  return { supabase, user };
}

function revalidateDriveSurfaces() {
  revalidatePath("/drive");
  revalidatePath("/settings");
  revalidatePath("/settings/drive");
  revalidatePath("/dashboard");
}

export function buildStandardDrivePath(input: {
  itemType: DriveItemType;
  purpose: DriveItemPurpose;
  segments?: string[];
  name?: string;
}) {
  const normalizedSegments = (input.segments ?? [])
    .map((segment) => readUserFacingText(segment))
    .filter(Boolean);
  const leafName = readUserFacingText(input.name);
  const leaf = leafName || input.purpose.toLowerCase();

  return ["/AffiliateAI", input.itemType.toLowerCase(), input.purpose.toLowerCase(), ...normalizedSegments, leaf]
    .filter(Boolean)
    .join("/");
}

export async function createDriveItem(input: DriveItemInput) {
  const { supabase, user } = await requireUser();
  assertDriveItemType(input.item_type);

  const purpose = input.purpose ?? "OTHER";
  const status = input.status ?? "ACTIVE";

  assertDriveItemPurpose(purpose);
  assertDriveItemStatus(status);

  const payload = {
    user_id: user.id,
    item_type: input.item_type,
    drive_item_id: normalizeNullableText(input.drive_item_id),
    parent_id: normalizeNullableText(input.parent_id),
    parent_drive_item_id: normalizeNullableText(input.parent_drive_item_id),
    name: readUserFacingText(input.name),
    drive_url: readUserFacingText(input.drive_url),
    drive_path: readUserFacingText(input.drive_path),
    mime_type: normalizeNullableText(input.mime_type),
    size_bytes: normalizeNullableNumber(input.size_bytes),
    checksum: normalizeNullableText(input.checksum),
    drive_modified_at: normalizeNullableTimestamp(input.drive_modified_at),
    purpose,
    status,
    notes: normalizeNullableText(input.notes),
  };

  const { data, error } = await supabase.from("drive_items").insert(payload).select("*").single();

  if (error) {
    throw new Error(error.message);
  }

  revalidateDriveSurfaces();
  return data as DriveItemRecord;
}

export async function listDriveItems(input?: { status?: DriveItemStatus | string; limit?: number }) {
  const { supabase, user } = await requireUser();

  if (input?.status) {
    assertDriveItemStatus(input.status);
  }

  const limit = Math.min(Math.max(input?.limit ?? 100, 1), 200);
  let query = supabase
    .from("drive_items")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (input?.status) {
    query = query.eq("status", input.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as DriveItemRecord[];
}

export async function listDriveItemsByIds(ids: Array<string | null | undefined>) {
  const { supabase, user } = await requireUser();
  const uniqueIds = Array.from(new Set(ids.map((id) => readUserFacingText(id)).filter(Boolean)));

  if (!uniqueIds.length) {
    return [] as DriveItemRecord[];
  }

  const { data, error } = await supabase
    .from("drive_items")
    .select("*")
    .eq("user_id", user.id)
    .in("id", uniqueIds);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as DriveItemRecord[];
}

export async function getDriveItemById(id: string) {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("drive_items")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as DriveItemRecord | null;
}

export async function getDriveItemByDriveItemId(driveItemId: string) {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("drive_items")
    .select("*")
    .eq("drive_item_id", driveItemId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as DriveItemRecord | null;
}

export async function getDriveItemByDrivePath(drivePath: string) {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("drive_items")
    .select("*")
    .eq("drive_path", readUserFacingText(drivePath))
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as DriveItemRecord | null;
}

export async function updateDriveItem(
  id: string,
  input: Partial<DriveItemInput> & { name?: string; drive_url?: string; drive_path?: string },
) {
  const { supabase, user } = await requireUser();

  if (input.item_type) {
    assertDriveItemType(input.item_type);
  }
  if (input.purpose) {
    assertDriveItemPurpose(input.purpose);
  }
  if (input.status) {
    assertDriveItemStatus(input.status);
  }

  const { data, error } = await supabase
    .from("drive_items")
    .update({
      ...(input.item_type ? { item_type: input.item_type } : {}),
      ...(input.drive_item_id !== undefined ? { drive_item_id: normalizeNullableText(input.drive_item_id) } : {}),
      ...(input.parent_id !== undefined ? { parent_id: normalizeNullableText(input.parent_id) } : {}),
      ...(input.parent_drive_item_id !== undefined
        ? { parent_drive_item_id: normalizeNullableText(input.parent_drive_item_id) }
        : {}),
      ...(input.name !== undefined ? { name: readUserFacingText(input.name) } : {}),
      ...(input.drive_url !== undefined ? { drive_url: readUserFacingText(input.drive_url) } : {}),
      ...(input.drive_path !== undefined ? { drive_path: readUserFacingText(input.drive_path) } : {}),
      ...(input.mime_type !== undefined ? { mime_type: normalizeNullableText(input.mime_type) } : {}),
      ...(input.size_bytes !== undefined ? { size_bytes: normalizeNullableNumber(input.size_bytes) } : {}),
      ...(input.checksum !== undefined ? { checksum: normalizeNullableText(input.checksum) } : {}),
      ...(input.drive_modified_at !== undefined ? { drive_modified_at: normalizeNullableTimestamp(input.drive_modified_at) } : {}),
      ...(input.purpose ? { purpose: input.purpose } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.notes !== undefined ? { notes: normalizeNullableText(input.notes) } : {}),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidateDriveSurfaces();
  return data as DriveItemRecord;
}

export async function archiveDriveItem(id: string) {
  return await updateDriveItem(id, { status: "ARCHIVED" });
}

function replaceDrivePathLeaf(drivePath: string, nextName: string) {
  const normalizedPath = readUserFacingText(drivePath);
  const normalizedName = readUserFacingText(nextName);

  if (!normalizedPath || !normalizedName) {
    return normalizedPath || normalizedName;
  }

  const hasLeadingSlash = normalizedPath.startsWith("/");
  const segments = normalizedPath.split("/").filter(Boolean);

  if (!segments.length) {
    return hasLeadingSlash ? `/${normalizedName}` : normalizedName;
  }

  segments[segments.length - 1] = normalizedName;
  return `${hasLeadingSlash ? "/" : ""}${segments.join("/")}`;
}

function driveMetadataPatch(metadata: GoogleDriveFileMetadata, options?: { drivePath?: string | null }) {
  return {
    drive_item_id: metadata.driveItemId,
    name: metadata.name,
    drive_url: metadata.driveUrl,
    ...(options?.drivePath !== undefined ? { drive_path: options.drivePath ?? "" } : {}),
    mime_type: metadata.mimeType,
    size_bytes: metadata.sizeBytes,
    checksum: metadata.checksum,
    drive_modified_at: metadata.driveModifiedAt,
  };
}

function normalizeDrivePurpose(value: string | null | undefined) {
  const purpose = readUserFacingText(value) || "OTHER";

  assertDriveItemPurpose(purpose);
  return purpose;
}

function extractGoogleDriveFileId(value: string) {
  const text = readUserFacingText(value);

  if (!text) {
    return "";
  }

  if (/^[A-Za-z0-9_-]{10,}$/.test(text) && !text.includes("/")) {
    return text;
  }

  try {
    const url = new URL(text);
    const fileMatch = url.pathname.match(/\/file\/d\/([^/?#]+)/);

    if (fileMatch?.[1]) {
      return decodeURIComponent(fileMatch[1]).trim();
    }

    return readUserFacingText(url.searchParams.get("id"));
  } catch {
    return "";
  }
}

async function requireWritableParentFolder(parentId: string) {
  const parent = await getDriveItemById(parentId);

  if (!parent) {
    throw new Error("Target folder Drive tidak ditemukan.");
  }

  if (parent.item_type !== "FOLDER") {
    throw new Error("Target Drive harus berupa folder.");
  }

  if (!parent.drive_item_id) {
    throw new Error("Target folder belum tersinkron ke Google Drive.");
  }

  return parent;
}

function assertFileMetadata(metadata: GoogleDriveFileMetadata) {
  if (metadata.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE) {
    throw new Error("Gunakan folder sync untuk folder Drive.");
  }
}

function buildChildDrivePath(parent: DriveItemRecord | null, name: string, fallbackSegments?: string[]) {
  const parentPath = readUserFacingText(parent?.drive_path);
  const leafName = readUserFacingText(name) || "drive-file";

  if (parentPath) {
    return `${parentPath.replace(/\/+$/g, "")}/${leafName}`;
  }

  return buildStandardDrivePath({
    itemType: "FILE",
    purpose: "OTHER",
    segments: fallbackSegments,
    name: leafName,
  });
}

function normalizeGeneratedFileBytes(value: Buffer | string) {
  return typeof value === "string" ? Buffer.from(value, "utf8") : value;
}

async function upsertDriveFileMetadata(input: {
  metadata: GoogleDriveFileMetadata;
  parent: DriveItemRecord | null;
  drivePath?: string | null;
  purpose?: string | null;
  notes?: string | null;
}) {
  assertFileMetadata(input.metadata);

  const drivePath = readUserFacingText(input.drivePath) || buildChildDrivePath(input.parent, input.metadata.name);
  const existing = (await getDriveItemByDriveItemId(input.metadata.driveItemId)) ?? (await getDriveItemByDrivePath(drivePath));
  const purpose = normalizeDrivePurpose(input.purpose);
  const payload = {
    item_type: "FILE",
    ...driveMetadataPatch(input.metadata, { drivePath }),
    drive_path: drivePath,
    parent_id: input.parent?.id ?? null,
    parent_drive_item_id: input.parent?.drive_item_id ?? null,
    purpose,
    status: "ACTIVE",
    notes: input.notes ?? null,
  };

  if (existing) {
    return await updateDriveItem(existing.id, payload);
  }

  return await createDriveItem(payload);
}

export async function writeGeneratedDriveFile(input: GeneratedDriveFileInput) {
  const fileName = readUserFacingText(input.name);
  const mimeType = readUserFacingText(input.mimeType) || "application/octet-stream";
  const bytes = normalizeGeneratedFileBytes(input.bytes);
  const parent = input.parentId ? await requireWritableParentFolder(input.parentId) : null;
  const parentDriveFolderId = parent?.drive_item_id ?? readUserFacingText(input.parentDriveFolderId);

  if (!fileName) {
    throw new Error("Nama file wajib diisi.");
  }

  if (!parentDriveFolderId) {
    throw new Error("Target folder Drive wajib diisi.");
  }

  const drivePath = readUserFacingText(input.drivePath) || buildChildDrivePath(parent, fileName, ["generated"]);
  const existing = await getDriveItemByDrivePath(drivePath);

  if (existing && existing.item_type !== "FILE") {
    throw new Error("Path Drive target sudah dipakai folder.");
  }

  const uploaded = existing?.drive_item_id
    ? await replaceGoogleDriveBufferContent({
        bytes,
        fileId: existing.drive_item_id,
        mimeType,
        name: fileName,
      })
    : await uploadBufferToGoogleDrive({
        bytes,
        description: input.description ?? input.notes,
        mimeType,
        name: fileName,
        parentFolderId: parentDriveFolderId,
      });

  return await upsertDriveFileMetadata({
    metadata: uploaded,
    parent,
    drivePath,
    purpose: input.purpose ?? "EXPORT_FILE",
    notes: input.notes,
  });
}

export async function uploadDriveItemFile(input: DriveFileMutationInput) {
  const parent = await requireWritableParentFolder(input.parentId);
  const fileName = readUserFacingText(input.name) || readUserFacingText(input.file.name) || "upload.bin";
  const uploaded = await uploadFileToGoogleDrive({
    file: input.file,
    name: fileName,
    description: input.notes,
    parentFolderId: parent.drive_item_id ?? "",
  });

  return await upsertDriveFileMetadata({
    metadata: uploaded,
    parent,
    drivePath: buildChildDrivePath(parent, uploaded.name),
    purpose: input.purpose,
    notes: input.notes,
  });
}

export async function attachGoogleDriveFile(input: AttachDriveFileInput) {
  const driveItemId = extractGoogleDriveFileId(input.driveItemIdOrUrl);

  if (!driveItemId) {
    throw new Error("Drive file URL atau ID tidak valid.");
  }

  const parent = input.parentId ? await requireWritableParentFolder(input.parentId) : null;
  const metadata = await getGoogleDriveFileMetadata(driveItemId);

  return await upsertDriveFileMetadata({
    metadata,
    parent,
    drivePath: input.drivePath,
    purpose: input.purpose,
    notes: input.notes,
  });
}

export async function refreshDriveItemFromGoogleDrive(id: string) {
  const existing = await getDriveItemById(id);

  if (!existing) {
    throw new Error("Drive item not found.");
  }

  if (!existing.drive_item_id) {
    throw new Error("Drive item has no Google Drive id.");
  }

  const metadata = await getGoogleDriveFileMetadata(existing.drive_item_id);
  return await updateDriveItem(existing.id, driveMetadataPatch(metadata));
}

export async function renameDriveItemInGoogleDrive(id: string, name: string) {
  const existing = await getDriveItemById(id);
  const nextName = readUserFacingText(name);

  if (!existing) {
    throw new Error("Drive item not found.");
  }

  if (existing.item_type !== "FILE") {
    throw new Error("Only file items can be renamed.");
  }

  if (!existing.drive_item_id) {
    throw new Error("Drive item has no Google Drive id.");
  }

  if (!nextName) {
    throw new Error("Nama file wajib diisi.");
  }

  const metadata = await updateGoogleDriveFileMetadata({
    fileId: existing.drive_item_id,
    name: nextName,
  });
  const drivePath = replaceDrivePathLeaf(existing.drive_path, metadata.name);

  return await updateDriveItem(existing.id, driveMetadataPatch(metadata, { drivePath }));
}

export async function replaceDriveItemFile(id: string, file: File) {
  const existing = await getDriveItemById(id);

  if (!existing) {
    throw new Error("Drive item not found.");
  }

  if (existing.item_type !== "FILE") {
    throw new Error("Only file items can be replaced.");
  }

  if (!existing.drive_item_id) {
    throw new Error("Drive item has no Google Drive id.");
  }

  const metadata = await replaceGoogleDriveFileContent({
    file,
    fileId: existing.drive_item_id,
  });
  const drivePath = replaceDrivePathLeaf(existing.drive_path, metadata.name);

  return await updateDriveItem(existing.id, driveMetadataPatch(metadata, { drivePath }));
}

export async function trashDriveItemInGoogleDrive(id: string) {
  const existing = await getDriveItemById(id);

  if (!existing) {
    throw new Error("Drive item not found.");
  }

  if (!existing.drive_item_id) {
    return await archiveDriveItem(existing.id);
  }

  const metadata = await trashGoogleDriveItem(existing.drive_item_id);

  return await updateDriveItem(existing.id, {
    ...driveMetadataPatch(metadata),
    status: "ARCHIVED",
  });
}
