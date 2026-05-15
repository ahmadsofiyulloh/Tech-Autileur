import { NextRequest, NextResponse } from "next/server";
import { getGoogleDriveImageThumbnailBytes } from "@/lib/server/google-drive";
import { type DriveItemRecord } from "@/lib/server/drive-items";
import { requireDriveItemInActiveWorkspaceDriveScope } from "@/lib/server/drive-workspace-scope";

export const dynamic = "force-dynamic";

function isDriveImageLike(item: DriveItemRecord) {
  return Boolean(item.drive_item_id) && (item.mime_type?.startsWith("image/") || item.purpose === "SOURCE_IMAGE");
}

function toArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function imageResponse(bytes: Uint8Array, contentType: string) {
  return new NextResponse(new Blob([toArrayBuffer(bytes)], { type: contentType }), {
    status: 200,
    headers: {
      "Cache-Control": "private, max-age=300, stale-while-revalidate=3600",
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { item } = await requireDriveItemInActiveWorkspaceDriveScope(id);

    if (!isDriveImageLike(item)) {
      return NextResponse.json({ error: "Preview tidak tersedia." }, { status: 404 });
    }

    const driveItemId = item.drive_item_id;

    if (!driveItemId) {
      return NextResponse.json({ error: "Preview tidak tersedia." }, { status: 404 });
    }

    const preview = await getGoogleDriveImageThumbnailBytes(driveItemId);

    if (!preview) {
      return NextResponse.json({ error: "Preview tidak tersedia." }, { status: 404 });
    }

    return imageResponse(preview.bytes, preview.contentType);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Preview tidak tersedia.";
    const status = message.includes("Authentication") ? 401 : 404;

    return NextResponse.json({ error: message }, { status });
  }
}
