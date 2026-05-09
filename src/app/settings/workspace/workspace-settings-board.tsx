"use client";

import { FolderKanban, PanelRightOpen, Plus, Save, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/operator/empty-state";
import { FormActions } from "@/components/operator/form-actions";
import { RelationalPicker } from "@/components/operator/relational-picker";
import { StatusBadge } from "@/components/operator/status-badge";
import { DeleteActionButton } from "@/components/ui/delete-action-button";
import { NativeButton } from "@/components/ui/native-button";
import { OverflowActionMenu } from "@/components/ui/overflow-action-menu";
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

function choiceOptions(values: readonly string[]) {
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

function matchesQuery(workspace: WorkspaceRecord, query: string) {
  const value = query.trim().toLowerCase();

  if (!value) {
    return true;
  }

  return [
    workspace.workspace_name,
    workspace.niche,
    workspace.drive_root_folder_url,
    workspace.drive_root_folder_path,
    workspace.status,
  ]
    .join(" ")
    .toLowerCase()
    .includes(value);
}

function isVisibleWorkspace(workspace: WorkspaceRecord) {
  return workspace.status !== "ARCHIVED";
}

function workspaceMobileMeta(workspace: WorkspaceRecord, currentWorkspaceId: string | null) {
  return [
    workspace.drive_root_folder_ref_id || workspace.drive_root_folder_url || workspace.drive_root_folder_path ? "Drive siap" : "Drive kosong",
    workspace.is_default ? "Default" : "",
    currentWorkspaceId === workspace.id ? "Aktif" : "",
    workspace.niche,
  ]
    .filter(Boolean)
    .join(" - ");
}

export function WorkspaceSettingsBoard({ workspaces, currentWorkspaceId, driveFolderOptions }: WorkspaceSettingsBoardProps) {
  const [query, setQuery] = useState("");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(workspaces.find(isVisibleWorkspace)?.id ?? "");
  const [isCreating, setIsCreating] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const visibleWorkspaces = useMemo(() => workspaces.filter(isVisibleWorkspace), [workspaces]);
  const filteredWorkspaces = useMemo(() => visibleWorkspaces.filter((workspace) => matchesQuery(workspace, query)), [query, visibleWorkspaces]);
  const activeWorkspaceCount = useMemo(() => visibleWorkspaces.filter((workspace) => workspace.status === "ACTIVE").length, [visibleWorkspaces]);
  const selectedWorkspace =
    isCreating
      ? null
      : filteredWorkspaces.find((workspace) => workspace.id === selectedWorkspaceId) ??
        filteredWorkspaces[0] ??
        visibleWorkspaces.find((workspace) => workspace.id === selectedWorkspaceId) ??
        null;

  useEffect(() => {
    if (!filteredWorkspaces.length) {
      setSelectedWorkspaceId("");
      return;
    }

    if (!filteredWorkspaces.some((workspace) => workspace.id === selectedWorkspaceId)) {
      setSelectedWorkspaceId(filteredWorkspaces[0].id);
    }
  }, [filteredWorkspaces, selectedWorkspaceId]);

  function openCreateDrawer() {
    setIsCreating(true);
    setDrawerOpen(true);
  }

  function openEditDrawer(workspaceId: string) {
    setIsCreating(false);
    setSelectedWorkspaceId(workspaceId);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
  }

  const initialWorkspace = selectedWorkspace;
  const isActive = initialWorkspace?.status === "ACTIVE";
  const isCurrent = currentWorkspaceId === initialWorkspace?.id;
  const formKey = isCreating ? "create-workspace" : initialWorkspace?.id ?? "edit-workspace";

  return (
    <section className="product-master settings-manager settings-manager--workspace" aria-label="Workspace">
      <div className="product-master__list stack">
        <div className="settings-list-toolbar">
          <label className="product-search" htmlFor="workspace-search">
            <Search size={16} aria-hidden="true" />
            <input
              id="workspace-search"
              name="workspace-search"
              placeholder="Cari workspace"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>

        <div className="settings-inline-summary">
          <span>{activeWorkspaceCount} workspace aktif</span>
          <NativeButton className="compact primary" type="button" onClick={openCreateDrawer}>
            <Plus size={15} aria-hidden="true" />
            Workspace baru
          </NativeButton>
        </div>

        {filteredWorkspaces.length ? (
          <>
            <div className="table-wrap products-table-desktop">
              <table className="data-table product-table">
                <thead>
                  <tr>
                    <th>Workspace</th>
                    <th>Status</th>
                    <th>Drive</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWorkspaces.map((workspace) => (
                    <tr data-active={selectedWorkspace?.id === workspace.id && !isCreating ? "true" : undefined} key={workspace.id}>
                      <td>
                        <div className="stack-tight">
                          <strong>{workspace.workspace_name}</strong>
                          <span className="subtle">{workspace.niche || "Niche belum diisi"}</span>
                        </div>
                      </td>
                      <td>
                        <div className="product-status-stack">
                          <StatusBadge status={workspace.status} />
                          {workspace.is_default ? <StatusBadge status="Default" tone="success" /> : null}
                          {currentWorkspaceId === workspace.id ? <StatusBadge status="Aktif" tone="info" /> : null}
                        </div>
                      </td>
                      <td>{workspaceDetail(workspace)}</td>
                      <td>
                        <div className="product-row-actions">
                          <NativeButton className="compact primary" type="button" onClick={() => openEditDrawer(workspace.id)}>
                            <PanelRightOpen size={15} aria-hidden="true" />
                            Kelola
                          </NativeButton>
                          <form action={saveWorkspace}>
                            <input type="hidden" name="intent" value="archive_workspace" />
                            <input type="hidden" name="return_to" value="/settings/workspace" />
                            <input type="hidden" name="id" value={workspace.id} />
                            <DeleteActionButton
                              confirmMessage={`Hapus workspace "${workspace.workspace_name}"?`}
                              disabled={workspace.status === "ARCHIVED"}
                            />
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="products-cards-mobile">
              {filteredWorkspaces.map((workspace) => (
                <article className="product-card settings-list-card workspace-list-card" key={workspace.id}>
                  <div className="workspace-list-card__header">
                    <div className="stack-tight">
                      <strong>{workspace.workspace_name}</strong>
                      <span className="subtle">{workspace.drive_root_folder_path || workspace.drive_root_folder_url || "Folder Drive utama belum diisi"}</span>
                    </div>
                    <StatusBadge status={workspace.status} />
                  </div>
                  <span className="settings-card-meta-line">{workspaceMobileMeta(workspace, currentWorkspaceId)}</span>
                  <div className="mobile-card-actions">
                    <NativeButton className="compact primary" type="button" onClick={() => openEditDrawer(workspace.id)}>
                      <PanelRightOpen size={15} aria-hidden="true" />
                      Kelola
                    </NativeButton>
                    <OverflowActionMenu>
                      <form action={saveWorkspace}>
                        <input type="hidden" name="intent" value="archive_workspace" />
                        <input type="hidden" name="return_to" value="/settings/workspace" />
                        <input type="hidden" name="id" value={workspace.id} />
                        <DeleteActionButton
                          confirmMessage={`Hapus workspace "${workspace.workspace_name}"?`}
                          disabled={workspace.status === "ARCHIVED"}
                        />
                      </form>
                    </OverflowActionMenu>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            icon={FolderKanban}
            title="Belum ada workspace."
            description="Buat workspace pertama."
            action={
              <NativeButton className="compact primary" type="button" onClick={openCreateDrawer}>
                <Plus size={15} aria-hidden="true" />
                Workspace baru
              </NativeButton>
            }
          />
        )}
      </div>

      <div className="product-drawer-backdrop" data-open={drawerOpen ? "true" : "false"} onClick={closeDrawer} />
      <aside className="product-drawer stack" data-open={drawerOpen ? "true" : "false"} aria-label="Detail workspace">
        <div className="settings-bottom-sheet__handle" aria-hidden="true" />
        <div className="section-card__actions product-drawer__header">
          <div className="stack-tight">
            <span className="subtle">{isCreating ? "Workspace baru" : "Detail"}</span>
            <strong>{isCreating ? "Buat workspace" : initialWorkspace?.workspace_name ?? "Pilih workspace"}</strong>
            <div className="product-status-stack">
              <StatusBadge status={initialWorkspace?.status ?? "DRAFT"} />
              {initialWorkspace?.is_default ? <StatusBadge status="Default" tone="success" /> : null}
              {isCurrent ? <StatusBadge status="Aktif" tone="info" /> : null}
            </div>
          </div>
          <NativeButton className="compact product-drawer__close" type="button" onClick={closeDrawer} aria-label="Tutup detail">
            <X size={16} aria-hidden="true" />
          </NativeButton>
        </div>

        {drawerOpen ? (
          <div className="stack">
            <form key={formKey} className="stack" action={saveWorkspace}>
              <input type="hidden" name="intent" value={isCreating ? "create_workspace" : "update_workspace"} />
              <input type="hidden" name="return_to" value="/settings/workspace" />
              {!isCreating && initialWorkspace ? <input type="hidden" name="id" value={initialWorkspace.id} /> : null}

              <label className="stack auth-field" htmlFor="workspace-name">
                <span>Nama Ruang Kerja</span>
                <input
                  id="workspace-name"
                  name="workspace_name"
                  type="text"
                  placeholder="Fashion Men"
                  defaultValue={fieldValue(initialWorkspace?.workspace_name)}
                  required
                />
              </label>

              <div className="grid two-up">
                <RelationalPicker
                  defaultValue={initialWorkspace?.status ?? "ACTIVE"}
                  label="Status"
                  name="status"
                  options={choiceOptions(WORKSPACE_STATUSES)}
                  placeholder="Pilih status"
                  required
                  searchable={false}
                />
                <label className="stack auth-field" htmlFor="workspace-niche">
                  <span>Niche</span>
                  <input id="workspace-niche" name="niche" type="text" placeholder="Optional niche" defaultValue={fieldValue(initialWorkspace?.niche)} />
                </label>
              </div>

              <div className="grid two-up">
                <label className="stack auth-field" htmlFor="workspace-drive-url">
                  <span>Folder Drive Utama</span>
                  <input
                    id="workspace-drive-url"
                    name="drive_root_folder_url"
                    type="url"
                    placeholder="https://..."
                    defaultValue={fieldValue(initialWorkspace?.drive_root_folder_url)}
                  />
                </label>
                <label className="stack auth-field" htmlFor="workspace-drive-path">
                  <span>Drive path</span>
                  <input
                    id="workspace-drive-path"
                    name="drive_root_folder_path"
                    type="text"
                    placeholder="/AffiliateAI/WORKSPACES/FASHION_MEN"
                    defaultValue={fieldValue(initialWorkspace?.drive_root_folder_path)}
                  />
                </label>
              </div>

              <RelationalPicker
                allowClear
                defaultValue={initialWorkspace?.drive_root_folder_ref_id ?? ""}
                label="Folder Drive ref"
                name="drive_root_folder_ref_id"
                options={driveFolderOptions}
                placeholder="Pilih folder Drive"
                searchPlaceholder="Cari folder"
              />

              <label className="checkbox-row" htmlFor="workspace-is-default">
                <input id="workspace-is-default" name="is_default" type="checkbox" defaultChecked={initialWorkspace?.is_default ?? false} />
                <span>Jadikan default</span>
              </label>

              <FormActions layout="pair">
                <NativeButton className="primary" type="submit">
                  <Save size={16} aria-hidden="true" />
                  {isCreating ? "Buat workspace" : "Simpan workspace"}
                </NativeButton>
                <NativeButton className="tertiary" type="button" onClick={closeDrawer}>
                  Batal
                </NativeButton>
              </FormActions>
            </form>

            {!isCreating && initialWorkspace ? (
              <div className="stack">
                <span className="subtle">Aksi cepat</span>
                <FormActions layout="quad">
                  <form action={saveWorkspace}>
                    <input type="hidden" name="intent" value="set_current_workspace" />
                    <input type="hidden" name="return_to" value="/settings/workspace" />
                    <input type="hidden" name="current_workspace_id" value={initialWorkspace.id} />
                    <NativeButton className="compact tertiary" type="submit" disabled={!isActive || isCurrent}>
                      {isCurrent ? "Workspace aktif" : "Jadikan aktif"}
                    </NativeButton>
                  </form>
                  <form action={saveWorkspace}>
                    <input type="hidden" name="intent" value="set_default_workspace" />
                    <input type="hidden" name="return_to" value="/settings/workspace" />
                    <input type="hidden" name="id" value={initialWorkspace.id} />
                    <NativeButton className="compact tertiary" type="submit" disabled={!isActive || initialWorkspace.is_default}>
                      Default
                    </NativeButton>
                  </form>
                  <form action={saveWorkspace}>
                    <input type="hidden" name="intent" value="provision_workspace_drive" />
                    <input type="hidden" name="return_to" value="/settings/workspace" />
                    <input type="hidden" name="id" value={initialWorkspace.id} />
                    <NativeButton className="compact primary" type="submit" disabled={!isActive}>
                      {initialWorkspace.drive_root_folder_ref_id ? "Sinkronkan Folder Drive" : "Buat Folder Drive"}
                    </NativeButton>
                  </form>
                  <form action={saveWorkspace}>
                    <input type="hidden" name="intent" value="archive_workspace" />
                    <input type="hidden" name="return_to" value="/settings/workspace" />
                    <input type="hidden" name="id" value={initialWorkspace.id} />
                    <DeleteActionButton
                      confirmMessage={`Hapus workspace "${initialWorkspace.workspace_name}"?`}
                      disabled={initialWorkspace.status === "ARCHIVED"}
                    />
                  </form>
                </FormActions>
              </div>
            ) : null}
          </div>
        ) : null}
      </aside>
    </section>
  );
}
