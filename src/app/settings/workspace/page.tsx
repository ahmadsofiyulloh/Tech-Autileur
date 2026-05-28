import { redirect } from "next/navigation";
import { FolderKanban } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { WorkspaceSettingsBoard } from "./workspace-settings-board";
import { getWorkspaceSelectionState, isWorkspaceSchemaMissingError, type WorkspaceSelectionState } from "@/lib/server/workspaces";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const revalidate = 300;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Workspace tidak tersedia.";
}

export default async function WorkspaceSettingsPage() {
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
      isWorkspaceSchemaMissingError(error) ? "Apply the local Sprint 12B migration before using workspace profiles." : errorMessage(error);
  }

  const workspaces = workspaceState?.workspaces ?? [];
  const currentWorkspace = workspaceState?.currentWorkspace ?? null;

  return (
    <div className="stack settings-page-body">
      {workspaceError ? (
        <EmptyState icon={FolderKanban} title="Workspace schema pending." description={workspaceError} />
      ) : (
        <WorkspaceSettingsBoard
          currentWorkspaceId={currentWorkspace?.id ?? null}
          workspaces={workspaces}
        />
      )}
    </div>
  );
}
