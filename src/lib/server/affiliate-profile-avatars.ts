import "server-only";

import { tryGetGoogleDriveImageDataUrl } from "@/lib/server/google-drive";
import type { AffiliateProfileRecord } from "@/lib/server/affiliate-profiles";
import type { DriveItemRecord } from "@/lib/server/drive-items";

export async function resolveAffiliateProfileAvatar(
  profile: AffiliateProfileRecord,
  driveItemMap: Map<string, DriveItemRecord>,
) {
  const candidateRefIds = [profile.seed_character_drive_item_ref_id, profile.environment_drive_item_ref_id];

  for (const refId of candidateRefIds) {
    if (!refId) {
      continue;
    }

    const item = driveItemMap.get(refId);

    if (item?.mime_type?.startsWith("image/") && item.drive_item_id) {
      const imageDataUrl = await tryGetGoogleDriveImageDataUrl({ fileId: item.drive_item_id, mimeType: item.mime_type });

      if (imageDataUrl) {
        return imageDataUrl;
      }
    }
  }

  return null;
}
