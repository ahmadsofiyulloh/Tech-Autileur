import "server-only";

import { type DriveItemRecord } from "@/lib/server/drive-items";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DRIVE_SCOPE_ERROR_MESSAGE, requireDriveItemInActiveWorkspaceDriveScope } from "@/lib/server/drive-workspace-scope";

type DriveImagePreviewSource = {
  id: string;
  drive_item_id: string | null;
  mime_type: string | null;
  purpose?: string | null;
};

export function isDriveImageLike(source: DriveImagePreviewSource | null | undefined) {
  return Boolean(source?.drive_item_id) && (source?.mime_type?.toLowerCase().startsWith("image/") || source?.purpose === "SOURCE_IMAGE");
}

async function requireAffiliateProfileAssetDriveItem(
  id: string,
  input?: {
    includeArchived?: boolean;
  },
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  const { data: item, error: itemError } = await supabase
    .from("drive_items")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (itemError) {
    throw new Error(itemError.message);
  }

  if (!item || (!input?.includeArchived && item.status === "ARCHIVED")) {
    throw new Error(DRIVE_SCOPE_ERROR_MESSAGE);
  }

  const { data: profile, error: profileError } = await supabase
    .from("affiliate_profiles")
    .select("id")
    .eq("user_id", user.id)
    .neq("status", "ARCHIVED")
    .or(`seed_character_drive_item_ref_id.eq.${id},environment_drive_item_ref_id.eq.${id}`)
    .limit(1)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!profile) {
    throw new Error(DRIVE_SCOPE_ERROR_MESSAGE);
  }

  return item as DriveItemRecord;
}

export async function requireDriveImagePreviewItem(
  id: string,
  input?: {
    includeArchived?: boolean;
  },
) {
  try {
    const { item } = await requireDriveItemInActiveWorkspaceDriveScope(id, input);
    return item;
  } catch (workspaceScopeError) {
    try {
      return await requireAffiliateProfileAssetDriveItem(id, input);
    } catch (profileAssetScopeError) {
      if (
        workspaceScopeError instanceof Error &&
        workspaceScopeError.message.includes("Authentication")
      ) {
        throw workspaceScopeError;
      }

      throw profileAssetScopeError;
    }
  }
}

function buildDriveMediaUrl(id: string, kind: "preview" | "detail") {
  return `/api/drive/items/${encodeURIComponent(id)}/${kind}`;
}

function buildDriveMediaCacheKey(id: string, kind: "preview" | "detail") {
  return `${id}:${kind}`;
}

export function resolveDriveImagePreviewUrl(
  source: DriveImagePreviewSource | null | undefined,
  cache?: Map<string, string | null>,
) {
  const sourceId = source?.id;

  if (!sourceId || !isDriveImageLike(source)) {
    return null;
  }

  const cacheKey = buildDriveMediaCacheKey(sourceId, "preview");
  const cached = cache?.get(cacheKey);

  if (cached !== undefined) {
    return cached;
  }

  const previewUrl = buildDriveMediaUrl(sourceId, "preview");

  cache?.set(cacheKey, previewUrl);
  return previewUrl;
}

export function resolveDriveImageDetailUrl(
  source: DriveImagePreviewSource | null | undefined,
  cache?: Map<string, string | null>,
) {
  const sourceId = source?.id;

  if (!sourceId || !isDriveImageLike(source)) {
    return null;
  }

  const cacheKey = buildDriveMediaCacheKey(sourceId, "detail");
  const cached = cache?.get(cacheKey);

  if (cached !== undefined) {
    return cached;
  }

  const detailUrl = buildDriveMediaUrl(sourceId, "detail");

  cache?.set(cacheKey, detailUrl);
  return detailUrl;
}
