import { NextRequest, NextResponse } from "next/server";
import { getGoogleDriveFileContentBytes } from "@/lib/server/google-drive";
import { isDriveImageLike, requireDriveImagePreviewItem } from "@/lib/server/drive-image-previews";

export const dynamic = "force-dynamic";

function toArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function imageResponse(bytes: Uint8Array, contentType: string) {
  return new NextResponse(new Blob([toArrayBuffer(bytes)], { type: contentType }), {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const item = await requireDriveImagePreviewItem(id);

    if (!isDriveImageLike(item)) {
      return NextResponse.json({ error: "Detail tidak tersedia." }, { status: 404 });
    }

    const driveItemId = item.drive_item_id;

    if (!driveItemId) {
      return NextResponse.json({ error: "Detail tidak tersedia." }, { status: 404 });
    }

    const bytes = await getGoogleDriveFileContentBytes(driveItemId);

    return imageResponse(bytes, item.mime_type || "image/jpeg");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Detail tidak tersedia.";
    const status = message.includes("Authentication") ? 401 : 404;

    return NextResponse.json({ error: message }, { status });
  }
}
