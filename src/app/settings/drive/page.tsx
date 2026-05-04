import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, HardDrive } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { listDriveItems } from "@/lib/server/drive-items";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Drive tidak tersedia.";
}

export default async function DriveSettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let folderCount = 0;
  let driveItemCount = 0;
  let driveError: string | null = null;

  try {
    const driveItems = await listDriveItems({ limit: 200 });
    driveItemCount = driveItems.length;
    folderCount = driveItems.filter((item) => item.item_type === "FOLDER").length;
  } catch (error) {
    driveError = errorMessage(error);
  }

  const isConnected = !driveError && driveItemCount > 0;

  return (
    <div className="stack">
      <SectionCard
        icon={HardDrive}
        title="Drive"
        actions={
          <Link className="button primary" href="/drive">
            <ArrowRight size={16} aria-hidden="true" />
            Buka Drive
          </Link>
        }
      >
        {driveError ? (
          <EmptyState icon={HardDrive} title="Drive unavailable." description={driveError} />
        ) : (
          <div className="stack">
            <div className="section-card__actions">
              <StatusBadge status={isConnected ? "Connected" : "Belum terhubung"} tone={isConnected ? "success" : "warning"} />
              <StatusBadge status={`${folderCount} folder`} tone="info" />
              <StatusBadge status={`${driveItemCount} item`} tone="neutral" />
            </div>
            <div className="metric-grid">
              <div className="metric">
                <span>Folders</span>
                <strong>{folderCount}</strong>
              </div>
              <div className="metric">
                <span>Items</span>
                <strong>{driveItemCount}</strong>
              </div>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
