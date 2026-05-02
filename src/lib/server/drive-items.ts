import "server-only";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
  purpose?: string;
  status?: string;
  notes?: string | null;
};

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
    purpose,
    status,
    notes: normalizeNullableText(input.notes),
  };

  const { data, error } = await supabase.from("drive_items").insert(payload).select("*").single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/drive");
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

  revalidatePath("/drive");
  return data as DriveItemRecord;
}

export async function archiveDriveItem(id: string) {
  return await updateDriveItem(id, { status: "ARCHIVED" });
}
