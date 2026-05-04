import "server-only";

import { ensureGoogleDriveFolder, uploadFileToGoogleDrive } from "@/lib/server/google-drive";
import {
  createDriveItem,
  getDriveItemByDriveItemId,
  getDriveItemByDrivePath,
  type DriveItemRecord,
  updateDriveItem,
} from "@/lib/server/drive-items";

type AffiliateProfileAssetKind = "CHARACTER" | "ENVIRONMENT";

type DriveFolderRecord = Pick<DriveItemRecord, "id" | "drive_item_id" | "name" | "drive_url" | "drive_path" | "purpose" | "status" | "notes" | "parent_id" | "parent_drive_item_id">;

function readText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function joinDrivePath(...segments: Array<string | null | undefined>) {
  return `/${segments
    .map((segment) => readText(segment))
    .filter(Boolean)
    .map((segment) => segment.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/")}`;
}

async function ensureDriveFolderRecord(input: {
  name: string;
  drivePath: string;
  parentFolderId?: string | null;
  parentRecord: DriveFolderRecord | null;
  notes?: string | null;
}) {
  const driveFolder = await ensureGoogleDriveFolder({ name: input.name, parentFolderId: input.parentFolderId ?? null });
  const existing = (await getDriveItemByDriveItemId(driveFolder.id)) ?? (await getDriveItemByDrivePath(input.drivePath));

  if (existing) {
    return (await updateDriveItem(existing.id, {
      item_type: "FOLDER",
      drive_item_id: driveFolder.id,
      name: driveFolder.name,
      drive_url: driveFolder.webViewLink,
      drive_path: input.drivePath,
      purpose: "ADMIN_FOLDER",
      status: "ACTIVE",
      notes: input.notes ?? existing.notes,
      parent_id: input.parentRecord?.id ?? null,
      parent_drive_item_id: input.parentRecord?.drive_item_id ?? null,
    })) as DriveFolderRecord;
  }

  return (await createDriveItem({
    item_type: "FOLDER",
    drive_item_id: driveFolder.id,
    name: driveFolder.name,
    drive_url: driveFolder.webViewLink,
    drive_path: input.drivePath,
    purpose: "ADMIN_FOLDER",
    status: "ACTIVE",
    notes: input.notes ?? null,
    parent_id: input.parentRecord?.id ?? null,
    parent_drive_item_id: input.parentRecord?.drive_item_id ?? null,
  })) as DriveFolderRecord;
}

async function ensureAffiliateProfileAssetFolders(profileCode: string) {
  const rootFolder = await ensureDriveFolderRecord({
    name: "AffiliateAI",
    drivePath: joinDrivePath("AffiliateAI"),
    parentRecord: null,
    notes: "Google Drive root for AffiliateAI.",
  });

  const adminFolder = await ensureDriveFolderRecord({
    name: "00_ADMIN",
    drivePath: joinDrivePath("AffiliateAI", "00_ADMIN"),
    parentFolderId: rootFolder.drive_item_id,
    parentRecord: rootFolder,
    notes: "Admin folder for owner-managed assets.",
  });

  const affiliateProfilesFolder = await ensureDriveFolderRecord({
    name: "affiliate_profiles",
    drivePath: joinDrivePath("AffiliateAI", "00_ADMIN", "affiliate_profiles"),
    parentFolderId: adminFolder.drive_item_id,
    parentRecord: adminFolder,
    notes: "Affiliate profile asset container.",
  });

  const profileFolder = await ensureDriveFolderRecord({
    name: profileCode,
    drivePath: joinDrivePath("AffiliateAI", "00_ADMIN", "affiliate_profiles", profileCode),
    parentFolderId: affiliateProfilesFolder.drive_item_id,
    parentRecord: affiliateProfilesFolder,
    notes: `Affiliate profile folder for ${profileCode}.`,
  });

  const characterFolder = await ensureDriveFolderRecord({
    name: "character",
    drivePath: joinDrivePath("AffiliateAI", "00_ADMIN", "affiliate_profiles", profileCode, "character"),
    parentFolderId: profileFolder.drive_item_id,
    parentRecord: profileFolder,
    notes: `Character asset folder for ${profileCode}.`,
  });

  const environmentFolder = await ensureDriveFolderRecord({
    name: "environment",
    drivePath: joinDrivePath("AffiliateAI", "00_ADMIN", "affiliate_profiles", profileCode, "environment"),
    parentFolderId: profileFolder.drive_item_id,
    parentRecord: profileFolder,
    notes: `Environment asset folder for ${profileCode}.`,
  });

  return { characterFolder, environmentFolder };
}

export async function uploadAffiliateProfileAsset(input: {
  profileCode: string;
  kind: AffiliateProfileAssetKind;
  file: File;
}) {
  const folders = await ensureAffiliateProfileAssetFolders(input.profileCode);
  const assetFolder = input.kind === "CHARACTER" ? folders.characterFolder : folders.environmentFolder;
  const assetLabel = input.kind === "CHARACTER" ? "Character" : "Environment";
  const upload = await uploadFileToGoogleDrive({
    file: input.file,
    name: input.file.name || `${input.kind.toLowerCase()}.bin`,
    description: `${assetLabel} asset for ${input.profileCode}.`,
    parentFolderId: assetFolder.drive_item_id ?? "",
  });
  const drivePath = joinDrivePath(assetFolder.drive_path, upload.name);
  const existing = await getDriveItemByDriveItemId(upload.driveItemId);

  if (existing) {
    return await updateDriveItem(existing.id, {
      item_type: "FILE",
      drive_item_id: upload.driveItemId,
      name: upload.name,
      drive_url: upload.driveUrl,
      drive_path: drivePath,
      mime_type: upload.mimeType,
      size_bytes: upload.sizeBytes,
      checksum: upload.checksum,
      drive_modified_at: upload.driveModifiedAt,
      purpose: "OTHER",
      status: "ACTIVE",
      notes: `${assetLabel} asset for ${input.profileCode}.`,
      parent_id: assetFolder.id,
      parent_drive_item_id: assetFolder.drive_item_id,
    });
  }

  return await createDriveItem({
    item_type: "FILE",
    drive_item_id: upload.driveItemId,
    name: upload.name,
    drive_url: upload.driveUrl,
    drive_path: drivePath,
    mime_type: upload.mimeType,
    size_bytes: upload.sizeBytes,
    checksum: upload.checksum,
    drive_modified_at: upload.driveModifiedAt,
    purpose: "OTHER",
    status: "ACTIVE",
    notes: `${assetLabel} asset for ${input.profileCode}.`,
    parent_id: assetFolder.id,
    parent_drive_item_id: assetFolder.drive_item_id,
  });
}
