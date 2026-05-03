import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  FolderKanban,
  HardDrive,
  KeyRound,
  LogOut,
  Settings,
  UserRound,
  Users,
  Workflow,
} from "lucide-react";
import { saveAffiliateProfile, saveFlowAccount, saveWorkspace } from "./actions";
import { EmptyState } from "@/components/operator/empty-state";
import { FormActions } from "@/components/operator/form-actions";
import { PageHeader } from "@/components/operator/page-header";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { RelationalPicker } from "@/components/operator/relational-picker";
import { HelperApiTokenPanel } from "./helper-api-token-panel";
import { ChromePairingPanel } from "./chrome-pairing-panel";
import { AFFILIATE_PLATFORMS, AFFILIATE_PROFILE_STATUSES } from "@/lib/affiliate-profiles/validation";
import { ACCOUNT_STATUSES } from "@/lib/gemini/validation";
import {
  isAffiliateProfileSchemaMissingError,
  listAffiliateProfiles,
  type AffiliateProfileRecord,
} from "@/lib/server/affiliate-profiles";
import { FLOW_ACCOUNT_TYPES, listFlowAccounts, type FlowAccountRecord } from "@/lib/server/flow-accounts";
import { listDriveItems, type DriveItemRecord } from "@/lib/server/drive-items";
import { getHelperApiToken, isHelperApiTokenSchemaMissingError, type HelperApiTokenRecord } from "@/lib/server/helper-api-tokens";
import { getWorkspaceSelectionState, isWorkspaceSchemaMissingError, type WorkspaceSelectionState } from "@/lib/server/workspaces";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to load workspaces.";
}

function workspaceLabel(workspaceId: string, workspaceMap: Map<string, { workspace_code: string; workspace_name: string }>) {
  const workspace = workspaceMap.get(workspaceId);
  return workspace ? workspace.workspace_name : "Workspace unavailable";
}

function selectOptions(values: readonly string[]) {
  return values.map((value) => (
    <option key={value} value={value}>
      {value}
    </option>
  ));
}

function pickerOption(value: string, label: string, description?: string | null) {
  return {
    value,
    label,
    ...(description ? { description } : {}),
  };
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
  let affiliateProfiles: AffiliateProfileRecord[] = [];
  let affiliateProfileSchemaMissing = false;
  let affiliateProfileLoadError: string | null = null;
  let driveItems: DriveItemRecord[] = [];
  let driveItemsError: string | null = null;
  let flowAccounts: FlowAccountRecord[] = [];
  let flowAccountsError: string | null = null;
  let helperApiToken: HelperApiTokenRecord | null = null;
  let helperApiTokenSchemaMissing = false;
  let helperApiTokenLoadError: string | null = null;

  try {
    workspaceState = await getWorkspaceSelectionState();
  } catch (error) {
    workspaceError =
      isWorkspaceSchemaMissingError(error) ?
        "Apply the local Sprint 12B migration before using workspace profiles."
      : errorMessage(error);
  }

  try {
    affiliateProfiles = await listAffiliateProfiles({ limit: 200 });
  } catch (error) {
    affiliateProfileSchemaMissing = isAffiliateProfileSchemaMissingError(error);
    affiliateProfileLoadError = affiliateProfileSchemaMissing
      ? "Apply the local Sprint 13 migration before using affiliate profiles."
      : errorMessage(error);
  }

  try {
    driveItems = await listDriveItems({ limit: 200 });
  } catch (error) {
    driveItemsError = errorMessage(error);
  }

  try {
    flowAccounts = await listFlowAccounts({ limit: 200 });
  } catch (error) {
    flowAccountsError = errorMessage(error);
  }

  try {
    helperApiToken = await getHelperApiToken();
  } catch (error) {
    helperApiTokenSchemaMissing = isHelperApiTokenSchemaMissingError(error);
    helperApiTokenLoadError = helperApiTokenSchemaMissing
      ? "Apply the S6 helper token migration before using App API Token."
      : errorMessage(error);
  }

  const workspaces = workspaceState?.workspaces ?? [];
  const activeWorkspaces = workspaces.filter((workspace) => workspace.status === "ACTIVE");
  const currentWorkspace = workspaceState?.currentWorkspace ?? null;
  const workspaceMap = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
  const activeAffiliateProfiles = affiliateProfiles.filter((profile) => profile.status === "ACTIVE");
  const workspacePickerOptions = activeWorkspaces.map((workspace) =>
    pickerOption(
      workspace.id,
      workspace.workspace_name,
      [workspace.workspace_code, workspace.is_default ? "default" : null].filter(Boolean).join(" - "),
    ),
  );
  const driveFolderPickerOptions = driveItems
    .filter((item) => item.item_type === "FOLDER")
    .map((item) => pickerOption(item.id, item.name, [item.purpose, item.drive_path].filter(Boolean).join(" - ")));
  const driveItemPickerOptions = driveItems.map((item) =>
    pickerOption(item.id, item.name, [item.item_type, item.purpose, item.drive_path].filter(Boolean).join(" - ")),
  );

  return (
    <div className="stack">
      <PageHeader
        icon={Settings}
        badge="Pengaturan"
        title="Pengaturan"
        description="Ringkasan konfigurasi."
        stats={[
          { label: "Workspace", value: workspaceError ? <StatusBadge status="Pending" tone="warning" /> : workspaces.length },
          {
            label: "Profil",
            value:
              affiliateProfileSchemaMissing ? <StatusBadge status="Pending" tone="warning" />
              : affiliateProfileLoadError ? <StatusBadge status="Error" tone="danger" />
              : affiliateProfiles.length,
          },
          { label: "Gemini", value: <StatusBadge status="Active" tone="success" /> },
          { label: "Drive", value: <StatusBadge status="Ready" tone="success" /> },
          { label: "Akun", value: user.email ?? "Signed in" },
        ]}
      />

      <section className="grid two-up">
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

              <details>
                <summary>Buat workspace</summary>
                <form className="stack" action={saveWorkspace}>
                  <input type="hidden" name="intent" value="create_workspace" />
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
                            <input type="hidden" name="current_workspace_id" value={workspace.id} />
                            <button className="button compact" type="submit" disabled={!isActive || isCurrent}>
                              Aktifkan
                            </button>
                          </form>
                          <form action={saveWorkspace}>
                            <input type="hidden" name="intent" value="set_default_workspace" />
                            <input type="hidden" name="id" value={workspace.id} />
                            <button className="button compact" type="submit" disabled={!isActive || workspace.is_default}>
                              Default
                            </button>
                          </form>
                          <form action={saveWorkspace}>
                            <input type="hidden" name="intent" value="archive_workspace" />
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

        <SectionCard
          icon={KeyRound}
          title="Gemini"
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
          actions={
            <Link className="button primary" href="/drive">
              <ArrowRight size={16} aria-hidden="true" />
              Open
            </Link>
          }
        >
          <StatusBadge status="Configured here" tone="info" />
        </SectionCard>

        <SectionCard icon={Workflow} title="Flow Accounts / Tools">
          {flowAccountsError ? (
            <EmptyState icon={Workflow} title="Flow account pool unavailable." description={flowAccountsError} />
          ) : (
            <div className="stack">
              <details open={!flowAccounts.length}>
                <summary>Tambah akun Flow</summary>
                <form className="stack" action={saveFlowAccount}>
                  <input type="hidden" name="intent" value="create_flow_account" />
                  <div className="grid two-up">
                    <label className="stack auth-field" htmlFor="flow-account-code">
                      <span>Kode Akun</span>
                      <input id="flow-account-code" name="account_code" type="text" placeholder="FLOW_FREE_01" required />
                    </label>
                    <label className="stack auth-field" htmlFor="flow-account-type">
                      <span>Tipe Akun</span>
                      <select id="flow-account-type" name="account_type" defaultValue={FLOW_ACCOUNT_TYPES[0]} required>
                        {selectOptions(FLOW_ACCOUNT_TYPES)}
                      </select>
                    </label>
                  </div>
                  <details>
                    <summary>Lanjutan</summary>
                    <div className="stack">
                      <div className="grid two-up">
                        <label className="stack auth-field" htmlFor="flow-account-daily">
                          <span>Observed daily credit</span>
                          <input id="flow-account-daily" name="observed_daily_credit" type="number" min="0" inputMode="numeric" />
                        </label>
                        <label className="stack auth-field" htmlFor="flow-account-monthly">
                          <span>Observed monthly credit</span>
                          <input id="flow-account-monthly" name="observed_monthly_credit" type="number" min="0" inputMode="numeric" />
                        </label>
                      </div>
                      <div className="grid two-up">
                        <label className="stack auth-field" htmlFor="flow-account-credit">
                          <span>Credit per generation</span>
                          <input id="flow-account-credit" name="credit_per_generation" type="number" min="1" inputMode="numeric" />
                        </label>
                        <label className="stack auth-field" htmlFor="flow-account-slots">
                          <span>Max parallel allowed</span>
                          <input id="flow-account-slots" name="max_parallel_allowed" type="number" min="1" inputMode="numeric" />
                        </label>
                      </div>
                      <div className="grid two-up">
                        <label className="stack auth-field" htmlFor="flow-account-cooldown">
                          <span>Cooldown minutes</span>
                          <input id="flow-account-cooldown" name="cooldown_minutes" type="number" min="0" inputMode="numeric" />
                        </label>
                        <label className="stack auth-field" htmlFor="flow-account-status">
                          <span>Status</span>
                          <select id="flow-account-status" name="status" defaultValue="ACTIVE">
                            {selectOptions(ACCOUNT_STATUSES)}
                          </select>
                        </label>
                      </div>
                      <label className="stack auth-field" htmlFor="flow-account-notes">
                        <span>Catatan</span>
                        <textarea id="flow-account-notes" name="notes" rows={3} placeholder="Optional notes" />
                      </label>
                    </div>
                  </details>
                  <FormActions>
                    <button className="button primary" type="submit">
                      Buat akun Flow
                    </button>
                  </FormActions>
                </form>
              </details>

              {flowAccounts.length ? (
                <ul className="list">
                  {flowAccounts.map((account) => (
                    <li key={account.id}>
                      <div className="stack-tight">
                        <strong>{account.account_code}</strong>
                        <span className="subtle">
                          {[account.account_type, `${account.observed_daily_credit} kredit`, `${account.max_parallel_allowed} slot`, `${account.cooldown_minutes} menit cooldown`]
                            .filter(Boolean)
                            .join(" - ")}
                        </span>
                        <div className="section-card__actions">
                          <StatusBadge status={account.status} />
                          <StatusBadge status={`Bulk ${account.credit_per_generation}`} tone="info" />
                        </div>
                      </div>
                      <form action={saveFlowAccount}>
                        <input type="hidden" name="intent" value="archive_flow_account" />
                        <input type="hidden" name="id" value={account.id} />
                        <button className="button compact" type="submit" disabled={account.status === "DISABLED"}>
                          Archive
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={Workflow} title="Belum ada akun Flow." description="Buat akun global pertama." />
              )}
            </div>
          )}
        </SectionCard>

        <SectionCard
          icon={Users}
          title="Akun Affiliate"
          actions={
            affiliateProfileSchemaMissing ? <StatusBadge status="Schema pending" tone="warning" />
            : affiliateProfileLoadError ? <StatusBadge status="Load error" tone="danger" />
            : <StatusBadge status={`${activeAffiliateProfiles.length} active`} tone="info" />
          }
        >
          {affiliateProfileSchemaMissing ? (
            <EmptyState icon={Users} title="Affiliate profile schema pending." description={affiliateProfileLoadError ?? "Apply the Sprint 13 migration first."} />
          ) : affiliateProfileLoadError ? (
            <EmptyState icon={Users} title="Affiliate profiles unavailable." description={affiliateProfileLoadError} />
          ) : !activeWorkspaces.length ? (
            <EmptyState icon={Users} title="Buat workspace dulu." description="Workspace diperlukan." />
              ) : (
                <div className="stack">
                  {driveItemsError ? <div className="error-box">Drive references unavailable: {driveItemsError}</div> : null}
                  <details open={!affiliateProfiles.length}>
                    <summary>Create affiliate profile</summary>
                    <form className="stack" action={saveAffiliateProfile}>
                  <input type="hidden" name="intent" value="create_affiliate_profile" />
                  <div className="grid two-up">
                    <RelationalPicker
                      defaultValue={currentWorkspace?.id ?? activeWorkspaces[0]?.id ?? ""}
                      disabled={!activeWorkspaces.length}
                      label="Workspace"
                      name="workspace_id"
                      options={workspacePickerOptions}
                      placeholder="Pilih workspace"
                      searchPlaceholder="Cari workspace"
                      required
                    />
                    <label className="stack auth-field" htmlFor="affiliate-platform">
                      <span>Platform</span>
                      <select id="affiliate-platform" name="platform" defaultValue="TIKTOK" required>
                        {AFFILIATE_PLATFORMS.map((platform) => (
                          <option key={platform} value={platform}>
                            {platform}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="grid two-up">
                    <label className="stack auth-field" htmlFor="affiliate-profile-code">
                      <span>Profile code</span>
                      <input id="affiliate-profile-code" name="profile_code" type="text" placeholder="FASHION_TTK_01" required />
                    </label>
                    <label className="stack auth-field" htmlFor="affiliate-profile-name">
                      <span>Profile name</span>
                      <input id="affiliate-profile-name" name="profile_name" type="text" placeholder="Fashion TikTok 01" required />
                    </label>
                  </div>
                  <details>
                    <summary>Lanjutan</summary>
                    <div className="stack">
                      <div className="grid two-up">
                        <label className="stack auth-field" htmlFor="affiliate-account-label">
                          <span>Account label</span>
                          <input id="affiliate-account-label" name="account_label" type="text" placeholder="Optional account label" />
                        </label>
                        <label className="stack auth-field" htmlFor="affiliate-niche">
                          <span>Niche</span>
                          <input id="affiliate-niche" name="niche" type="text" placeholder="Optional niche" />
                        </label>
                      </div>
                      <label className="stack auth-field" htmlFor="affiliate-url">
                        <span>Affiliate URL</span>
                        <input id="affiliate-url" name="affiliate_url" type="url" placeholder="https://..." />
                      </label>
                      <label className="stack auth-field" htmlFor="affiliate-notes">
                        <span>Catatan</span>
                        <textarea id="affiliate-notes" name="notes" rows={3} placeholder="Operator notes" />
                      </label>
                    </div>
                  </details>
                  <details>
                    <summary>Prompt rules and locks</summary>
                    <div className="stack">
                      <div className="grid two-up">
                        <label className="stack auth-field" htmlFor="affiliate-i2i-rules">
                          <span>i2i prompt rules</span>
                          <textarea id="affiliate-i2i-rules" name="i2i_prompt_rules" rows={3} placeholder="Editable rules" />
                        </label>
                        <label className="stack auth-field" htmlFor="affiliate-i2v-rules">
                          <span>i2v prompt rules</span>
                          <textarea id="affiliate-i2v-rules" name="i2v_prompt_rules" rows={3} placeholder="Editable rules" />
                        </label>
                      </div>
                      <div className="grid two-up">
                        <label className="stack auth-field" htmlFor="affiliate-caption-rules">
                          <span>Caption rules</span>
                          <textarea id="affiliate-caption-rules" name="caption_rules" rows={3} placeholder="Editable rules" />
                        </label>
                        <label className="stack auth-field" htmlFor="affiliate-hashtag-rules">
                          <span>Hashtag/tag rules</span>
                          <textarea id="affiliate-hashtag-rules" name="hashtag_rules" rows={3} placeholder="Editable rules" />
                        </label>
                      </div>
                      <label className="stack auth-field" htmlFor="affiliate-negative-rules">
                        <span>Negative prompt rules</span>
                        <textarea id="affiliate-negative-rules" name="negative_prompt_rules" rows={3} placeholder="Editable rules" />
                      </label>
                      <label className="stack auth-field" htmlFor="affiliate-positioning-notes">
                        <span>Product positioning notes</span>
                        <textarea id="affiliate-positioning-notes" name="product_positioning_notes" rows={3} placeholder="Editable notes" />
                      </label>
                    </div>
                  </details>
                  <input type="hidden" name="status" value="ACTIVE" />
                  <FormActions>
                    <button className="button primary" type="submit">
                      Create profile
                    </button>
                  </FormActions>
                </form>
              </details>

              {affiliateProfiles.length ? (
                <ul className="list">
                  {affiliateProfiles.map((profile) => (
                    <li key={profile.id}>
                      <div className="stack-tight">
                        <strong>{profile.profile_name}</strong>
                        <span className="subtle">
                          {[profile.profile_code, profile.platform, workspaceLabel(profile.workspace_id, workspaceMap)].filter(Boolean).join(" - ")}
                        </span>
                        <div className="section-card__actions">
                          <StatusBadge status={profile.status} />
                          {profile.lock_seed_character ? <StatusBadge status="Character locked" tone="success" /> : null}
                          {profile.lock_environment ? <StatusBadge status="Environment locked" tone="success" /> : null}
                        </div>
                      </div>
                      <div className="section-card__actions">
                        <details>
                          <summary>Edit</summary>
                          <form className="stack" action={saveAffiliateProfile}>
                            <input type="hidden" name="intent" value="update_affiliate_profile" />
                            <input type="hidden" name="id" value={profile.id} />
                            <div className="grid two-up">
                              <RelationalPicker
                                defaultValue={profile.workspace_id}
                                label="Workspace"
                                name="workspace_id"
                                options={workspacePickerOptions}
                                placeholder="Pilih workspace"
                                searchPlaceholder="Cari workspace"
                                required
                              />
                              <label className="stack auth-field" htmlFor={`affiliate-status-${profile.id}`}>
                                <span>Status</span>
                                <select id={`affiliate-status-${profile.id}`} name="status" defaultValue={profile.status} required>
                                  {AFFILIATE_PROFILE_STATUSES.map((status) => (
                                    <option key={status} value={status}>
                                      {status}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>
                            <div className="grid two-up">
                              <label className="stack auth-field" htmlFor={`affiliate-code-${profile.id}`}>
                                <span>Profile code</span>
                                <input id={`affiliate-code-${profile.id}`} name="profile_code" type="text" defaultValue={profile.profile_code} required />
                              </label>
                              <label className="stack auth-field" htmlFor={`affiliate-name-${profile.id}`}>
                                <span>Profile name</span>
                                <input id={`affiliate-name-${profile.id}`} name="profile_name" type="text" defaultValue={profile.profile_name} required />
                              </label>
                            </div>
                            <div className="grid two-up">
                              <label className="stack auth-field" htmlFor={`affiliate-platform-${profile.id}`}>
                                <span>Platform</span>
                                <select id={`affiliate-platform-${profile.id}`} name="platform" defaultValue={profile.platform} required>
                                  {AFFILIATE_PLATFORMS.map((platform) => (
                                    <option key={platform} value={platform}>
                                      {platform}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="stack auth-field" htmlFor={`affiliate-account-${profile.id}`}>
                                <span>Account label</span>
                                <input id={`affiliate-account-${profile.id}`} name="account_label" type="text" defaultValue={profile.account_label ?? ""} />
                              </label>
                            </div>
                            <details>
                              <summary>Lanjutan</summary>
                              <div className="stack">
                                <div className="grid two-up">
                                  <label className="stack auth-field" htmlFor={`affiliate-niche-${profile.id}`}>
                                    <span>Niche</span>
                                    <input id={`affiliate-niche-${profile.id}`} name="niche" type="text" defaultValue={profile.niche ?? ""} />
                                  </label>
                                  <label className="stack auth-field" htmlFor={`affiliate-url-${profile.id}`}>
                                    <span>Affiliate URL</span>
                                    <input id={`affiliate-url-${profile.id}`} name="affiliate_url" type="url" defaultValue={profile.affiliate_url ?? ""} />
                                  </label>
                                </div>
                                <label className="stack auth-field" htmlFor={`affiliate-notes-${profile.id}`}>
                                  <span>Catatan</span>
                                  <textarea id={`affiliate-notes-${profile.id}`} name="notes" rows={3} defaultValue={profile.notes ?? ""} />
                                </label>
                              </div>
                            </details>
                            <details>
                              <summary>Prompt rules dan locks</summary>
                              <div className="stack">
                                <div className="grid two-up">
                                  <label className="stack auth-field" htmlFor={`i2i-rules-${profile.id}`}>
                                    <span>i2i prompt rules</span>
                                    <textarea id={`i2i-rules-${profile.id}`} name="i2i_prompt_rules" rows={4} defaultValue={profile.i2i_prompt_rules} />
                                  </label>
                                  <label className="stack auth-field" htmlFor={`i2v-rules-${profile.id}`}>
                                    <span>i2v prompt rules</span>
                                    <textarea id={`i2v-rules-${profile.id}`} name="i2v_prompt_rules" rows={4} defaultValue={profile.i2v_prompt_rules} />
                                  </label>
                                </div>
                                <div className="grid two-up">
                                  <label className="stack auth-field" htmlFor={`caption-rules-${profile.id}`}>
                                    <span>Caption rules</span>
                                    <textarea id={`caption-rules-${profile.id}`} name="caption_rules" rows={4} defaultValue={profile.caption_rules} />
                                  </label>
                                  <label className="stack auth-field" htmlFor={`hashtag-rules-${profile.id}`}>
                                    <span>Hashtag/tag rules</span>
                                    <textarea id={`hashtag-rules-${profile.id}`} name="hashtag_rules" rows={4} defaultValue={profile.hashtag_rules} />
                                  </label>
                                </div>
                                <label className="stack auth-field" htmlFor={`negative-rules-${profile.id}`}>
                                  <span>Negative prompt rules</span>
                                  <textarea id={`negative-rules-${profile.id}`} name="negative_prompt_rules" rows={4} defaultValue={profile.negative_prompt_rules} />
                                </label>
                                <label className="stack auth-field" htmlFor={`positioning-notes-${profile.id}`}>
                                  <span>Product positioning notes</span>
                                  <textarea id={`positioning-notes-${profile.id}`} name="product_positioning_notes" rows={4} defaultValue={profile.product_positioning_notes} />
                                </label>
                                <div className="grid two-up">
                                  <div className="muted-box stack-tight">
                                    <label className="checkbox-row" htmlFor={`lock-seed-${profile.id}`}>
                                      <input id={`lock-seed-${profile.id}`} name="lock_seed_character" type="checkbox" defaultChecked={profile.lock_seed_character} />
                                      <span>Lock character</span>
                                    </label>
                                <label className="stack auth-field" htmlFor={`seed-notes-${profile.id}`}>
                                  <span>Character notes</span>
                                  <textarea id={`seed-notes-${profile.id}`} name="seed_character_notes" rows={3} defaultValue={profile.seed_character_notes} />
                                </label>
                                <RelationalPicker
                                  allowClear
                                  defaultValue={profile.seed_character_drive_item_ref_id}
                                  label="Character Drive reference"
                                  name="seed_character_drive_item_ref_id"
                                  options={driveItemPickerOptions}
                                  placeholder="Gunakan karakter kosong."
                                  searchPlaceholder="Cari Drive item"
                                />
                                  </div>
                                  <div className="muted-box stack-tight">
                                    <label className="checkbox-row" htmlFor={`lock-env-${profile.id}`}>
                                      <input id={`lock-env-${profile.id}`} name="lock_environment" type="checkbox" defaultChecked={profile.lock_environment} />
                                      <span>Lock environment</span>
                                    </label>
                                    <label className="stack auth-field" htmlFor={`env-notes-${profile.id}`}>
                                      <span>Environment notes</span>
                                      <textarea id={`env-notes-${profile.id}`} name="environment_notes" rows={3} defaultValue={profile.environment_notes} />
                                    </label>
                                    <RelationalPicker
                                      allowClear
                                      defaultValue={profile.environment_drive_item_ref_id}
                                      label="Environment Drive reference"
                                      name="environment_drive_item_ref_id"
                                      options={driveItemPickerOptions}
                                      placeholder="Gunakan environment otomatis."
                                      searchPlaceholder="Cari Drive item"
                                    />
                                  </div>
                                </div>
                              </div>
                            </details>
                            <FormActions>
                              <button className="button primary" type="submit">
                                Save profile
                              </button>
                            </FormActions>
                          </form>
                        </details>
                        <form action={saveAffiliateProfile}>
                          <input type="hidden" name="intent" value="archive_affiliate_profile" />
                          <input type="hidden" name="id" value={profile.id} />
                          <button className="button compact" type="submit" disabled={profile.status === "ARCHIVED"}>
                            Archive
                          </button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={Users} title="Belum ada profile affiliate." description="Buat profile pertama di atas." />
              )}
            </div>
          )}
        </SectionCard>

        <SectionCard icon={UserRound} title="Account">
          <div className="stack">
            <ChromePairingPanel ownerEmail={user.email ?? null} />
            {helperApiTokenSchemaMissing ? (
              <EmptyState icon={UserRound} title="App API Token schema pending." description={helperApiTokenLoadError ?? "Apply the S6 migration first."} />
            ) : helperApiTokenLoadError ? (
              <EmptyState icon={UserRound} title="App API Token unavailable." description={helperApiTokenLoadError} />
            ) : (
              <HelperApiTokenPanel ownerEmail={user.email ?? null} currentToken={helperApiToken} />
            )}
          </div>
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
