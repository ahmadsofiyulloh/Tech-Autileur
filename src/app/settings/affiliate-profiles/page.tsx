import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { SettingsSectionNav } from "../settings-section-nav";
import { AffiliateProfilesBoard } from "./affiliate-profiles-board";
import {
  isAffiliateProfileSchemaMissingError,
  listAffiliateProfileWorkspaceLinks,
  listAffiliateProfiles,
  type AffiliateProfileRecord,
  type AffiliateProfileWorkspaceLinkRecord,
} from "@/lib/server/affiliate-profiles";
import { listDriveItems, type DriveItemRecord } from "@/lib/server/drive-items";
import { getWorkspaceSelectionState, isWorkspaceSchemaMissingError, type WorkspaceSelectionState } from "@/lib/server/workspaces";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Akun Affiliate tidak tersedia.";
}

export default async function AffiliateProfilesSettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let workspaceState: WorkspaceSelectionState | null = null;
  let workspaceError: string | null = null;
  let affiliateProfiles: AffiliateProfileRecord[] = [];
  let affiliateProfileLinks: AffiliateProfileWorkspaceLinkRecord[] = [];
  let affiliateProfileSchemaMissing = false;
  let affiliateProfileLoadError: string | null = null;
  let driveItems: DriveItemRecord[] = [];
  let driveItemsError: string | null = null;

  try {
    workspaceState = await getWorkspaceSelectionState();
  } catch (error) {
    workspaceError = isWorkspaceSchemaMissingError(error) ? "Apply the local Sprint 12B migration before using workspace profiles." : errorMessage(error);
  }

  try {
    affiliateProfiles = await listAffiliateProfiles({ limit: 200 });
    affiliateProfileLinks = await listAffiliateProfileWorkspaceLinks({ limit: 500 });
  } catch (error) {
    affiliateProfileSchemaMissing = isAffiliateProfileSchemaMissingError(error);
    affiliateProfileLoadError = affiliateProfileSchemaMissing ? "Apply the local Sprint 13 migration before using affiliate profiles." : errorMessage(error);
  }

  try {
    driveItems = await listDriveItems({ limit: 200 });
  } catch (error) {
    driveItemsError = errorMessage(error);
  }

  const workspaces = workspaceState?.workspaces ?? [];
  const currentWorkspace = workspaceState?.currentWorkspace ?? null;
  const activeAffiliateProfiles = affiliateProfiles.filter((profile) => profile.status === "ACTIVE");

  return (
    <div className="stack">
      <SettingsSectionNav />

      <SectionCard
        icon={Users}
        title="Akun Affiliate"
        actions={
          affiliateProfileSchemaMissing ? (
            <StatusBadge status="Schema pending" tone="warning" />
          ) : affiliateProfileLoadError ? (
            <StatusBadge status="Load error" tone="danger" />
          ) : (
            <StatusBadge status={`${activeAffiliateProfiles.length} active`} tone="info" />
          )
        }
      >
        {affiliateProfileSchemaMissing ? (
          <EmptyState icon={Users} title="Affiliate profile schema pending." description={affiliateProfileLoadError ?? "Apply the Sprint 13 migration first."} />
        ) : affiliateProfileLoadError ? (
          <EmptyState icon={Users} title="Affiliate profiles unavailable." description={affiliateProfileLoadError} />
        ) : workspaceError ? (
          <EmptyState icon={Users} title="Workspace schema pending." description={workspaceError} />
        ) : !workspaces.length ? (
          <EmptyState icon={Users} title="Buat workspace dulu." description="Workspace diperlukan." />
        ) : driveItemsError ? (
          <EmptyState icon={Users} title="Drive references unavailable." description={driveItemsError} />
        ) : (
          <AffiliateProfilesBoard
            currentWorkspaceId={currentWorkspace?.id ?? null}
            driveItems={driveItems}
            profileLinks={affiliateProfileLinks}
            profiles={affiliateProfiles}
            workspaces={workspaces}
          />
        )}
      </SectionCard>
    </div>
  );
}
