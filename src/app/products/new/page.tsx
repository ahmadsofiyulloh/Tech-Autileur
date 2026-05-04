import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Inbox } from "lucide-react";
import { IntakeWorkflowForm } from "./intake-workflow-form";
import { EmptyState } from "@/components/operator/empty-state";
import { SectionCard } from "@/components/operator/section-card";
import { listAffiliateProfiles } from "@/lib/server/affiliate-profiles";
import { getIntakeSessionById } from "@/lib/server/intake";
import { getCurrentWorkspace, listWorkspaces } from "@/lib/server/workspaces";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type NewProductPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    intake_id?: string | string[];
    message?: string | string[];
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load intake.";

    return (
      <SectionCard icon={Inbox} title="Unable to load intake." description={message}>
        <EmptyState icon={Inbox} title="Intake unavailable." description="Try again." />
      </SectionCard>
    );
  }

  const workspaceMap = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
  const scopeLabel = currentWorkspace && !showAllWorkspaces ? currentWorkspace.workspace_name : "Semua workspace";
  const initialStep = requestedStep === "prompt" && selectedSession ? "prompt" : "intake";
  const message = firstParam(query.message) ?? null;
  const errorMessage = firstParam(query.error) ?? null;
  const savedSessionWorkspaceName = selectedSession ? workspaceLabel(selectedSession.workspace_id, workspaceMap) : null;
  const selectedAffiliateProfileId =
    requestedAffiliateProfileId && affiliateProfiles.some((profile) => profile.id === requestedAffiliateProfileId)
      ? requestedAffiliateProfileId
      : affiliateProfiles[0]?.id ?? null;

  return (
    <div className="stack intake-native-page">
      <div className="intake-native-header">
        <div className="stack-tight">
          <h2>Intake Workflow</h2>
          <p>Upload dan analisis</p>
        </div>
        <div className="intake-scope-row">
          <span className="intake-scope-chip">Lingkup: {scopeLabel}</span>
          {currentWorkspace ? (
            <Link className="button compact intake-secondary-link" href={showAllWorkspaces ? "/products/new" : "/products/new?workspace=all"}>
              {showAllWorkspaces ? "Workspace aktif" : "Semua workspace"}
            </Link>
          ) : null}
          <Link className="button compact intake-secondary-link" href="/products">
            <ArrowLeft size={15} aria-hidden="true" />
            Produk
          </Link>
        </div>
      </div>

      <section className="intake-native-surface" aria-label="Workflow intake produk">
        <IntakeWorkflowForm
          affiliateProfiles={affiliateProfiles.map((profile) => ({
            id: profile.id,
            profile_name: profile.profile_name,
            account_label: profile.account_label,
            platform: profile.platform,
            status: profile.status,
          }))}
          currentWorkspaceName={currentWorkspace?.workspace_name ?? null}
          errorMessage={errorMessage}
          initialStep={initialStep}
          message={message}
          savedSession={selectedSession}
          savedSessionWorkspaceName={savedSessionWorkspaceName}
          selectedAffiliateProfileId={selectedAffiliateProfileId}
          showAllWorkspaces={showAllWorkspaces}
        />
      </section>
    </div>
  );
}
