import "server-only";

type DriveImagePreviewSource = {
  id: string;
  drive_item_id: string | null;
  mime_type: string | null;
  purpose?: string | null;
};

function isDriveImageLike(source: DriveImagePreviewSource | null | undefined) {
  return Boolean(source?.drive_item_id) && (source?.mime_type?.startsWith("image/") || source?.purpose === "SOURCE_IMAGE");
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
