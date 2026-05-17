import "server-only";

import type { JsonRecord } from "@/lib/intake/validation";

type DriveItemSnapshotInput = {
  id: string;
  name: string;
  drive_path: string;
  drive_url: string;
  mime_type: string | null;
  purpose: string;
  status: string;
  notes: string | null;
};

type ProductImageSnapshotInput = {
  id: string;
  drive_item_ref_id: string;
  source_type: string;
  is_primary: boolean;
  status: string;
  notes: string | null;
  analysis_json: JsonRecord | null;
};

function readText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export function sanitizeDriveLeafName(value: string) {
  const trimmed = readText(value);

  if (!trimmed) {
    return "upload.bin";
  }

  return trimmed.replace(/[\\/:*?"<>|]+/g, "-");
}

export function joinIntakeDrivePath(...segments: Array<string | null | undefined>) {
  return `/${segments
    .map((segment) => readText(segment))
    .filter(Boolean)
    .map((segment) => segment.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/")}`;
}

export function buildDriveItemSnapshot(item: DriveItemSnapshotInput | null) {
  if (!item) {
    return null;
  }

  return {
    id: item.id,
    name: item.name,
    drive_path: item.drive_path,
    drive_url: item.drive_url,
    mime_type: item.mime_type,
    purpose: item.purpose,
    status: item.status,
    notes: item.notes,
  };
}

export function buildProductImageSnapshot(
  image: ProductImageSnapshotInput | null,
  driveItem: DriveItemSnapshotInput | null,
) {
  if (!image) {
    return null;
  }

  return {
    id: image.id,
    drive_item_ref_id: image.drive_item_ref_id,
    source_type: image.source_type,
    is_primary: image.is_primary,
    status: image.status,
    notes: image.notes,
    analysis_json: image.analysis_json,
    drive_item: buildDriveItemSnapshot(driveItem),
  };
}
