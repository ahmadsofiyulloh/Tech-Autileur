"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Plus, PanelRightOpen, Search, User, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { FormActions } from "@/components/operator/form-actions";
import { ImagePreviewUploadCard } from "@/components/operator/image-preview-upload-card";
import { RelationalPicker } from "@/components/operator/relational-picker";
import { StatusBadge } from "@/components/operator/status-badge";
import { PendingActionButton } from "@/components/operator/pending-action-button";
import { DeleteActionButton } from "@/components/ui/delete-action-button";
import { OverflowActionMenu } from "@/components/ui/overflow-action-menu";
import { reanalyzeAffiliateProfileAsset, saveAffiliateProfile } from "../actions";
import { AFFILIATE_PLATFORMS, AFFILIATE_PROFILE_STATUSES } from "@/lib/affiliate-profiles/validation";
import { getAffiliateProfileAssetAnalysisState, type AffiliateProfileAssetAnalysisState } from "@/lib/affiliate-profiles/readiness";
import { type AffiliateProfileRecord } from "@/lib/server/affiliate-profiles";
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
  currentWorkspaceId: string | null;
};

type DriveItemOption = {
  value: string;
  label: string;
  description: string;
};

type ReanalysisKind = "CHARACTER" | "ENVIRONMENT";
type RouteFeedbackTone = "success" | "warning" | "error";
type RouteFeedback = {
  tone: RouteFeedbackTone;
  title: string;
  message: string;
};

function routeFeedbackTitle(tone: RouteFeedbackTone) {
  if (tone === "error") {
    return "Gagal";
  }

  if (tone === "warning") {
    return "Perhatian";
  }

  return "Selesai";
}

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

function choiceOptions(values: readonly string[]) {
  return values.map((value) => ({
    value,
    label: value,
  }));
}

function isVisibleProfile(profile: AffiliateProfileRecord) {
  return profile.status !== "ARCHIVED";
}

function profileMobileMeta(profile: AffiliateProfileRecord) {
  return [
    profile.lock_seed_character ? "Character locked" : "Character open",
    profile.lock_environment ? "Environment locked" : "Environment open",
  ].join(" - ");
}

function assetAnalysisBadgeLabel(state: AffiliateProfileAssetAnalysisState) {
  if (state === "READY") {
    return "Analisis siap";
  }

  if (state === "OPTIONAL") {
    return "Opsional";
  }

  return "Analisis pending";
}

function assetAnalysisBadgeTone(state: AffiliateProfileAssetAnalysisState) {
  if (state === "READY") {
    return "success";
  }

  if (state === "OPTIONAL") {
    return "neutral";
  }

  return "warning";
}

export function AffiliateProfilesBoard({
  profiles,
  workspaces,
  driveItems,
  currentWorkspaceId,
}: AffiliateProfilesBoardProps) {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState(profiles.find(isVisibleProfile)?.id ?? "");
  const [isCreating, setIsCreating] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pendingReanalysisKind, setPendingReanalysisKind] = useState<ReanalysisKind | null>(null);

  const activeWorkspaces = useMemo(() => workspaces.filter((workspace) => workspace.status === "ACTIVE"), [workspaces]);
  const visibleProfiles = useMemo(() => profiles.filter(isVisibleProfile), [profiles]);
  const filteredProfiles = useMemo(() => visibleProfiles.filter((profile) => profileMatchesQuery(profile, query)), [query, visibleProfiles]);
  const activeProfileCount = useMemo(() => visibleProfiles.filter((profile) => profile.status === "ACTIVE").length, [visibleProfiles]);
  const routeFeedback = useMemo<RouteFeedback | null>(() => {
    const error = searchParams.get("error")?.trim();
    const warning = searchParams.get("warning")?.trim();
    const message = searchParams.get("message")?.trim();
    const value = error || warning || message;

    if (!value) {
      return null;
    }

    const tone: RouteFeedbackTone = error ? "error" : warning ? "warning" : "success";

    return {
      tone,
      title: routeFeedbackTitle(tone),
      message: value,
    };
  }, [searchParams]);
  const selectedProfile =
    isCreating
      ? null
      : filteredProfiles.find((profile) => profile.id === selectedProfileId) ??
        filteredProfiles[0] ??
        visibleProfiles.find((profile) => profile.id === selectedProfileId) ??
        null;

  const driveItemOptions = useMemo<DriveItemOption[]>(
    () =>
      driveItems
        .filter((item) => item.status !== "ARCHIVED")
        .map((item) => ({
          value: item.id,
          label: item.name,
          description: [item.item_type, item.purpose, item.drive_path].filter(Boolean).join(" - "),
        })),
    [driveItems],
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

  useEffect(() => {
    if (!drawerOpen) {
      setPendingReanalysisKind(null);
    }
  }, [drawerOpen]);

  useEffect(() => {
    if (routeFeedback) {
      setPendingReanalysisKind(null);
    }
  }, [routeFeedback]);

  const namespaceWorkspaceId =
    (selectedProfile?.default_workspace_id ?? selectedProfile?.workspace_ids[0] ?? currentWorkspaceId ?? activeWorkspaces[0]?.id ?? "") || "";
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
  const initialProfile = selectedProfile ?? null;
  const visiblePendingReanalysisKind = routeFeedback ? null : pendingReanalysisKind;
  const seedCharacterAnalysisState = getAffiliateProfileAssetAnalysisState({
    locked: initialProfile?.lock_seed_character ?? true,
    driveItemRefId: initialProfile?.seed_character_drive_item_ref_id,
    analysisJson: initialProfile?.seed_character_analysis_json,
  });
  const environmentAnalysisState = getAffiliateProfileAssetAnalysisState({
    locked: initialProfile?.lock_environment ?? true,
    driveItemRefId: initialProfile?.environment_drive_item_ref_id,
    analysisJson: initialProfile?.environment_analysis_json,
  });
  const overallAnalysisState: AffiliateProfileAssetAnalysisState =
    seedCharacterAnalysisState === "PENDING" || environmentAnalysisState === "PENDING" ? "PENDING" : "READY";

  const formKey = isCreating ? "create-profile" : selectedProfile?.id ?? "edit-profile";
  const characterAnalysisDisabled = !initialProfile?.seed_character_drive_item_ref_id;
  const environmentAnalysisDisabled = !initialProfile?.environment_drive_item_ref_id;

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

        {!drawerOpen && routeFeedback ? (
          <div className="settings-action-feedback" data-tone={routeFeedback.tone} role={routeFeedback.tone === "error" ? "alert" : "status"} aria-live={routeFeedback.tone === "error" ? "assertive" : "polite"}>
            <strong>{routeFeedback.title}</strong>
            <span className="subtle">{routeFeedback.message}</span>
          </div>
        ) : null}

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
                      <form action={saveAffiliateProfile}>
                        <input type="hidden" name="intent" value="archive_affiliate_profile" />
                        <input type="hidden" name="return_to" value="/settings/affiliate-profiles" />
                        <input type="hidden" name="id" value={profile.id} />
                        <DeleteActionButton confirmMessage={`Hapus profile "${profile.profile_name}"?`} />
                      </form>
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
                  <span className="settings-card-meta-line">{profileMobileMeta(profile)}</span>
                </div>
              </div>
              <div className="mobile-card-actions">
                <button className="button compact primary" type="button" onClick={() => openEditDrawer(profile.id)}>
                  <PanelRightOpen size={15} aria-hidden="true" />
                  Kelola
                </button>
                <OverflowActionMenu>
                  <form action={saveAffiliateProfile}>
                    <input type="hidden" name="intent" value="archive_affiliate_profile" />
                    <input type="hidden" name="return_to" value="/settings/affiliate-profiles" />
                    <input type="hidden" name="id" value={profile.id} />
                    <DeleteActionButton confirmMessage={`Hapus profile "${profile.profile_name}"?`} />
                  </form>
                </OverflowActionMenu>
              </div>
            </article>
          ))}
        </div>

        {!filteredProfiles.length ? (
          <div className="muted-box stack">
            <strong>Belum ada profile affiliate.</strong>
            <span className="subtle">Buat profile pertama.</span>
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
              <StatusBadge status={overallAnalysisState === "PENDING" ? "Analisis pending" : "Analisis siap"} tone={overallAnalysisState === "PENDING" ? "warning" : "success"} />
              <StatusBadge status={assetAnalysisBadgeLabel(seedCharacterAnalysisState)} tone={assetAnalysisBadgeTone(seedCharacterAnalysisState)} />
              <StatusBadge status={assetAnalysisBadgeLabel(environmentAnalysisState)} tone={assetAnalysisBadgeTone(environmentAnalysisState)} />
            </div>
          </div>
          <button className="button compact product-drawer__close" type="button" onClick={closeDrawer} aria-label="Tutup detail">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {drawerOpen ? (
          <>
            {routeFeedback ? (
              <div className="settings-action-feedback" data-tone={routeFeedback.tone} role={routeFeedback.tone === "error" ? "alert" : "status"} aria-live={routeFeedback.tone === "error" ? "assertive" : "polite"}>
                <strong>{routeFeedback.title}</strong>
                <span className="subtle">{routeFeedback.message}</span>
              </div>
            ) : null}
            {!isCreating && initialProfile ? (
              <>
                <form hidden id="reanalyze-seed-character-form" action={reanalyzeAffiliateProfileAsset}>
                  <input type="hidden" name="id" value={initialProfile.id} />
                  <input type="hidden" name="kind" value="CHARACTER" />
                  <input type="hidden" name="current_seed_character_drive_item_ref_id" value={initialProfile.seed_character_drive_item_ref_id ?? ""} />
                  <input type="hidden" name="return_to" value="/settings/affiliate-profiles" />
                </form>
                <form hidden id="reanalyze-environment-form" action={reanalyzeAffiliateProfileAsset}>
                  <input type="hidden" name="id" value={initialProfile.id} />
                  <input type="hidden" name="kind" value="ENVIRONMENT" />
                  <input type="hidden" name="current_environment_drive_item_ref_id" value={initialProfile.environment_drive_item_ref_id ?? ""} />
                  <input type="hidden" name="return_to" value="/settings/affiliate-profiles" />
                </form>
              </>
            ) : null}
            <form key={formKey} className="stack" action={saveAffiliateProfile}>
              <input type="hidden" name="return_to" value="/settings/affiliate-profiles" />
              <input type="hidden" name="intent" value={isCreating ? "create_affiliate_profile" : "update_affiliate_profile"} />
              {!isCreating && initialProfile ? <input type="hidden" name="id" value={initialProfile.id} /> : null}
              <input type="hidden" name="current_seed_character_drive_item_ref_id" value={initialProfile?.seed_character_drive_item_ref_id ?? ""} />
              <input type="hidden" name="current_environment_drive_item_ref_id" value={initialProfile?.environment_drive_item_ref_id ?? ""} />
              <input type="hidden" name="workspace_ids" value={namespaceWorkspaceId} />
              <input type="hidden" name="default_workspace_id" value={namespaceWorkspaceId} />

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

              <section className="stack">
                <div className="section-card__actions">
                  <div className="stack-tight">
                    <span className="subtle">Asset lock</span>
                    <strong>Character dan Environment</strong>
                  </div>
                  <StatusBadge status={overallAnalysisState === "PENDING" ? "Analisis pending" : "Analisis siap"} tone={overallAnalysisState === "PENDING" ? "warning" : "success"} />
                </div>
                {visiblePendingReanalysisKind ? (
                  <div className="settings-action-feedback" data-tone="warning" role="status" aria-live="polite">
                    <strong>
                      {visiblePendingReanalysisKind === "CHARACTER" ? "Menganalisis Character" : "Menganalisis Environment"}
                    </strong>
                    <span className="subtle">Menunggu Gemini memproses bytes Drive dan menyimpan JSON.</span>
                  </div>
                ) : null}
                <div className="affiliate-profile-assets-grid">
                  <section className="affiliate-profile-asset-card stack-tight">
                    <ImagePreviewUploadCard
                      clearName="clear_seed_character_drive_item_ref_id"
                      className="affiliate-profile-asset-card__preview"
                      emptyTitle="Belum ada karakter"
                      removedTitle="Referensi dihapus"
                      label="Character"
                      name="seed_character_file"
                      previewAlt={selectedSeedCharacterDriveItem?.name ?? "Character preview"}
                      previewUrl={selectedSeedCharacterPreviewUrl}
                    />
                    <div className="muted-box stack-tight">
                      <label className="checkbox-row" htmlFor={`${formKey}-lock-seed-character`}>
                        <input
                          id={`${formKey}-lock-seed-character`}
                          name="lock_seed_character"
                          type="checkbox"
                          defaultChecked={initialProfile ? initialProfile.lock_seed_character : true}
                        />
                        <span>Lock Character</span>
                      </label>
                      <StatusBadge status={assetAnalysisBadgeLabel(seedCharacterAnalysisState)} tone={assetAnalysisBadgeTone(seedCharacterAnalysisState)} />
                    </div>
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
                    {!isCreating && initialProfile ? (
                      <PendingActionButton
                        activityDescription="Membaca bytes Drive dan menyimpan JSON Character."
                        activityKind="analysis"
                        activityTitle="Menganalisis Character"
                        className="button compact tertiary affiliate-profile-asset-card__reanalyse"
                        disabled={characterAnalysisDisabled}
                        form="reanalyze-seed-character-form"
                        pendingLabel="Menganalisis..."
                        pendingOverride={visiblePendingReanalysisKind === "CHARACTER"}
                        onClick={() => setPendingReanalysisKind("CHARACTER")}
                      >
                        Analisis ulang
                      </PendingActionButton>
                    ) : null}
                  </section>

                  <section className="affiliate-profile-asset-card stack-tight">
                    <ImagePreviewUploadCard
                      clearName="clear_environment_drive_item_ref_id"
                      className="affiliate-profile-asset-card__preview"
                      emptyTitle="Belum ada environment"
                      removedTitle="Referensi dihapus"
                      label="Environment"
                      name="environment_file"
                      previewAlt={selectedEnvironmentDriveItem?.name ?? "Environment preview"}
                      previewUrl={selectedEnvironmentPreviewUrl}
                    />
                    <div className="muted-box stack-tight">
                      <label className="checkbox-row" htmlFor={`${formKey}-lock-environment`}>
                        <input
                          id={`${formKey}-lock-environment`}
                          name="lock_environment"
                          type="checkbox"
                          defaultChecked={initialProfile ? initialProfile.lock_environment : true}
                        />
                        <span>Lock Environment</span>
                      </label>
                      <StatusBadge status={assetAnalysisBadgeLabel(environmentAnalysisState)} tone={assetAnalysisBadgeTone(environmentAnalysisState)} />
                    </div>
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
                    {!isCreating && initialProfile ? (
                      <PendingActionButton
                        activityDescription="Membaca bytes Drive dan menyimpan JSON Environment."
                        activityKind="analysis"
                        activityTitle="Menganalisis Environment"
                        className="button compact tertiary affiliate-profile-asset-card__reanalyse"
                        disabled={environmentAnalysisDisabled}
                        form="reanalyze-environment-form"
                        pendingLabel="Menganalisis..."
                        pendingOverride={visiblePendingReanalysisKind === "ENVIRONMENT"}
                        onClick={() => setPendingReanalysisKind("ENVIRONMENT")}
                      >
                        Analisis ulang
                      </PendingActionButton>
                    ) : null}
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
                </div>
              </details>

            <FormActions layout="single">
              <PendingActionButton
                activityDescription="Menyimpan metadata profile, rules, lock, dan Drive ref."
                activityKind="generic"
                activityTitle={isCreating ? "Membuat profile affiliate" : "Menyimpan profile affiliate"}
                className="primary"
                estimatedDurationMs={12000}
                pendingLabel={isCreating ? "Membuat..." : "Menyimpan..."}
              >
                {isCreating ? "Buat profile" : "Simpan profile"}
              </PendingActionButton>
            </FormActions>
            </form>
            {!isCreating && initialProfile ? (
              <FormActions layout="single">
                <form action={saveAffiliateProfile}>
                  <input type="hidden" name="intent" value="archive_affiliate_profile" />
                  <input type="hidden" name="return_to" value="/settings/affiliate-profiles" />
                  <input type="hidden" name="id" value={initialProfile.id} />
                  <DeleteActionButton
                    confirmMessage={`Hapus profile "${initialProfile.profile_name}"?`}
                    disabled={initialProfile.status === "ARCHIVED"}
                  />
                </form>
              </FormActions>
            ) : null}
          </>
        ) : null}
      </aside>
    </section>
  );
}
