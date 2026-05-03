"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  archiveDriveItem,
  createDriveItem,
  updateDriveItem,
} from "@/lib/server/drive-items";
import { DRIVE_FOLDER_PURPOSES } from "@/lib/drive/validation";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function fail(message: string): never {
  redirect(`/drive?error=${encodeURIComponent(message)}`);
}

function parseOptionalNumber(value: string, fieldName: string) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    fail(`${fieldName} must be a non-negative number.`);
  }

  return parsed;
}

function isFolderPurpose(value: string) {
  return (DRIVE_FOLDER_PURPOSES as readonly string[]).includes(value);
}

export async function saveDriveItem(formData: FormData) {
  const intent = readText(formData, "intent");
  const id = readText(formData, "id");
  const itemType = readText(formData, "item_type");
  const driveItemId = readText(formData, "drive_item_id");
  const parentId = readText(formData, "parent_id");
  const parentDriveItemId = readText(formData, "parent_drive_item_id");
  const name = readText(formData, "name");
  const driveUrl = readText(formData, "drive_url");
  const drivePath = readText(formData, "drive_path");
  const mimeType = readText(formData, "mime_type");
  const sizeBytes = parseOptionalNumber(readText(formData, "size_bytes"), "Size bytes");
  const purpose = readText(formData, "purpose");
  const status = readText(formData, "status");
  const notes = readText(formData, "notes");

  if (intent === "archive") {
    if (!id) {
      fail("Missing Drive item id.");
    }

    await archiveDriveItem(id);
    revalidatePath("/drive");
    redirect("/drive?message=Drive item archived");
  }

  if (intent === "create") {
    if (!itemType) {
      fail("Item type is required.");
    }
    if (!name) {
      fail("Name is required.");
    }
    if (!driveUrl) {
      fail("Drive URL is required.");
    }
    if (!drivePath) {
      fail("Drive path is required.");
    }
    const normalizedPurpose = purpose || "OTHER";
    if (itemType === "FOLDER" && !isFolderPurpose(normalizedPurpose)) {
      fail(`Folder purpose must be one of: ${DRIVE_FOLDER_PURPOSES.join(", ")}.`);
    }

    await createDriveItem({
      item_type: itemType,
      drive_item_id: driveItemId || null,
      parent_id: parentId || null,
      parent_drive_item_id: parentDriveItemId || null,
      name,
      drive_url: driveUrl,
      drive_path: drivePath,
      mime_type: mimeType || null,
      size_bytes: sizeBytes,
      purpose: normalizedPurpose,
      status: status || undefined,
      notes: notes || null,
    });

    revalidatePath("/drive");
    redirect("/drive?message=Drive item created");
  }

  if (intent !== "update") {
    fail("Unsupported Drive action.");
  }

  if (!id) {
    fail("Missing Drive item id.");
  }
  if (!itemType) {
    fail("Item type is required.");
  }
  if (!name) {
    fail("Name is required.");
  }
  if (!driveUrl) {
    fail("Drive URL is required.");
  }
  if (!drivePath) {
    fail("Drive path is required.");
  }
  const normalizedPurpose = purpose || "OTHER";
  if (itemType === "FOLDER" && !isFolderPurpose(normalizedPurpose)) {
    fail(`Folder purpose must be one of: ${DRIVE_FOLDER_PURPOSES.join(", ")}.`);
  }

  await updateDriveItem(id, {
    item_type: itemType,
    drive_item_id: driveItemId || null,
    parent_id: parentId || null,
    parent_drive_item_id: parentDriveItemId || null,
    name,
    drive_url: driveUrl,
    drive_path: drivePath,
    mime_type: mimeType || null,
    size_bytes: sizeBytes,
    purpose: normalizedPurpose,
    status: status || undefined,
    notes: notes || null,
  });

  revalidatePath("/drive");
  redirect("/drive?message=Drive item updated");
}
