"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  attachGoogleDriveFile,
  archiveDriveItem,
  createDriveItem,
  refreshDriveItemFromGoogleDrive,
  renameDriveItemInGoogleDrive,
  replaceDriveItemFile,
  trashDriveItemInGoogleDrive,
  updateDriveItem,
  uploadDriveItemFile,
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

function readFile(formData: FormData, key: string) {
  const value = formData.get(key);

  if (value instanceof File && value.size > 0) {
    return value;
  }

  return null;
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

  if (intent === "refresh") {
    if (!id) {
      fail("Missing Drive item id.");
    }

    await refreshDriveItemFromGoogleDrive(id);
    revalidatePath("/drive");
    redirect("/drive?message=Drive item refreshed");
  }

  if (intent === "upload_file") {
    const file = readFile(formData, "upload_file");

    if (!parentId) {
      fail("Target folder wajib diisi.");
    }

    if (!file) {
      fail("File wajib diisi.");
    }

    await uploadDriveItemFile({
      file,
      parentId,
      name: name || null,
      purpose: purpose || "OTHER",
      notes: notes || null,
    });
    revalidatePath("/drive");
    redirect("/drive?message=File Drive diunggah");
  }

  if (intent === "attach_file") {
    const driveItemUrl = readText(formData, "drive_item_url");

    if (!driveItemUrl) {
      fail("URL atau ID file Drive wajib diisi.");
    }

    await attachGoogleDriveFile({
      driveItemIdOrUrl: driveItemUrl,
      parentId: parentId || null,
      purpose: purpose || "OTHER",
      drivePath: drivePath || null,
      notes: notes || null,
    });
    revalidatePath("/drive");
    redirect("/drive?message=File Drive ditautkan");
  }

  if (intent === "rename_file") {
    if (!id) {
      fail("Missing Drive item id.");
    }

    if (!name) {
      fail("Nama file wajib diisi.");
    }

    await renameDriveItemInGoogleDrive(id, name);
    revalidatePath("/drive");
    redirect("/drive?message=File Drive diganti nama");
  }

  if (intent === "replace_file") {
    if (!id) {
      fail("Missing Drive item id.");
    }

    const file = readFile(formData, "replacement_file");

    if (!file) {
      fail("Replacement file is required.");
    }

    await replaceDriveItemFile(id, file);
    revalidatePath("/drive");
    redirect("/drive?message=Drive file replaced");
  }

  if (intent === "trash") {
    if (!id) {
      fail("Missing Drive item id.");
    }

    await trashDriveItemInGoogleDrive(id);
    revalidatePath("/drive");
    redirect("/drive?message=Drive item moved to trash");
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
  });

  revalidatePath("/drive");
  redirect("/drive?message=Drive item updated");
}
