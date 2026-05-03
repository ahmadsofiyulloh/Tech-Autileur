import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileText, Inbox, Link2, Package } from "lucide-react";
import { IntakeWorkflowForm } from "./intake-workflow-form";
import { EmptyState } from "@/components/operator/empty-state";
import { PageHeader } from "@/components/operator/page-header";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { listIntakeSessions } from "@/lib/server/intake";
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
  }>;
};

function fieldValue(value: string | number | null | undefined) {
  return value ?? "Not set";
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function workspaceLabel(workspaceId: string | null, workspaceMap: Map<string, { workspace_code: string; workspace_name: string }>) {
  if (!workspaceId) {
    return "Unassigned";
  }

  const workspace = workspaceMap.get(workspaceId);
  return workspace ? `${workspace.workspace_code} - ${workspace.workspace_name}` : "Workspace unavailable";
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
  let sessions;
  let currentWorkspace;
  let workspaces;

  try {
    currentWorkspace = await getCurrentWorkspace();
    [sessions, workspaces] = await Promise.all([
      listIntakeSessions({
        limit: 20,
        workspaceId: currentWorkspace && !showAllWorkspaces ? currentWorkspace.id : undefined,
      }),
      listWorkspaces({ limit: 200 }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load intake.";

    return (
      <SectionCard icon={Inbox} badge="Error" title="Unable to load intake." description={message}>
        <EmptyState icon={Inbox} title="Intake unavailable." description="Try again." />
      </SectionCard>
    );
  }

  const workspaceMap = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
  const scopeLabel = currentWorkspace && !showAllWorkspaces ? currentWorkspace.workspace_name : "Semua workspace";
  const linkedCount = sessions.filter((session) => session.product_id).length;
  const requestedStep = firstParam(query.step);
  const intakeId = firstParam(query.intake_id);
  let selectedSession = intakeId ? sessions.find((session) => session.id === intakeId) ?? null : null;

  if (!selectedSession && requestedStep === "prompt") {
    selectedSession = sessions[0] ?? null;
  }

  const initialStep = requestedStep === "prompt" && selectedSession ? "prompt" : "intake";
  const message = firstParam(query.message) ?? null;
  const errorMessage = firstParam(query.error) ?? null;
  const savedSessionWorkspaceName = selectedSession ? workspaceLabel(selectedSession.workspace_id, workspaceMap) : null;

  return (
    <div className="stack">
      <PageHeader
        icon={Inbox}
        badge="Intake produk"
        title="Intake Produk Baru"
        description={`Lingkup: ${scopeLabel}.`}
        actions={
          <>
            {currentWorkspace ? (
              <Link className="button" href={showAllWorkspaces ? "/products/new" : "/products/new?workspace=all"}>
                {showAllWorkspaces ? "Workspace aktif" : "Semua workspace"}
              </Link>
            ) : null}
            <Link className="button" href="/products">
              <ArrowLeft size={16} aria-hidden="true" />
              Produk
            </Link>
          </>
        }
        stats={[
          { label: "Lingkup", value: scopeLabel },
          { label: "Intake terbaru", value: sessions.length },
          { label: "Tertaut", value: linkedCount },
          { label: "Pratinjau", value: "Lokal" },
        ]}
      />

      <SectionCard
        icon={Inbox}
        badge="Baru"
        title="Workflow intake produk"
      >
        <IntakeWorkflowForm
          currentWorkspaceName={currentWorkspace?.workspace_name ?? null}
          errorMessage={errorMessage}
          initialStep={initialStep}
          message={message}
          savedSession={selectedSession}
          savedSessionWorkspaceName={savedSessionWorkspaceName}
          showAllWorkspaces={showAllWorkspaces}
        />
      </SectionCard>

      <SectionCard icon={Package} title="Intake terbaru">
        {sessions.length ? (
          <ul className="list">
            {sessions.slice(0, 5).map((session) => (
              <li key={session.id}>
                <div className="stack-tight">
                  <strong>{fieldValue(session.product_title)}</strong>
                  <span className="subtle">
                    {[session.shopee_url ? "Shopee" : null, session.tiktok_url ? "TikTok" : null, session.intake_code]
                      .filter(Boolean)
                      .join(" - ")}
                  </span>
                </div>
                <div className="section-card__actions">
                  <StatusBadge status={session.status} />
                  <Link
                    className="button compact"
                    href={`/products/new?step=prompt&intake_id=${session.id}${showAllWorkspaces ? "&workspace=all" : ""}`}
                  >
                    <FileText size={15} aria-hidden="true" />
                    Review
                  </Link>
                  {session.product_id ? (
                    <Link className="button compact" href={`/products/${session.product_id}`}>
                      <Link2 size={15} aria-hidden="true" />
                      Produk
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={Inbox}
            title={currentWorkspace && !showAllWorkspaces ? "Belum ada intake di workspace ini." : "Belum ada intake."}
            description={currentWorkspace && !showAllWorkspaces ? "Coba semua workspace." : "Unggah evidence."}
          />
        )}
      </SectionCard>
    </div>
  );
}
