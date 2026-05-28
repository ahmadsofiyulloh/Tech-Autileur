import { redirect } from "next/navigation";
import { HardDrive } from "lucide-react";
import { DriveVisualManager } from "./drive-visual-manager";
import { EmptyState } from "@/components/operator/empty-state";
import { resolveDriveImageDetailUrl, resolveDriveImagePreviewUrl } from "@/lib/server/drive-image-previews";
import { getActiveWorkspaceDriveScope } from "@/lib/server/drive-workspace-scope";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const DRIVE_INITIAL_SCOPE_LIMIT = 500;

export default async function DrivePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  try {
    const { rootFolder, items: driveItems } = await getActiveWorkspaceDriveScope({ limit: DRIVE_INITIAL_SCOPE_LIMIT });
    const uploadTarget = {
      id: rootFolder.id,
      name: rootFolder.name,
      drive_path: rootFolder.drive_path,
    };
    const visibleDriveItems = driveItems.filter((item) => item.status !== "ARCHIVED");
    const previewUrlCache = new Map<string, string | null>();
    const detailUrlCache = new Map<string, string | null>();
    const visualItems = await Promise.all(
      visibleDriveItems.map((item) => ({
        id: item.id,
        drive_item_id: item.drive_item_id,
        item_type: item.item_type,
        name: item.name,
        drive_url: item.drive_url,
        drive_path: item.drive_path,
        parent_id: item.parent_id,
        parent_drive_item_id: item.parent_drive_item_id,
        mime_type: item.mime_type,
        purpose: item.purpose,
        status: item.status,
        size_bytes: item.size_bytes,
        checksum: item.checksum,
        drive_modified_at: item.drive_modified_at,
        preview_url: resolveDriveImagePreviewUrl(item, previewUrlCache),
        detail_url: resolveDriveImageDetailUrl(item, detailUrlCache),
      })),
    );

    return (
      <DriveVisualManager
        uploadTarget={uploadTarget}
        items={visualItems}
      />
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Drive tidak tersedia.";
    return (
      <div className="stack">
        <EmptyState icon={HardDrive} title="Drive tidak tersedia." description={message} />
      </div>
    );
  }
}
