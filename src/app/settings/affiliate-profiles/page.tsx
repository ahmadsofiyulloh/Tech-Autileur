import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { isAffiliateProfileSchemaMissingError } from "@/lib/affiliate-profiles/schema-errors";
import { AffiliateProfilesBoard, type AffiliateProfileBoardDriveItemRecord } from "./affiliate-profiles-board";
import { resolveAffiliateProfileAvatar } from "@/lib/server/affiliate-profile-avatars";
import {
  listAffiliateProfiles,
  type AffiliateProfileRecord,
} from "@/lib/server/affiliate-profiles";
import { listDriveItems, listDriveItemsByIds, type DriveItemRecord } from "@/lib/server/drive-items";
import { resolveDriveImagePreviewUrl } from "@/lib/server/drive-image-previews";
import { getWorkspaceSelectionState, isWorkspaceSchemaMissingError, type WorkspaceSelectionState } from "@/lib/server/workspaces";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Akun Affiliate tidak tersedia.";
}

function mergeDriveItemsById(items: DriveItemRecord[], extraItems: DriveItemRecord[]) {
  const itemMap = new Map(items.map((item) => [item.id, item]));

  for (const item of extraItems) {
    itemMap.set(item.id, item);
  }

  return Array.from(itemMap.values());
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
  } catch (error) {
    affiliateProfileSchemaMissing = isAffiliateProfileSchemaMissingError(error);
    affiliateProfileLoadError = affiliateProfileSchemaMissing ? "Apply the local Sprint 13 migration before using affiliate profiles." : errorMessage(error);
  }

  try {
    driveItems = (await listDriveItems({ limit: 200 })).filter((item) => item.status !== "ARCHIVED");
  } catch (error) {
    driveItemsError = errorMessage(error);
  }

  try {
    const profileDriveItemRefs = affiliateProfiles.flatMap((profile) => [
      profile.seed_character_drive_item_ref_id,
      profile.environment_drive_item_ref_id,
    ]);
    const profileDriveItems = (await listDriveItemsByIds(profileDriveItemRefs)).filter((item) => item.status !== "ARCHIVED");
    driveItems = mergeDriveItemsById(driveItems, profileDriveItems);
  } catch (error) {
    driveItemsError ??= errorMessage(error);
  }

  const workspaces = (workspaceState?.workspaces ?? []).filter((workspace) => workspace.status !== "ARCHIVED");
  const currentWorkspace = workspaceState?.currentWorkspace ?? null;
  const driveItemMap = new Map(driveItems.map((item) => [item.id, item]));
  const drivePreviewUrlCache = new Map<string, string | null>();
  const driveItemsWithPreview: AffiliateProfileBoardDriveItemRecord[] = driveItems.map((item) => ({
    ...item,
    previewUrl: resolveDriveImagePreviewUrl(item, drivePreviewUrlCache),
  }));
  const affiliateProfilesWithAvatars = await Promise.all(
    affiliateProfiles.map((profile) => ({
      ...profile,
      avatarUrl: resolveAffiliateProfileAvatar(profile, driveItemMap),
    })),
  );

  return (
    <div className="stack settings-page-body">
      {affiliateProfileSchemaMissing ? (
        <EmptyState icon={Users} title="Affiliate profile schema pending." description={affiliateProfileLoadError ?? "Apply the Sprint 13 migration first."} />
      ) : affiliateProfileLoadError ? (
        <EmptyState icon={Users} title="Affiliate profiles unavailable." description={affiliateProfileLoadError} />
      ) : workspaceError ? (
        <EmptyState icon={Users} title="Workspace schema pending." description={workspaceError} />
      ) : driveItemsError ? (
        <EmptyState icon={Users} title="Drive references unavailable." description={driveItemsError} />
      ) : (
        <AffiliateProfilesBoard
          currentWorkspaceId={currentWorkspace?.id ?? null}
          driveItems={driveItemsWithPreview}
          profiles={affiliateProfilesWithAvatars}
          workspaces={workspaces}
        />
      )}
    </div>
  );
}
