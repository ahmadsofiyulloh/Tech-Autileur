import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { FormActions } from "@/components/operator/form-actions";
import { RelationalPicker } from "@/components/operator/relational-picker";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { SettingsSectionNav } from "../settings-section-nav";
import { saveAffiliateProfile } from "../actions";
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
  return error instanceof Error ? error.message : "Akun Affiliate tidak tersedia.";
}

function workspaceLabel(workspaceId: string, workspaceMap: Map<string, { workspace_code: string; workspace_name: string }>) {
  const workspace = workspaceMap.get(workspaceId);
  return workspace ? workspace.workspace_name : "Workspace unavailable";
}

function pickerOption(value: string, label: string, description?: string | null) {
  return {
    value,
    label,
    ...(description ? { description } : {}),
  };
}

export default async function AffiliateProfilesSettingsPage() {
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

  try {
    workspaceState = await getWorkspaceSelectionState();
  } catch (error) {
    workspaceError = isWorkspaceSchemaMissingError(error) ? "Apply the local Sprint 12B migration before using workspace profiles." : errorMessage(error);
  }

  try {
    affiliateProfiles = await listAffiliateProfiles({ limit: 200 });
  } catch (error) {
    affiliateProfileSchemaMissing = isAffiliateProfileSchemaMissingError(error);
    affiliateProfileLoadError = affiliateProfileSchemaMissing ? "Apply the local Sprint 13 migration before using affiliate profiles." : errorMessage(error);
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
  const workspacePickerOptions = activeWorkspaces.map((workspace) =>
    pickerOption(
      workspace.id,
      workspace.workspace_name,
      [workspace.workspace_code, workspace.is_default ? "default" : null].filter(Boolean).join(" - "),
    ),
  );
  const driveItemPickerOptions = driveItems.map((item) =>
    pickerOption(item.id, item.name, [item.item_type, item.purpose, item.drive_path].filter(Boolean).join(" - ")),
  );

  return (
    <div className="stack">
      <SettingsSectionNav />

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
        ) : workspaceError ? (
          <EmptyState icon={Users} title="Workspace schema pending." description={workspaceError} />
        ) : !activeWorkspaces.length ? (
          <EmptyState icon={Users} title="Buat workspace dulu." description="Workspace diperlukan." />
        ) : (
          <div className="stack">
            {driveItemsError ? <div className="error-box">Drive references unavailable: {driveItemsError}</div> : null}
            <details open={!affiliateProfiles.length}>
              <summary>Create affiliate profile</summary>
              <form className="stack" action={saveAffiliateProfile}>
                <input type="hidden" name="intent" value="create_affiliate_profile" />
                <input type="hidden" name="return_to" value="/settings/affiliate-profiles" />
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
                          <input type="hidden" name="return_to" value="/settings/affiliate-profiles" />
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
                        <input type="hidden" name="return_to" value="/settings/affiliate-profiles" />
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
    </div>
  );
}
