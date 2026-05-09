import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDefaultAffiliateProfileForWorkspace } from "@/lib/server/affiliate-profiles";
import { resolveAffiliateProfileAvatar } from "@/lib/server/affiliate-profile-avatars";
import { listDriveItems } from "@/lib/server/drive-items";
import { getWorkspaceSelectionState } from "@/lib/server/workspaces";
import type { OperatorShellContext } from "@/components/operator/operator-shell-context";

export async function getOperatorShellContext(): Promise<OperatorShellContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { currentAffiliateProfile: null };
  }

  try {
    const workspaceState = await getWorkspaceSelectionState();
    const workspaceId = workspaceState.currentWorkspace?.id ?? null;

    if (!workspaceId) {
      return { currentAffiliateProfile: null };
    }

    const currentAffiliateProfile = await getDefaultAffiliateProfileForWorkspace(workspaceId);

    if (!currentAffiliateProfile) {
      return { currentAffiliateProfile: null };
    }

    const driveItems = (await listDriveItems({ limit: 200 })).filter((item) => item.status !== "ARCHIVED");
    const driveItemMap = new Map(driveItems.map((item) => [item.id, item]));

    return {
      currentAffiliateProfile: {
        id: currentAffiliateProfile.id,
        profileName: currentAffiliateProfile.profile_name,
        avatarUrl: resolveAffiliateProfileAvatar(currentAffiliateProfile, driveItemMap),
      },
    };
  } catch {
    return { currentAffiliateProfile: null };
  }
}
