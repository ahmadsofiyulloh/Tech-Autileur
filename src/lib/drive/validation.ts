export const DRIVE_ITEM_TYPES = ["FILE", "FOLDER"] as const;

export const DRIVE_ITEM_PURPOSES = [
  "ROOT_FOLDER",
  "ADMIN_FOLDER",
  "PRODUCT_FOLDER",
  "SOURCE_IMAGE",
  "I2I_RESULT",
  "I2V_PROMPT_EXPORT",
  "RAW_CLIP",
  "FINAL_VIDEO",
  "BATCH_FOLDER",
  "IMPORT_FOLDER",
  "EXPORT_FILE",
  "UPLOAD_PACKAGE",
  "UNMATCHED_FILE",
  "OTHER",
] as const;

export const DRIVE_FOLDER_PURPOSES = DRIVE_ITEM_PURPOSES.filter(
  (purpose) => purpose.endsWith("_FOLDER") || purpose === "UPLOAD_PACKAGE" || purpose === "OTHER",
) as readonly DriveItemPurpose[];

export const DRIVE_ITEM_STATUSES = ["ACTIVE", "ARCHIVED", "NEEDS_REVIEW", "UNMATCHED", "ERROR"] as const;

export type DriveItemType = (typeof DRIVE_ITEM_TYPES)[number];
export type DriveItemPurpose = (typeof DRIVE_ITEM_PURPOSES)[number];
export type DriveItemStatus = (typeof DRIVE_ITEM_STATUSES)[number];

export function isDriveItemType(value: string): value is DriveItemType {
  return (DRIVE_ITEM_TYPES as readonly string[]).includes(value);
}

export function isDriveItemPurpose(value: string): value is DriveItemPurpose {
  return (DRIVE_ITEM_PURPOSES as readonly string[]).includes(value);
}

export function isDriveItemStatus(value: string): value is DriveItemStatus {
  return (DRIVE_ITEM_STATUSES as readonly string[]).includes(value);
}
