import { redirect } from "next/navigation";
import { FolderKanban } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { WorkspaceSettingsBoard } from "./workspace-settings-board";
import { listDriveItems } from "@/lib/server/drive-items";
import { getWorkspaceSelectionState, isWorkspaceSchemaMissingError, type WorkspaceSelectionState } from "@/lib/server/workspaces";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Workspace tidak tersedia.";
}

function pickerOption(value: string, label: string, description?: string | null) {
  return {
    value,
    label,
    ...(description ? { description } : {}),
  };
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
  const driveFolderPickerOptions: Array<{ value: string; label: string; description?: string }> = [];

  try {
    workspaceState = await getWorkspaceSelectionState();
  } catch (error) {
    workspaceError =
      isWorkspaceSchemaMissingError(error) ? "Apply the local Sprint 12B migration before using workspace profiles." : errorMessage(error);
  }

  try {
    const driveItems = await listDriveItems({ limit: 200 });
    driveFolderPickerOptions.push(
      ...driveItems
        .filter((item) => item.item_type === "FOLDER")
        .map((item) => pickerOption(item.id, item.name, [item.purpose, item.drive_path].filter(Boolean).join(" - "))),
    );
  } catch {
    // Drive references are optional for workspace editing.
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
          driveFolderOptions={driveFolderPickerOptions}
          workspaces={workspaces}
        />
      )}
    </div>
  );
}
