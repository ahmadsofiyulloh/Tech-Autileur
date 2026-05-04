"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Plus, PanelRightOpen, Search, User, X } from "lucide-react";
import { FormActions } from "@/components/operator/form-actions";
import { ImagePreviewUploadCard } from "@/components/operator/image-preview-upload-card";
import { RelationalPicker } from "@/components/operator/relational-picker";
import { StatusBadge } from "@/components/operator/status-badge";
import { saveAffiliateProfile } from "../actions";
import { AFFILIATE_PLATFORMS, AFFILIATE_PROFILE_STATUSES } from "@/lib/affiliate-profiles/validation";
import { type AffiliateProfileRecord, type AffiliateProfileWorkspaceLinkRecord } from "@/lib/server/affiliate-profiles";
import { type DriveItemRecord } from "@/lib/server/drive-items";

type AffiliateProfileListRecord = AffiliateProfileRecord & {
  avatarUrl: string | null;
};

type WorkspaceRecord = {
  id: string;
  workspace_code: string;
  workspace_name: string;
  status: string;
  is_default: boolean;
};

type AffiliateProfilesBoardProps = {
  profiles: AffiliateProfileListRecord[];
  workspaces: WorkspaceRecord[];
  driveItems: DriveItemRecord[];
  profileLinks: AffiliateProfileWorkspaceLinkRecord[];
  currentWorkspaceId: string | null;
};

type WorkspaceOption = {
  value: string;
  label: string;
  description: string;
};

type DriveItemOption = {
  value: string;
  label: string;
  description: string;
};

function profileMatchesQuery(profile: AffiliateProfileRecord, query: string) {
  const value = query.trim().toLowerCase();

  if (!value) {
    return true;
  }

  return [
    profile.profile_name,
    profile.platform,
    profile.account_label,
    profile.niche,
    profile.affiliate_url,
    profile.status,
    profile.workspace_ids.join(" "),
  ]
    .join(" ")
    .toLowerCase()
    .includes(value);
}

function workspaceLabel(workspace: WorkspaceRecord | undefined) {
  if (!workspace) {
    return "Workspace tidak tersedia";
  }

  return workspace.workspace_name;
}

function choiceOptions(values: readonly string[]) {
  return values.map((value) => ({
    value,
    label: value,
  }));
}

export function AffiliateProfilesBoard({
  profiles,
  workspaces,
  driveItems,
  profileLinks,
  currentWorkspaceId,
}: AffiliateProfilesBoardProps) {
  const [query, setQuery] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState(profiles[0]?.id ?? "");
  const [isCreating, setIsCreating] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const activeWorkspaces = useMemo(() => workspaces.filter((workspace) => workspace.status === "ACTIVE"), [workspaces]);
  const filteredProfiles = useMemo(() => profiles.filter((profile) => profileMatchesQuery(profile, query)), [profiles, query]);
  const activeProfileCount = useMemo(() => profiles.filter((profile) => profile.status === "ACTIVE").length, [profiles]);
  const selectedProfile =
    isCreating
      ? null
      : filteredProfiles.find((profile) => profile.id === selectedProfileId) ??
        filteredProfiles[0] ??
        profiles.find((profile) => profile.id === selectedProfileId) ??
        null;

  const profileLinksByProfileId = useMemo(() => {
    const map = new Map<string, AffiliateProfileWorkspaceLinkRecord[]>();

    for (const link of profileLinks) {
      const existing = map.get(link.affiliate_profile_id) ?? [];
      existing.push(link);
      map.set(link.affiliate_profile_id, existing);
    }

    return map;
  }, [profileLinks]);

  const driveItemOptions = useMemo<DriveItemOption[]>(
    () =>
      driveItems.map((item) => ({
        value: item.id,
        label: item.name,
        description: [item.item_type, item.purpose, item.drive_path].filter(Boolean).join(" - "),
      })),
    [driveItems],
  );
  const workspaceOptions = useMemo<WorkspaceOption[]>(
    () =>
      activeWorkspaces.map((workspace) => ({
        value: workspace.id,
        label: workspace.workspace_name,
        description: workspace.is_default ? "default" : "",
      })),
    [activeWorkspaces],
  );

  useEffect(() => {
    if (!filteredProfiles.length) {
      setSelectedProfileId("");
      return;
    }

    if (!filteredProfiles.some((profile) => profile.id === selectedProfileId)) {
      setSelectedProfileId(filteredProfiles[0].id);
    }
  }, [filteredProfiles, selectedProfileId]);

  function openCreateDrawer() {
    setIsCreating(true);
    setDrawerOpen(true);
  }

  function openEditDrawer(profileId: string) {
    setIsCreating(false);
    setSelectedProfileId(profileId);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
  }

  const selectedProfileLinks = selectedProfile ? profileLinksByProfileId.get(selectedProfile.id) ?? [] : [];
  const selectedProfileWorkspaceIds = selectedProfile?.workspace_ids ?? [];
  const defaultWorkspaceId =
    (selectedProfile?.default_workspace_id ?? currentWorkspaceId ?? activeWorkspaces[0]?.id ?? "") || "";
  const selectedSeedCharacterDriveItem = useMemo(
    () => driveItems.find((item) => item.id === selectedProfile?.seed_character_drive_item_ref_id) ?? null,
    [driveItems, selectedProfile?.seed_character_drive_item_ref_id],
  );
  const selectedEnvironmentDriveItem = useMemo(
    () => driveItems.find((item) => item.id === selectedProfile?.environment_drive_item_ref_id) ?? null,
    [driveItems, selectedProfile?.environment_drive_item_ref_id],
  );
  const selectedSeedCharacterPreviewUrl =
    selectedSeedCharacterDriveItem?.mime_type?.startsWith("image/") ? selectedSeedCharacterDriveItem.drive_url : null;
  const selectedEnvironmentPreviewUrl =
    selectedEnvironmentDriveItem?.mime_type?.startsWith("image/") ? selectedEnvironmentDriveItem.drive_url : null;

  const formKey = isCreating ? "create-profile" : selectedProfile?.id ?? "edit-profile";
  const initialProfile = selectedProfile ?? null;
  const seedCharacterMissing = (initialProfile?.lock_seed_character ?? true) && !selectedSeedCharacterDriveItem;
  const environmentMissing = (initialProfile?.lock_environment ?? true) && !selectedEnvironmentDriveItem;

  return (
    <section className="product-master settings-manager settings-manager--affiliate" aria-label="Akun Affiliate">
      <div className="product-master__list stack">
        <div className="settings-list-toolbar">
          <label className="product-search" htmlFor="affiliate-profile-search">
            <Search size={16} aria-hidden="true" />
            <input
              id="affiliate-profile-search"
              name="affiliate-profile-search"
              placeholder="Cari profile affiliate"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>

        <div className="settings-inline-summary">
          <span>{activeProfileCount} profile aktif</span>
          <button className="button compact primary" type="button" onClick={openCreateDrawer}>
            <Plus size={15} aria-hidden="true" />
            Profile baru
          </button>
        </div>

        <div className="table-wrap products-table-desktop">
          <table className="data-table product-table">
            <thead>
              <tr>
                <th>Profile</th>
                <th>Status</th>
                <th>Locks</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredProfiles.map((profile) => (
                <tr data-active={selectedProfile?.id === profile.id && !isCreating ? "true" : undefined} key={profile.id}>
                  <td>
                    <div className="affiliate-profile-list__identity">
                      <span className="affiliate-profile-card__avatar" aria-hidden="true">
                        {profile.avatarUrl ? <img alt="" src={profile.avatarUrl} /> : <User size={20} />}
                      </span>
                      <div className="stack-tight">
                        <strong>{profile.profile_name}</strong>
                        <span className="subtle">{profile.niche?.trim() || "Niche belum diisi"}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <StatusBadge status={profile.status} />
                  </td>
                  <td>
                    <div className="product-status-stack">
                      {profile.lock_seed_character ? <StatusBadge status="Character" tone="success" /> : <StatusBadge status="Character open" tone="neutral" />}
                      {profile.lock_environment ? <StatusBadge status="Environment" tone="success" /> : <StatusBadge status="Environment open" tone="neutral" />}
                    </div>
                  </td>
                  <td>
                    <div className="product-row-actions">
                      <button className="button compact" type="button" onClick={() => openEditDrawer(profile.id)}>
                        <PanelRightOpen size={15} aria-hidden="true" />
                        Detail
                      </button>
                      <button className="button compact primary" type="button" onClick={() => openEditDrawer(profile.id)}>
                        <ArrowRight size={15} aria-hidden="true" />
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="products-cards-mobile">
          {filteredProfiles.map((profile) => (
            <article className="product-card settings-list-card affiliate-profile-card" key={profile.id}>
              <div className="affiliate-profile-card__main">
                <span className="affiliate-profile-card__avatar" aria-hidden="true">
                  {profile.avatarUrl ? <img alt="" src={profile.avatarUrl} /> : <User size={20} />}
                </span>
                <div className="affiliate-profile-card__copy">
                  <div className="affiliate-profile-card__title-row">
                    <strong>{profile.profile_name}</strong>
                    <StatusBadge status={profile.status} />
                  </div>
                  <span className="subtle">{profile.niche?.trim() || "Niche belum diisi"}</span>
                  <div className="settings-check-row" aria-label="Asset lock">
                    {profile.lock_seed_character ? (
                      <span className="settings-check-badge">
                        <CheckCircle2 size={13} aria-hidden="true" />
                        Character
                      </span>
                    ) : (
                      <span className="settings-check-badge settings-check-badge--muted">Character open</span>
                    )}
                    {profile.lock_environment ? (
                      <span className="settings-check-badge">
                        <CheckCircle2 size={13} aria-hidden="true" />
                        Environment
                      </span>
                    ) : (
                      <span className="settings-check-badge settings-check-badge--muted">Environment open</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="product-row-actions settings-card-actions action-rail action-rail--pair">
                <button className="button compact tertiary" type="button" onClick={() => openEditDrawer(profile.id)}>
                  <PanelRightOpen size={15} aria-hidden="true" />
                  Detail
                </button>
                <button className="button compact primary" type="button" onClick={() => openEditDrawer(profile.id)}>
                  <ArrowRight size={15} aria-hidden="true" />
                  Edit
                </button>
              </div>
            </article>
          ))}
        </div>

        {!filteredProfiles.length ? (
          <div className="muted-box stack">
            <strong>Belum ada profile affiliate.</strong>
            <span className="subtle">Buat profile pertama untuk workspace aktif.</span>
            <button className="button primary" type="button" onClick={openCreateDrawer}>
              <Plus size={15} aria-hidden="true" />
              Profile baru
            </button>
          </div>
        ) : null}
      </div>

      <div className="product-drawer-backdrop" data-open={drawerOpen ? "true" : "false"} onClick={closeDrawer} />
      <aside className="product-drawer stack" data-open={drawerOpen ? "true" : "false"} aria-label="Detail akun affiliate">
        <div className="settings-bottom-sheet__handle" aria-hidden="true" />
        <div className="section-card__actions product-drawer__header">
          <div className="stack-tight">
            <span className="subtle">{isCreating ? "Profile baru" : "Detail"}</span>
            <strong>{isCreating ? "Buat profile affiliate" : selectedProfile?.profile_name ?? "Pilih profile"}</strong>
            <div className="product-status-stack">
              <StatusBadge status={initialProfile?.status ?? "DRAFT"} />
              <StatusBadge status={`${selectedProfileWorkspaceIds.length || (isCreating ? 1 : 0)} workspace`} tone="info" />
              <StatusBadge
                status={seedCharacterMissing ? "Character missing" : "Character ready"}
                tone={seedCharacterMissing ? "warning" : "success"}
              />
              <StatusBadge
                status={environmentMissing ? "Environment missing" : "Environment ready"}
                tone={environmentMissing ? "warning" : "success"}
              />
            </div>
          </div>
          <button className="button compact product-drawer__close" type="button" onClick={closeDrawer} aria-label="Tutup detail">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {drawerOpen ? (
          <>
            <form key={formKey} className="stack" action={saveAffiliateProfile}>
              <input type="hidden" name="return_to" value="/settings/affiliate-profiles" />
              <input type="hidden" name="intent" value={isCreating ? "create_affiliate_profile" : "update_affiliate_profile"} />
              {!isCreating && initialProfile ? <input type="hidden" name="id" value={initialProfile.id} /> : null}
              <input type="hidden" name="current_seed_character_drive_item_ref_id" value={initialProfile?.seed_character_drive_item_ref_id ?? ""} />
              <input type="hidden" name="current_environment_drive_item_ref_id" value={initialProfile?.environment_drive_item_ref_id ?? ""} />

              <label className="stack auth-field" htmlFor="affiliate-profile-name">
                <span>Profile name</span>
                <input id="affiliate-profile-name" name="profile_name" type="text" placeholder="Fashion TikTok 01" defaultValue={initialProfile?.profile_name ?? ""} required />
              </label>

              <div className="grid two-up">
                <RelationalPicker
                  defaultValue={initialProfile?.platform ?? "TIKTOK"}
                  label="Platform"
                  name="platform"
                  options={choiceOptions(AFFILIATE_PLATFORMS)}
                  placeholder="Pilih platform"
                  required
                  searchable={false}
                />
                <RelationalPicker
                  defaultValue={initialProfile?.status ?? "ACTIVE"}
                  label="Status"
                  name="status"
                  options={choiceOptions(AFFILIATE_PROFILE_STATUSES)}
                  placeholder="Pilih status"
                  required
                  searchable={false}
                />
              </div>

              <details open>
                <summary>Workspace links</summary>
                <div className="stack">
                  <div className="stack-tight">
                    <span className="subtle">Link ke workspace aktif</span>
                    <div className="stack-tight">
                      {activeWorkspaces.map((workspace) => {
                        const isChecked = isCreating
                          ? workspace.id === (currentWorkspaceId ?? activeWorkspaces[0]?.id ?? "")
                          : selectedProfileWorkspaceIds.includes(workspace.id);

                        return (
                          <label className="checkbox-row" key={workspace.id}>
                            <input
                              defaultChecked={isChecked}
                              name="workspace_ids"
                              type="checkbox"
                              value={workspace.id}
                            />
                            <span>{workspaceLabel(workspace)}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <RelationalPicker
                    allowClear
                    defaultValue={defaultWorkspaceId}
                    label="Default workspace"
                    name="default_workspace_id"
                    options={workspaceOptions}
                    placeholder="Pilih default"
                    searchPlaceholder="Cari workspace"
                    searchable={activeWorkspaces.length > 5}
                  />
                  <div className="section-card__actions">
                    <StatusBadge status={`${selectedProfileLinks.length || (isCreating ? 1 : 0)} link`} tone="info" />
                  </div>
                </div>
              </details>

              <section className="stack">
                <div className="section-card__actions">
                  <div className="stack-tight">
                    <span className="subtle">Asset lock</span>
                    <strong>Character dan Environment</strong>
                  </div>
                  <StatusBadge
                    status={seedCharacterMissing || environmentMissing ? "Needs assets" : "Assets ready"}
                    tone={seedCharacterMissing || environmentMissing ? "warning" : "success"}
                  />
                </div>
                <div className="grid two-up">
                  <section className="stack-tight">
                    <ImagePreviewUploadCard
                      clearName="clear_seed_character_drive_item_ref_id"
                      emptyTitle="Belum ada karakter"
                      removedTitle="Referensi dihapus"
                      label="Character"
                      name="seed_character_file"
                      previewAlt={selectedSeedCharacterDriveItem?.name ?? "Character preview"}
                      previewUrl={selectedSeedCharacterPreviewUrl}
                    />
                    <details className="stack-tight">
                      <summary>Referensi Drive</summary>
                      <RelationalPicker
                        allowClear
                        defaultValue={initialProfile?.seed_character_drive_item_ref_id}
                        label="Referensi Character"
                        name="seed_character_drive_item_ref_id"
                        options={driveItemOptions}
                        placeholder="Gunakan karakter kosong."
                        searchPlaceholder="Cari Drive item"
                      />
                    </details>
                  </section>

                  <section className="stack-tight">
                    <ImagePreviewUploadCard
                      clearName="clear_environment_drive_item_ref_id"
                      emptyTitle="Belum ada environment"
                      removedTitle="Referensi dihapus"
                      label="Environment"
                      name="environment_file"
                      previewAlt={selectedEnvironmentDriveItem?.name ?? "Environment preview"}
                      previewUrl={selectedEnvironmentPreviewUrl}
                    />
                    <details className="stack-tight">
                      <summary>Referensi Drive</summary>
                      <RelationalPicker
                        allowClear
                        defaultValue={initialProfile?.environment_drive_item_ref_id}
                        label="Referensi Environment"
                        name="environment_drive_item_ref_id"
                        options={driveItemOptions}
                        placeholder="Gunakan environment otomatis."
                        searchPlaceholder="Cari Drive item"
                      />
                    </details>
                  </section>
                </div>
              </section>

              <details>
                <summary>Lanjutan</summary>
                <div className="stack">
                  <div className="grid two-up">
                    <label className="stack auth-field" htmlFor="affiliate-account-label">
                      <span>Account label</span>
                      <input id="affiliate-account-label" name="account_label" type="text" placeholder="Optional account label" defaultValue={initialProfile?.account_label ?? ""} />
                    </label>
                    <label className="stack auth-field" htmlFor="affiliate-niche">
                      <span>Niche</span>
                      <input id="affiliate-niche" name="niche" type="text" placeholder="Optional niche" defaultValue={initialProfile?.niche ?? ""} />
                    </label>
                  </div>
                  <label className="stack auth-field" htmlFor="affiliate-url">
                    <span>Affiliate URL</span>
                    <input id="affiliate-url" name="affiliate_url" type="url" placeholder="https://..." defaultValue={initialProfile?.affiliate_url ?? ""} />
                  </label>
                </div>
              </details>

              <details>
                <summary>Prompt rules</summary>
                <div className="stack">
                  <div className="grid two-up">
                    <label className="stack auth-field" htmlFor="affiliate-i2i-rules">
                      <span>i2i prompt rules</span>
                      <textarea id="affiliate-i2i-rules" name="i2i_prompt_rules" rows={4} placeholder="Editable rules" defaultValue={initialProfile?.i2i_prompt_rules ?? ""} />
                    </label>
                    <label className="stack auth-field" htmlFor="affiliate-i2v-rules">
                      <span>i2v prompt rules</span>
                      <textarea id="affiliate-i2v-rules" name="i2v_prompt_rules" rows={4} placeholder="Editable rules" defaultValue={initialProfile?.i2v_prompt_rules ?? ""} />
                    </label>
                  </div>
                  <div className="grid two-up">
                    <label className="stack auth-field" htmlFor="affiliate-caption-rules">
                      <span>Caption rules</span>
                      <textarea id="affiliate-caption-rules" name="caption_rules" rows={4} placeholder="Editable rules" defaultValue={initialProfile?.caption_rules ?? ""} />
                    </label>
                    <label className="stack auth-field" htmlFor="affiliate-hashtag-rules">
                      <span>Hashtag/tag rules</span>
                      <textarea id="affiliate-hashtag-rules" name="hashtag_rules" rows={4} placeholder="Editable rules" defaultValue={initialProfile?.hashtag_rules ?? ""} />
                    </label>
                  </div>
                  <label className="stack auth-field" htmlFor="affiliate-negative-rules">
                    <span>Negative prompt rules</span>
                    <textarea id="affiliate-negative-rules" name="negative_prompt_rules" rows={4} placeholder="Editable rules" defaultValue={initialProfile?.negative_prompt_rules ?? ""} />
                  </label>
                  <div className="grid two-up">
                    <div className="muted-box stack-tight">
                      <label className="checkbox-row" htmlFor="lock-seed-character">
                        <input id="lock-seed-character" name="lock_seed_character" type="checkbox" defaultChecked={initialProfile ? initialProfile.lock_seed_character : true} />
                        <span>Lock character seed</span>
                      </label>
                      <StatusBadge status={initialProfile?.lock_seed_character ? "Character locked" : "Character open"} tone={initialProfile?.lock_seed_character ? "success" : "neutral"} />
                    </div>
                    <div className="muted-box stack-tight">
                      <label className="checkbox-row" htmlFor="lock-environment">
                        <input id="lock-environment" name="lock_environment" type="checkbox" defaultChecked={initialProfile ? initialProfile.lock_environment : true} />
                        <span>Lock environment</span>
                      </label>
                      <StatusBadge status={initialProfile?.lock_environment ? "Environment locked" : "Environment open"} tone={initialProfile?.lock_environment ? "success" : "neutral"} />
                    </div>
                  </div>
                </div>
              </details>

            <FormActions layout="single">
              <button className="button primary" type="submit">
                {isCreating ? "Buat profile" : "Simpan profile"}
              </button>
            </FormActions>
            </form>
            {!isCreating && initialProfile ? (
              <FormActions layout="single">
                <form action={saveAffiliateProfile}>
                  <input type="hidden" name="intent" value="archive_affiliate_profile" />
                  <input type="hidden" name="return_to" value="/settings/affiliate-profiles" />
                  <input type="hidden" name="id" value={initialProfile.id} />
                  <button className="button destructive" type="submit" disabled={initialProfile.status === "ARCHIVED"}>
                    Arsipkan
                  </button>
                </form>
              </FormActions>
            ) : null}
          </>
        ) : null}
      </aside>
    </section>
  );
}
