import "server-only";

import { resolveDriveImagePreviewUrl } from "@/lib/server/drive-image-previews";
import type { AffiliateProfileRecord } from "@/lib/server/affiliate-profiles";
import type { DriveItemRecord } from "@/lib/server/drive-items";

export function resolveAffiliateProfileAvatar(
  profile: AffiliateProfileRecord,
  driveItemMap: Map<string, DriveItemRecord>,
) {
  const candidateRefIds = [profile.seed_character_drive_item_ref_id, profile.environment_drive_item_ref_id];

  for (const refId of candidateRefIds) {
    if (!refId) {
      continue;
    }

    const item = driveItemMap.get(refId);

    if (item) {
      const previewUrl = resolveDriveImagePreviewUrl(item);

      if (previewUrl) {
        return previewUrl;
      }
    }
  }

  return null;
}
