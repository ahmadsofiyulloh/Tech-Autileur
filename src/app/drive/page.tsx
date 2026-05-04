import { redirect } from "next/navigation";
import { HardDrive } from "lucide-react";
import { DriveVisualManager } from "./drive-visual-manager";
import { EmptyState } from "@/components/operator/empty-state";
import { listDriveItems } from "@/lib/server/drive-items";
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

  return driveItems.length ? (
    <DriveVisualManager
      items={driveItems.map((item) => ({
        id: item.id,
        item_type: item.item_type,
        name: item.name,
        drive_url: item.drive_url,
        drive_path: item.drive_path,
        mime_type: item.mime_type,
        purpose: item.purpose,
        status: item.status,
        size_bytes: item.size_bytes,
      }))}
    />
  ) : (
    <div className="stack">
      <EmptyState icon={HardDrive} title="Belum ada item Drive." description="Sinkronkan folder Drive dulu." />
    </div>
  );
}
