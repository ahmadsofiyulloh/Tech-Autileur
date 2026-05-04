"use client";

import { Archive, FolderKanban, Plus, Save, Settings2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/operator/empty-state";
import { FormActions } from "@/components/operator/form-actions";
import { RelationalPicker } from "@/components/operator/relational-picker";
import { SettingsBottomSheet } from "@/components/operator/settings-bottom-sheet";
import { StatusBadge } from "@/components/operator/status-badge";
import { saveWorkspace } from "../actions";
import { WORKSPACE_STATUSES } from "@/lib/workspaces/validation";

type WorkspaceRecord = {
  id: string;
  workspace_code: string;
  workspace_name: string;
  niche: string | null;
  drive_root_folder_ref_id: string | null;
  drive_root_folder_url: string | null;
  drive_root_folder_path: string | null;
  status: string;
  is_default: boolean;
};

type DriveFolderOption = {
  value: string;
  label: string;
  description?: string;
};

type WorkspaceSettingsBoardProps = {
  workspaces: WorkspaceRecord[];
  currentWorkspaceId: string | null;
  driveFolderOptions: DriveFolderOption[];
};

type SheetMode = { type: "create" } | { type: "edit"; workspaceId: string };

function pickerOptions(values: readonly string[]) {
  return values.map((value) => ({
    value,
    label: value,
  }));
}

function fieldValue(value: string | null | undefined) {
  return value ?? "";
}

function workspaceDetail(workspace: WorkspaceRecord) {
  return [workspace.drive_root_folder_url, workspace.drive_root_folder_path].filter(Boolean).join(" - ") || "Folder Drive utama belum diisi.";
}

export function WorkspaceSettingsBoard({ workspaces, currentWorkspaceId, driveFolderOptions }: WorkspaceSettingsBoardProps) {
  const [sheetMode, setSheetMode] = useState<SheetMode | null>(() => (workspaces.length ? null : { type: "create" }));

  const currentWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === currentWorkspaceId) ?? null,
    [currentWorkspaceId, workspaces],
  );
  const selectedWorkspace =
    sheetMode?.type === "edit" ? workspaces.find((workspace) => workspace.id === sheetMode.workspaceId) ?? null : null;
  const isCreating = sheetMode?.type === "create";

  useEffect(() => {
    if (!workspaces.length && sheetMode?.type !== "create") {
      setSheetMode({ type: "create" });
      return;
    }

    if (workspaces.length && sheetMode?.type === "edit" && !workspaces.some((workspace) => workspace.id === sheetMode.workspaceId)) {
      setSheetMode(null);
    }
  }, [sheetMode, workspaces]);

  const sheetWorkspace = selectedWorkspace;
  const sheetTitle = isCreating ? "Buat workspace" : sheetWorkspace?.workspace_name ?? "Workspace";
  const sheetDescription = isCreating
    ? "Buat ruang kerja baru untuk workspace aktif."
    : sheetWorkspace
      ? `${sheetWorkspace.workspace_code} - ${workspaceDetail(sheetWorkspace)}`
      : "Pilih workspace untuk diedit.";
  const sheetActions = sheetWorkspace ? (
    <div className="section-card__actions">
      <StatusBadge status={sheetWorkspace.status} />
      {sheetWorkspace.is_default ? <StatusBadge status="Default" tone="success" /> : null}
      {currentWorkspaceId === sheetWorkspace.id ? <StatusBadge status="Aktif" tone="info" /> : null}
      {sheetWorkspace.drive_root_folder_ref_id ? <StatusBadge status="Drive siap" tone="success" /> : <StatusBadge status="Drive belum ada" tone="warning" />}
    </div>
  ) : null;

  return (
    <section className="stack">
      <div className="section-card__actions">
        {currentWorkspace ? (
          <StatusBadge status={`Aktif: ${currentWorkspace.workspace_name}`} tone="success" />
        ) : (
          <StatusBadge status="Belum ada workspace aktif" tone="warning" />
        )}
        <button className="button compact primary" type="button" onClick={() => setSheetMode({ type: "create" })}>
          <Plus size={15} aria-hidden="true" />
          Workspace baru
        </button>
      </div>

      {workspaces.length ? (
        <ul className="list">
          {workspaces.map((workspace) => (
            <li key={workspace.id}>
              <div className="stack-tight">
                <strong>{workspace.workspace_name}</strong>
                <span className="subtle">{workspace.workspace_code}</span>
                <span className="subtle">{workspaceDetail(workspace)}</span>
                <div className="section-card__actions">
                  <StatusBadge status={workspace.status} />
                  {workspace.is_default ? <StatusBadge status="Default" tone="success" /> : null}
                  {currentWorkspaceId === workspace.id ? <StatusBadge status="Aktif" tone="info" /> : null}
                  {workspace.drive_root_folder_ref_id ? <StatusBadge status="Drive siap" tone="success" /> : <StatusBadge status="Drive belum ada" tone="warning" />}
                </div>
              </div>
              <button className="button compact primary" type="button" onClick={() => setSheetMode({ type: "edit", workspaceId: workspace.id })}>
                <Settings2 size={15} aria-hidden="true" />
                Kelola
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={FolderKanban} title="Belum ada workspace." description="Buat workspace pertama dari bottom sheet." />
      )}

      <SettingsBottomSheet
        actions={sheetActions}
        description={sheetDescription}
        onClose={() => setSheetMode(null)}
        open={sheetMode !== null}
        title={sheetTitle}
      >
        {isCreating ? (
          <WorkspaceForm
            currentWorkspaceId={currentWorkspaceId}
            driveFolderOptions={driveFolderOptions}
            onCancel={() => setSheetMode(null)}
            workspace={null}
          />
        ) : sheetWorkspace ? (
          <WorkspaceForm
            currentWorkspaceId={currentWorkspaceId}
            driveFolderOptions={driveFolderOptions}
            onCancel={() => setSheetMode(null)}
            workspace={sheetWorkspace}
          />
        ) : null}
      </SettingsBottomSheet>
    </section>
  );
}

function WorkspaceForm({
  driveFolderOptions,
  currentWorkspaceId,
  workspace,
  onCancel,
}: {
  driveFolderOptions: DriveFolderOption[];
  currentWorkspaceId: string | null;
  workspace: WorkspaceRecord | null;
  onCancel: () => void;
}) {
  const isEdit = Boolean(workspace);
  const isActive = workspace?.status === "ACTIVE";
  const isCurrent = currentWorkspaceId === workspace?.id;

  return (
    <div className="stack">
      <form className="stack" action={saveWorkspace}>
        <input type="hidden" name="intent" value={isEdit ? "update_workspace" : "create_workspace"} />
        <input type="hidden" name="return_to" value="/settings/workspace" />
        {workspace ? <input type="hidden" name="id" value={workspace.id} /> : null}

        <div className="grid two-up">
          <label className="stack auth-field" htmlFor="workspace-name">
            <span>Nama ruang kerja</span>
            <input id="workspace-name" name="workspace_name" type="text" placeholder="Fashion Men" defaultValue={fieldValue(workspace?.workspace_name)} required />
          </label>
          <RelationalPicker
            defaultValue={workspace?.status ?? "ACTIVE"}
            label="Status"
            name="status"
            options={pickerOptions(WORKSPACE_STATUSES)}
            placeholder="Pilih status"
            required
            searchable={false}
          />
        </div>

        <div className="grid two-up">
          <label className="stack auth-field" htmlFor="workspace-drive-url">
            <span>Folder Drive utama</span>
            <input id="workspace-drive-url" name="drive_root_folder_url" type="url" placeholder="https://..." defaultValue={fieldValue(workspace?.drive_root_folder_url)} />
          </label>
          <label className="stack auth-field" htmlFor="workspace-drive-path">
            <span>Drive path</span>
            <input
              id="workspace-drive-path"
              name="drive_root_folder_path"
              type="text"
              placeholder="/AffiliateAI/WORKSPACES/FASHION_MEN"
              defaultValue={fieldValue(workspace?.drive_root_folder_path)}
            />
          </label>
        </div>

        <div className="grid two-up">
          <RelationalPicker
            allowClear
            defaultValue={workspace?.drive_root_folder_ref_id ?? ""}
            label="Folder Drive ref"
            name="drive_root_folder_ref_id"
            options={driveFolderOptions}
            placeholder="Pilih folder Drive"
            searchPlaceholder="Cari folder"
          />
          <label className="stack auth-field" htmlFor="workspace-niche">
            <span>Niche</span>
            <input id="workspace-niche" name="niche" type="text" placeholder="Optional niche" defaultValue={fieldValue(workspace?.niche)} />
          </label>
        </div>

        <label className="checkbox-row" htmlFor="workspace-is-default">
          <input id="workspace-is-default" name="is_default" type="checkbox" defaultChecked={workspace ? workspace.is_default : true} />
          <span>Jadikan default</span>
        </label>

        <FormActions>
          <button className="button primary" type="submit">
            <Save size={16} aria-hidden="true" />
            {isEdit ? "Simpan workspace" : "Buat workspace"}
          </button>
          <button className="button" type="button" onClick={onCancel}>
            Batal
          </button>
        </FormActions>
      </form>

      {workspace ? (
        <div className="stack">
          <span className="subtle">Aksi cepat</span>
          <FormActions>
            <form action={saveWorkspace}>
              <input type="hidden" name="intent" value="set_current_workspace" />
              <input type="hidden" name="return_to" value="/settings/workspace" />
              <input type="hidden" name="current_workspace_id" value={workspace.id} />
              <button className="button compact" type="submit" disabled={!isActive || isCurrent}>
                {isCurrent ? "Workspace aktif" : "Jadikan aktif"}
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
              <input type="hidden" name="intent" value="provision_workspace_drive" />
              <input type="hidden" name="return_to" value="/settings/workspace" />
              <input type="hidden" name="id" value={workspace.id} />
              <button className="button compact primary" type="submit" disabled={!isActive}>
                {workspace.drive_root_folder_ref_id ? "Sinkronkan Folder Drive" : "Buat Folder Drive"}
              </button>
            </form>
            <form action={saveWorkspace}>
              <input type="hidden" name="intent" value="archive_workspace" />
              <input type="hidden" name="return_to" value="/settings/workspace" />
              <input type="hidden" name="id" value={workspace.id} />
              <button className="button compact" type="submit" disabled={!isActive}>
                <Archive size={15} aria-hidden="true" />
                Arsipkan
              </button>
            </form>
          </FormActions>
        </div>
      ) : null}
    </div>
  );
}
