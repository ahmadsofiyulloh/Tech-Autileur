import { redirect } from "next/navigation";
import { Inbox } from "lucide-react";
import { IntakeWorkflowForm } from "./intake-workflow-form";
import { EmptyState } from "@/components/operator/empty-state";
import { PwaInstallCard } from "@/components/operator/pwa-install-card";
import { SectionCard } from "@/components/operator/section-card";
import { listAffiliateProfiles } from "@/lib/server/affiliate-profiles";
import { resolveAffiliateProfileAvatar } from "@/lib/server/affiliate-profile-avatars";
import { listDriveItems } from "@/lib/server/drive-items";
import { getIntakeSessionById } from "@/lib/server/intake";
import { getCurrentWorkspace, listWorkspaces } from "@/lib/server/workspaces";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type NewProductPageProps = {
  searchParams: Promise<{
    intake_id?: string | string[];
    step?: string | string[];
    workspace?: string | string[];
    affiliate_profile_id?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function workspaceLabel(workspaceId: string | null, workspaceMap: Map<string, { workspace_code: string; workspace_name: string }>) {
  if (!workspaceId) {
    return "Unassigned";
  }

  const workspace = workspaceMap.get(workspaceId);
  return workspace ? workspace.workspace_name : "Workspace unavailable";
}

export default async function NewProductPage({ searchParams }: NewProductPageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const query = await searchParams;
  const showAllWorkspaces = firstParam(query.workspace) === "all";
  const requestedStep = firstParam(query.step);
  const intakeId = firstParam(query.intake_id);
  const requestedAffiliateProfileId = firstParam(query.affiliate_profile_id) ?? null;
  let selectedSession: Awaited<ReturnType<typeof getIntakeSessionById>> | null = null;
  let currentWorkspace: Awaited<ReturnType<typeof getCurrentWorkspace>>;
  let workspaces: Awaited<ReturnType<typeof listWorkspaces>>;
  let affiliateProfiles: Awaited<ReturnType<typeof listAffiliateProfiles>> = [];
  let driveItems: Awaited<ReturnType<typeof listDriveItems>> = [];

  try {
    [currentWorkspace, selectedSession, workspaces] = await Promise.all([
      getCurrentWorkspace(),
      intakeId ? getIntakeSessionById(intakeId) : Promise.resolve(null),
      listWorkspaces({ limit: 200 }),
    ]);

    affiliateProfiles = await listAffiliateProfiles({
      workspaceId: currentWorkspace?.id ?? undefined,
      status: "ACTIVE",
      limit: 50,
    });
    driveItems = await listDriveItems({ limit: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load intake.";

    return (
      <SectionCard icon={Inbox} title="Unable to load intake." description={message}>
        <EmptyState icon={Inbox} title="Intake unavailable." description="Try again." />
      </SectionCard>
    );
  }

  const visibleWorkspaces = workspaces.filter((workspace) => workspace.status !== "ARCHIVED");
  const visibleDriveItems = driveItems.filter((item) => item.status !== "ARCHIVED");
  const workspaceMap = new Map(visibleWorkspaces.map((workspace) => [workspace.id, workspace]));
  const driveItemMap = new Map(visibleDriveItems.map((item) => [item.id, item]));
  const affiliateProfilesWithAvatars = await Promise.all(
    affiliateProfiles.map((profile) => ({
      id: profile.id,
      profile_name: profile.profile_name,
      account_label: profile.account_label,
      avatarUrl: resolveAffiliateProfileAvatar(profile, driveItemMap),
      niche: profile.niche,
      platform: profile.platform,
      status: profile.status,
    })),
  );
  const initialStep = requestedStep === "prompt" && selectedSession ? "prompt" : "intake";
  const savedSessionWorkspaceName = selectedSession ? workspaceLabel(selectedSession.workspace_id, workspaceMap) : null;
  const selectedAffiliateProfileId =
    requestedAffiliateProfileId && affiliateProfiles.some((profile) => profile.id === requestedAffiliateProfileId)
      ? requestedAffiliateProfileId
      : affiliateProfiles[0]?.id ?? null;

  return (
    <div className="stack intake-native-page">
      <PwaInstallCard />
      <section className="intake-native-surface" aria-label="Workflow intake produk">
        <IntakeWorkflowForm
          affiliateProfiles={affiliateProfilesWithAvatars}
          currentWorkspaceName={currentWorkspace?.workspace_name ?? null}
          initialStep={initialStep}
          savedSession={selectedSession}
          savedSessionWorkspaceName={savedSessionWorkspaceName}
          selectedAffiliateProfileId={selectedAffiliateProfileId}
          showAllWorkspaces={showAllWorkspaces}
        />
      </section>
    </div>
  );
}
