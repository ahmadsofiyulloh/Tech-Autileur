import { redirect } from "next/navigation";
import { FolderKanban } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { FormActions } from "@/components/operator/form-actions";
import { RelationalPicker } from "@/components/operator/relational-picker";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { SettingsSectionNav } from "../settings-section-nav";
import { saveWorkspace } from "../actions";
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
  const activeWorkspaces = workspaces.filter((workspace) => workspace.status === "ACTIVE");
  const currentWorkspace = workspaceState?.currentWorkspace ?? null;
  const workspacePickerOptions = activeWorkspaces.map((workspace) =>
    pickerOption(
      workspace.id,
      workspace.workspace_name,
      [workspace.workspace_code, workspace.is_default ? "default" : null].filter(Boolean).join(" - "),
    ),
  );

  return (
    <div className="stack">
      <SettingsSectionNav />

      <SectionCard
        icon={FolderKanban}
        title="Workspace"
        actions={currentWorkspace ? <StatusBadge status={`Aktif: ${currentWorkspace.workspace_name}`} tone="success" /> : null}
      >
        {workspaceError ? (
          <EmptyState icon={FolderKanban} title="Workspace schema pending." description={workspaceError} />
        ) : (
          <div className="stack">
            <form className="stack" action={saveWorkspace}>
              <input type="hidden" name="intent" value="set_current_workspace" />
              <input type="hidden" name="return_to" value="/settings/workspace" />
              <RelationalPicker
                allowClear
                defaultValue={currentWorkspace?.id ?? ""}
                disabled={!activeWorkspaces.length}
                emptyLabel="Belum ada workspace"
                label="Workspace aktif"
                name="current_workspace_id"
                options={workspacePickerOptions}
                placeholder="Pilih workspace"
                searchPlaceholder="Cari workspace"
                submitOnSelect
              />
              <FormActions>
                <button className="button primary" type="submit" disabled={!activeWorkspaces.length}>
                  Simpan aktif
                </button>
              </FormActions>
            </form>

            <details open={!workspaces.length}>
              <summary>Buat workspace</summary>
              <form className="stack" action={saveWorkspace}>
                <input type="hidden" name="intent" value="create_workspace" />
                <input type="hidden" name="return_to" value="/settings/workspace" />
                <div className="grid two-up">
                  <label className="stack auth-field" htmlFor="workspace-name">
                    <span>Nama Ruang Kerja</span>
                    <input id="workspace-name" name="workspace_name" type="text" placeholder="Fashion Men" required />
                  </label>
                  <label className="stack auth-field" htmlFor="workspace-drive-url">
                    <span>Folder Drive Utama</span>
                    <input id="workspace-drive-url" name="drive_root_folder_url" type="url" placeholder="https://..." />
                  </label>
                </div>
                <details>
                  <summary>Lanjutan</summary>
                  <div className="stack">
                    <label className="stack auth-field" htmlFor="workspace-code">
                      <span>Kode Ruang Kerja</span>
                      <input id="workspace-code" name="workspace_code" type="text" placeholder="Otomatis dari nama" />
                    </label>
                    <div className="grid two-up">
                      <RelationalPicker
                        allowClear
                        defaultValue=""
                        label="Folder Drive ref"
                        name="drive_root_folder_ref_id"
                        options={driveFolderPickerOptions}
                        placeholder="Pilih folder Drive"
                        searchPlaceholder="Cari folder"
                      />
                      <label className="stack auth-field" htmlFor="workspace-drive-path">
                        <span>Drive path</span>
                        <input id="workspace-drive-path" name="drive_root_folder_path" type="text" placeholder="/AffiliateAI/WORKSPACES/FASHION_MEN" />
                      </label>
                    </div>
                    <div className="grid two-up">
                      <label className="stack auth-field" htmlFor="workspace-niche">
                        <span>Niche</span>
                        <input id="workspace-niche" name="niche" type="text" placeholder="Optional niche" />
                      </label>
                      <label className="stack auth-field" htmlFor="workspace-notes">
                        <span>Catatan</span>
                        <textarea id="workspace-notes" name="notes" rows={3} placeholder="Operator notes" />
                      </label>
                    </div>
                    <label className="checkbox-row" htmlFor="workspace-is-default">
                      <input id="workspace-is-default" name="is_default" type="checkbox" />
                      <span>Jadikan default</span>
                    </label>
                  </div>
                </details>
                <FormActions>
                  <button className="button primary" type="submit">
                    Buat workspace
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
                          {[workspace.drive_root_folder_url, workspace.drive_root_folder_path].filter(Boolean).join(" - ") ||
                            "Folder Drive utama belum diisi."}
                        </span>
                        <div className="section-card__actions">
                          <StatusBadge status={workspace.status} />
                          {workspace.is_default ? <StatusBadge status="Default" tone="success" /> : null}
                          {isCurrent ? <StatusBadge status="Aktif" tone="info" /> : null}
                        </div>
                      </div>
                      <div className="section-card__actions">
                        <form action={saveWorkspace}>
                          <input type="hidden" name="intent" value="set_current_workspace" />
                          <input type="hidden" name="return_to" value="/settings/workspace" />
                          <input type="hidden" name="current_workspace_id" value={workspace.id} />
                          <button className="button compact" type="submit" disabled={!isActive || isCurrent}>
                            Aktifkan
                          </button>
                        </form>
                        <form action={saveWorkspace}>
                          <input type="hidden" name="intent" value="set_default_workspace" />
                          <input type="hidden" name="return_to" value="/settings/workspace" />
                          <input type="hidden" name="id" value={workspace.id} />
                          <button className="button compact" type="submit" disabled={!isActive || workspace.is_default}>
                            Default
                          </button>
                        </form>
                        <form action={saveWorkspace}>
                          <input type="hidden" name="intent" value="archive_workspace" />
                          <input type="hidden" name="return_to" value="/settings/workspace" />
                          <input type="hidden" name="id" value={workspace.id} />
                          <button className="button compact" type="submit" disabled={!isActive}>
                            Arsipkan
                          </button>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState icon={FolderKanban} title="Belum ada workspace." description="Buat workspace pertama." />
            )}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
