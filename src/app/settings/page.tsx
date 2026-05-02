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
import { saveAffiliateProfile, saveWorkspace } from "./actions";
import { EmptyState } from "@/components/operator/empty-state";
import { FormActions } from "@/components/operator/form-actions";
import { PageHeader } from "@/components/operator/page-header";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { AFFILIATE_PLATFORMS, AFFILIATE_PROFILE_STATUSES } from "@/lib/affiliate-profiles/validation";
import {
  isAffiliateProfileSchemaMissingError,
  listAffiliateProfiles,
  type AffiliateProfileRecord,
} from "@/lib/server/affiliate-profiles";
import { listDriveItems, type DriveItemRecord } from "@/lib/server/drive-items";
import { getWorkspaceSelectionState, isWorkspaceSchemaMissingError, type WorkspaceSelectionState } from "@/lib/server/workspaces";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to load workspaces.";
}

function workspaceLabel(workspaceId: string, workspaceMap: Map<string, { workspace_code: string; workspace_name: string }>) {
  const workspace = workspaceMap.get(workspaceId);
  return workspace ? `${workspace.workspace_code} - ${workspace.workspace_name}` : "Workspace unavailable";
}

function driveItemLabel(item: Pick<DriveItemRecord, "name" | "purpose" | "drive_path">) {
  return [item.name, item.purpose, item.drive_path].filter(Boolean).join(" - ");
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
  let affiliateProfileError: string | null = null;
  let driveItems: DriveItemRecord[] = [];
  let driveItemsError: string | null = null;

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
    affiliateProfileError =
      isAffiliateProfileSchemaMissingError(error) ?
        "Apply the local Sprint 13 migration before using affiliate profiles."
      : errorMessage(error);
  }

  try {
    driveItems = await listDriveItems({ limit: 200 });
  } catch (error) {
    driveItemsError = errorMessage(error);
  }

  const workspaces = workspaceState?.workspaces ?? [];
  const activeWorkspaces = workspaces.filter((workspace) => workspace.status === "ACTIVE");
  const currentWorkspace = workspaceState?.currentWorkspace ?? null;
  const workspaceMap = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
  const activeAffiliateProfiles = affiliateProfiles.filter((profile) => profile.status === "ACTIVE");
  const promptedProfileCount = affiliateProfiles.filter(
    (profile) =>
      profile.i2i_prompt_rules ||
      profile.i2v_prompt_rules ||
      profile.caption_rules ||
      profile.hashtag_rules ||
      profile.negative_prompt_rules ||
      profile.product_positioning_notes ||
      profile.lock_seed_character ||
      profile.lock_environment,
  ).length;

  return (
    <div className="stack">
      <PageHeader
        icon={Settings}
        badge="Config"
        title="Settings"
        description="Configuration hub for workspace placeholders, services, tools, profiles, and account."
        stats={[
          { label: "Workspaces", value: workspaceError ? <StatusBadge status="Pending" tone="warning" /> : workspaces.length },
          { label: "Affiliate profiles", value: affiliateProfileError ? <StatusBadge status="Pending" tone="warning" /> : affiliateProfiles.length },
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

        <SectionCard
          icon={Users}
          title="Affiliate Profiles"
          description="Unlimited workspace-scoped affiliate context."
          actions={affiliateProfileError ? <StatusBadge status="Schema pending" tone="warning" /> : <StatusBadge status={`${activeAffiliateProfiles.length} active`} tone="info" />}
        >
          {affiliateProfileError ? (
            <EmptyState icon={Users} title="Affiliate profile schema pending." description={affiliateProfileError} />
          ) : !activeWorkspaces.length ? (
            <EmptyState icon={Users} title="Create a workspace first." description="Affiliate profiles are workspace-scoped." />
          ) : (
            <div className="stack">
              <details open={!affiliateProfiles.length}>
                <summary>Create affiliate profile</summary>
                <form className="stack" action={saveAffiliateProfile}>
                  <input type="hidden" name="intent" value="create_affiliate_profile" />
                  <div className="grid two-up">
                    <label className="stack auth-field" htmlFor="affiliate-workspace-id">
                      <span>Workspace</span>
                      <select id="affiliate-workspace-id" name="workspace_id" defaultValue={currentWorkspace?.id ?? activeWorkspaces[0]?.id ?? ""} required>
                        {activeWorkspaces.map((workspace) => (
                          <option key={workspace.id} value={workspace.id}>
                            {workspace.workspace_name}
                          </option>
                        ))}
                      </select>
                    </label>
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
                    <span>Notes</span>
                    <textarea id="affiliate-notes" name="notes" rows={3} placeholder="Operator notes" />
                  </label>
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
                          {profile.lock_seed_character ? <StatusBadge status="Seed locked" tone="success" /> : null}
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
                              <label className="stack auth-field" htmlFor={`affiliate-workspace-${profile.id}`}>
                                <span>Workspace</span>
                                <select id={`affiliate-workspace-${profile.id}`} name="workspace_id" defaultValue={profile.workspace_id} required>
                                  {activeWorkspaces.map((workspace) => (
                                    <option key={workspace.id} value={workspace.id}>
                                      {workspace.workspace_name}
                                    </option>
                                  ))}
                                </select>
                              </label>
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
                              <span>Notes</span>
                              <textarea id={`affiliate-notes-${profile.id}`} name="notes" rows={3} defaultValue={profile.notes ?? ""} />
                            </label>
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
                <EmptyState icon={Users} title="No affiliate profiles." description="Create the first workspace-scoped affiliate profile above." />
              )}
            </div>
          )}
        </SectionCard>

        <SectionCard
          icon={SlidersHorizontal}
          title="Prompt Personalization"
          description="Editable prompt rules and locked reference controls per affiliate profile."
          actions={affiliateProfileError ? null : <StatusBadge status={`${promptedProfileCount} configured`} tone="info" />}
        >
          {affiliateProfileError ? (
            <EmptyState icon={SlidersHorizontal} title="Prompt personalization schema pending." description={affiliateProfileError} />
          ) : affiliateProfiles.length ? (
            <div className="stack">
              <div className="metric-grid">
                <div className="metric">
                  <span>Profiles</span>
                  <strong>{affiliateProfiles.length}</strong>
                </div>
                <div className="metric">
                  <span>With rules</span>
                  <strong>{promptedProfileCount}</strong>
                </div>
                <div className="metric">
                  <span>Drive refs</span>
                  <strong>{driveItemsError ? "Unavailable" : driveItems.length}</strong>
                </div>
              </div>
              {driveItemsError ? <div className="error-box">Drive references unavailable: {driveItemsError}</div> : null}
              <datalist id="affiliate-drive-item-options">
                {driveItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {driveItemLabel(item)}
                  </option>
                ))}
              </datalist>
              {affiliateProfiles.map((profile) => (
                <details key={profile.id}>
                  <summary>
                    {profile.profile_name} - {profile.platform}
                  </summary>
                  <form className="stack" action={saveAffiliateProfile}>
                    <input type="hidden" name="intent" value="update_affiliate_personalization" />
                    <input type="hidden" name="id" value={profile.id} />
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
                          <span>Lock seed character</span>
                        </label>
                        <label className="stack auth-field" htmlFor={`seed-notes-${profile.id}`}>
                          <span>Seed character notes</span>
                          <textarea id={`seed-notes-${profile.id}`} name="seed_character_notes" rows={3} defaultValue={profile.seed_character_notes} />
                        </label>
                        <label className="stack auth-field" htmlFor={`seed-drive-${profile.id}`}>
                          <span>Seed character Drive reference</span>
                          <input
                            id={`seed-drive-${profile.id}`}
                            name="seed_character_drive_item_ref_id"
                            type="text"
                            list="affiliate-drive-item-options"
                            defaultValue={profile.seed_character_drive_item_ref_id ?? ""}
                            placeholder="Optional Drive item row id"
                          />
                        </label>
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
                        <label className="stack auth-field" htmlFor={`env-drive-${profile.id}`}>
                          <span>Environment Drive reference</span>
                          <input
                            id={`env-drive-${profile.id}`}
                            name="environment_drive_item_ref_id"
                            type="text"
                            list="affiliate-drive-item-options"
                            defaultValue={profile.environment_drive_item_ref_id ?? ""}
                            placeholder="Optional Drive item row id"
                          />
                        </label>
                      </div>
                    </div>
                    <FormActions>
                      <button className="button primary" type="submit">
                        Save rules
                      </button>
                    </FormActions>
                  </form>
                </details>
              ))}
            </div>
          ) : (
            <EmptyState icon={SlidersHorizontal} title="No profiles to personalize." description="Create an affiliate profile first." />
          )}
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
