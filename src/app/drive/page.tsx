import { redirect } from "next/navigation";
import { HardDrive } from "lucide-react";
import { DriveVisualManager } from "./drive-visual-manager";
import { EmptyState } from "@/components/operator/empty-state";
import { getDriveItemById, listDriveItems } from "@/lib/server/drive-items";
import { resolveDriveImageDetailUrl, resolveDriveImagePreviewUrl } from "@/lib/server/drive-image-previews";
import { getCurrentWorkspace } from "@/lib/server/workspaces";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DrivePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let driveItems;
  let uploadTarget: { id: string; name: string; drive_path: string } | null = null;

  try {
    driveItems = await listDriveItems({ limit: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Drive tidak tersedia.";
    return (
      <div className="stack">
        <EmptyState icon={HardDrive} title="Drive tidak tersedia." description={message} />
      </div>
    );
  }

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

  try {
    const workspace = await getCurrentWorkspace();

    if (workspace?.drive_root_folder_ref_id) {
      const rootFolder = await getDriveItemById(workspace.drive_root_folder_ref_id);

      if (rootFolder?.item_type === "FOLDER" && rootFolder.drive_item_id && rootFolder.status !== "ARCHIVED") {
        uploadTarget = {
          id: rootFolder.id,
          name: rootFolder.name,
          drive_path: rootFolder.drive_path,
        };
      }
    }
  } catch {
    uploadTarget = null;
  }

  return (
    <DriveVisualManager
      uploadTarget={uploadTarget}
      items={visualItems}
    />
  );
}
