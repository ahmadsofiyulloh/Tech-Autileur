import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  FolderKanban,
  HardDrive,
  KeyRound,
  LogOut,
  Settings,
  SlidersHorizontal,
  UserRound,
  Users,
  Workflow,
} from "lucide-react";
import { saveWorkspace } from "./actions";
import { EmptyState } from "@/components/operator/empty-state";
import { FormActions } from "@/components/operator/form-actions";
import { PageHeader } from "@/components/operator/page-header";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { getWorkspaceSelectionState, isWorkspaceSchemaMissingError, type WorkspaceSelectionState } from "@/lib/server/workspaces";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to load workspaces.";
}

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let workspaceState: WorkspaceSelectionState | null = null;
  let workspaceError: string | null = null;

  try {
    workspaceState = await getWorkspaceSelectionState();
  } catch (error) {
    workspaceError =
      isWorkspaceSchemaMissingError(error) ?
        "Apply the local Sprint 12B migration before using workspace profiles."
      : errorMessage(error);
  }

  const workspaces = workspaceState?.workspaces ?? [];
  const activeWorkspaces = workspaces.filter((workspace) => workspace.status === "ACTIVE");
  const currentWorkspace = workspaceState?.currentWorkspace ?? null;

  return (
    <div className="stack">
      <PageHeader
        icon={Settings}
        badge="Config"
        title="Settings"
        description="Configuration hub for workspace placeholders, services, tools, profiles, and account."
        stats={[
          { label: "Workspaces", value: workspaceError ? <StatusBadge status="Pending" tone="warning" /> : workspaces.length },
          { label: "Gemini", value: <StatusBadge status="Active" tone="success" /> },
          { label: "Drive", value: <StatusBadge status="Ready" tone="success" /> },
          { label: "Owner", value: user.email ?? "Signed in" },
        ]}
      />

      <section className="grid two-up">
        <SectionCard
          icon={FolderKanban}
          title="Workspace Profiles"
          description="Persistent profile foundation. Filtering lands later."
          actions={currentWorkspace ? <StatusBadge status={`Current: ${currentWorkspace.workspace_code}`} tone="success" /> : null}
        >
          {workspaceError ? (
            <EmptyState icon={FolderKanban} title="Workspace schema pending." description={workspaceError} />
          ) : (
            <div className="stack">
              <form className="stack" action={saveWorkspace}>
                <input type="hidden" name="intent" value="set_current_workspace" />
                <label className="stack auth-field" htmlFor="current-workspace-id">
                  <span>Current workspace/profile</span>
                  <select id="current-workspace-id" name="current_workspace_id" defaultValue={currentWorkspace?.id ?? ""}>
                    <option value="">No workspace</option>
                    {activeWorkspaces.map((workspace) => (
                      <option key={workspace.id} value={workspace.id}>
                        {workspace.workspace_name}
                        {workspace.is_default ? " (default)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <FormActions>
                  <button className="button primary" type="submit" disabled={!activeWorkspaces.length}>
                    Save current
                  </button>
                </FormActions>
              </form>

              <details>
                <summary>Create workspace</summary>
                <form className="stack" action={saveWorkspace}>
                  <input type="hidden" name="intent" value="create_workspace" />
                  <div className="grid two-up">
                    <label className="stack auth-field" htmlFor="workspace-code">
                      <span>Workspace code</span>
                      <input id="workspace-code" name="workspace_code" type="text" placeholder="FASHION_MEN" required />
                    </label>
                    <label className="stack auth-field" htmlFor="workspace-name">
                      <span>Workspace name</span>
                      <input id="workspace-name" name="workspace_name" type="text" placeholder="Fashion Men" required />
                    </label>
                  </div>
                  <label className="stack auth-field" htmlFor="workspace-niche">
                    <span>Niche</span>
                    <input id="workspace-niche" name="niche" type="text" placeholder="Optional niche grouping" />
                  </label>
                  <div className="grid two-up">
                    <label className="stack auth-field" htmlFor="workspace-drive-ref">
                      <span>Drive root folder row id</span>
                      <input id="workspace-drive-ref" name="drive_root_folder_ref_id" type="text" placeholder="Optional Drive item row id" />
                    </label>
                    <label className="stack auth-field" htmlFor="workspace-drive-url">
                      <span>Drive root folder URL</span>
                      <input id="workspace-drive-url" name="drive_root_folder_url" type="url" placeholder="https://..." />
                    </label>
                  </div>
                  <label className="stack auth-field" htmlFor="workspace-drive-path">
                    <span>Drive root folder path</span>
                    <input id="workspace-drive-path" name="drive_root_folder_path" type="text" placeholder="/AffiliateAI/WORKSPACES/FASHION_MEN" />
                  </label>
                  <label className="stack auth-field" htmlFor="workspace-notes">
                    <span>Notes</span>
                    <textarea id="workspace-notes" name="notes" rows={3} placeholder="Operator notes" />
                  </label>
                  <label className="checkbox-row" htmlFor="workspace-is-default">
                    <input id="workspace-is-default" name="is_default" type="checkbox" />
                    <span>Make default workspace</span>
                  </label>
                  <p className="subtle">This only persists workspace/profile state. It does not filter products yet.</p>
                  <FormActions>
                    <button className="button primary" type="submit">
                      Create workspace
                    </button>
                  </FormActions>
                </form>
              </details>

              {workspaces.length ? (
                <ul className="list">
                  {workspaces.map((workspace) => {
                    const isCurrent = currentWorkspace?.id === workspace.id;
                    const isActive = workspace.status === "ACTIVE";

                    return (
                      <li key={workspace.id}>
                        <div className="stack-tight">
                          <strong>{workspace.workspace_name}</strong>
                          <span className="subtle">
                            {[workspace.workspace_code, workspace.niche, workspace.drive_root_folder_path].filter(Boolean).join(" - ") ||
                              "No niche or Drive root set."}
                          </span>
                          <div className="section-card__actions">
                            <StatusBadge status={workspace.status} />
                            {workspace.is_default ? <StatusBadge status="Default" tone="success" /> : null}
                            {isCurrent ? <StatusBadge status="Current" tone="info" /> : null}
                          </div>
                        </div>
                        <div className="section-card__actions">
                          <form action={saveWorkspace}>
                            <input type="hidden" name="intent" value="set_current_workspace" />
                            <input type="hidden" name="current_workspace_id" value={workspace.id} />
                            <button className="button compact" type="submit" disabled={!isActive || isCurrent}>
                              Use current
                            </button>
                          </form>
                          <form action={saveWorkspace}>
                            <input type="hidden" name="intent" value="set_default_workspace" />
                            <input type="hidden" name="id" value={workspace.id} />
                            <button className="button compact" type="submit" disabled={!isActive || workspace.is_default}>
                              Set default
                            </button>
                          </form>
                          <form action={saveWorkspace}>
                            <input type="hidden" name="intent" value="archive_workspace" />
                            <input type="hidden" name="id" value={workspace.id} />
                            <button className="button compact" type="submit" disabled={!isActive}>
                              Archive
                            </button>
                          </form>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState icon={FolderKanban} title="No workspace." description="Create one when you are ready to organize products by profile." />
              )}
            </div>
          )}
        </SectionCard>

        <SectionCard
          icon={KeyRound}
          title="Gemini"
          description="Keys, models, and roles."
          actions={
            <Link className="button primary" href="/gemini">
              <ArrowRight size={16} aria-hidden="true" />
              Open
            </Link>
          }
        >
          <StatusBadge status="Configured here" tone="info" />
        </SectionCard>

        <SectionCard
          icon={HardDrive}
          title="Drive"
          description="Folders, files, and links."
          actions={
            <Link className="button primary" href="/drive">
              <ArrowRight size={16} aria-hidden="true" />
              Open
            </Link>
          }
        >
          <StatusBadge status="Configured here" tone="info" />
        </SectionCard>

        <SectionCard icon={Workflow} title="Flow Accounts / Tools" description="Global execution tools, not workspace-bound.">
          <EmptyState
            icon={Workflow}
            title="Reserved for dynamic Flow tools."
            description="Flow accounts stay global per user and can execute prompts from any workspace or product."
          />
        </SectionCard>

        <SectionCard icon={Users} title="Affiliate Profiles" description="Placeholder only.">
          <EmptyState
            icon={Users}
            title="Reserved for dynamic affiliate profiles."
            description="Profiles must not be hardcoded. Workspace context will use these later."
          />
        </SectionCard>

        <SectionCard icon={SlidersHorizontal} title="Prompt Personalization" description="Placeholder only.">
          <EmptyState
            icon={SlidersHorizontal}
            title="Reserved for editable prompt rules."
            description="Seed character locks, environment locks, and prompt rule fields come after schema approval."
          />
        </SectionCard>

        <SectionCard icon={UserRound} title="Account" description={user.email ?? "Signed in"}>
          <FormActions>
            <form action="/auth/signout" method="post">
              <button className="button" type="submit">
                <LogOut size={16} aria-hidden="true" />
                Sign out
              </button>
            </form>
          </FormActions>
        </SectionCard>
      </section>
    </div>
  );
}
