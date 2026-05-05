"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  FileText,
  Link2,
  WandSparkles,
} from "lucide-react";
import { saveIntake } from "@/app/intake/actions";
import { EmptyState } from "@/components/operator/empty-state";
import { FormActions } from "@/components/operator/form-actions";
import { ImagePreviewUploadCard, type ImagePreviewSelectionState } from "@/components/operator/image-preview-upload-card";
import { PendingActionButton } from "@/components/operator/pending-action-button";
import { StatusBadge } from "@/components/operator/status-badge";
import type { JsonRecord } from "@/lib/intake/validation";

type IntakeWorkflowStep = "intake" | "prompt";
type IntakeEvidenceSegment = "produk" | "metadata";

export type IntakeWorkflowSession = {
  id: string;
  intake_code: string;
  status: string;
  workspace_id: string | null;
  product_id: string | null;
  created_at: string;
  product_title: string | null;
  parsed_metadata_json: JsonRecord | null;
  reviewed_metadata_json: JsonRecord | null;
};

type IntakeWorkflowFormProps = {
  affiliateProfiles: Array<{
    id: string;
    profile_name: string;
    account_label: string | null;
    avatarUrl: string | null;
    niche: string | null;
    platform: string;
    status: string;
  }>;
  currentWorkspaceName: string | null;
  initialStep: IntakeWorkflowStep;
  savedSession: IntakeWorkflowSession | null;
  savedSessionWorkspaceName: string | null;
  selectedAffiliateProfileId: string | null;
  showAllWorkspaces: boolean;
};

function readReviewValue(metadata: JsonRecord | null, key: string, fallbackKey?: string) {
  if (!metadata) {
    return "";
  }

  const value = metadata[key];

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  if (fallbackKey) {
    const fallbackValue = metadata[fallbackKey];
    if (typeof fallbackValue === "string") {
      return fallbackValue.trim();
    }
  }

  return "";
}

function promptHref(productId: string, intakeId: string, affiliateProfileId?: string | null) {
  const searchParams = new URLSearchParams({
    product_id: productId,
    intake_id: intakeId,
  });

  if (affiliateProfileId) {
    searchParams.set("affiliate_profile_id", affiliateProfileId);
  }

  return `/prompts?${searchParams.toString()}`;
}

function affiliateInitials(profileName: string) {
  const parts = profileName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return parts.map((part) => part[0]?.toUpperCase()).join("") || "A";
}

function affiliateNicheLabel(profile: IntakeWorkflowFormProps["affiliateProfiles"][number]) {
  return profile.niche?.trim() || "Niche belum diisi";
}

function AffiliateProfileCarousel({
  profiles,
  selectedId,
  onSelect,
}: {
  profiles: IntakeWorkflowFormProps["affiliateProfiles"];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  if (!profiles.length) {
    return <EmptyState icon={FileText} title="Belum ada profil affiliate." description="Atur profil di Pengaturan." />;
  }

  return (
    <section className="stack-tight" aria-label="Profil Affiliate">
      <h3 className="section-card__title">Profil Affiliate</h3>
      <div className="profile-carousel">
        {profiles.map((profile) => {
          const selected = selectedId === profile.id;

          return (
            <button
              aria-pressed={selected}
              className="profile-card"
              data-active={selected ? "true" : undefined}
              key={profile.id}
              type="button"
              onClick={() => onSelect(profile.id)}
            >
              <span className="profile-card__avatar" aria-hidden="true">
                {profile.avatarUrl ? <img alt="" src={profile.avatarUrl} /> : <span>{affiliateInitials(profile.profile_name)}</span>}
              </span>
              <span className="profile-card__copy">
                <strong>{profile.profile_name}</strong>
                <span className="subtle">{affiliateNicheLabel(profile)}</span>
              </span>
              <span className={`button compact ${selected ? "primary" : ""}`}>
                {selected ? "Aktif" : "Pilih"}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ReviewInput({
  defaultValue,
  label,
  name,
  placeholder,
}: {
  defaultValue: string;
  label: string;
  name: string;
  placeholder?: string;
}) {
  return (
    <label className="stack-tight" htmlFor={name}>
      <span className="subtle">{label}</span>
      <input id={name} name={name} placeholder={placeholder} defaultValue={defaultValue} />
    </label>
  );
}

function ReviewTextarea({
  defaultValue,
  label,
  name,
  placeholder,
  rows = 3,
}: {
  defaultValue: string;
  label: string;
  name: string;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="stack-tight" htmlFor={name}>
      <span className="subtle">{label}</span>
      <textarea id={name} name={name} placeholder={placeholder} rows={rows} defaultValue={defaultValue} />
    </label>
  );
}

function AnalysisReadyPanel({
  affiliateProfileId,
  currentWorkspaceName,
  savedSession,
  showAllWorkspaces,
  savedSessionWorkspaceName,
}: {
  affiliateProfileId: string | null;
  currentWorkspaceName: string | null;
  savedSession: IntakeWorkflowSession;
  showAllWorkspaces: boolean;
  savedSessionWorkspaceName: string | null;
}) {
  const reviewSource = savedSession.reviewed_metadata_json ?? savedSession.parsed_metadata_json;
  const workspaceName = savedSessionWorkspaceName ?? currentWorkspaceName ?? "Tidak ada workspace";

  const defaultNamaProduk = readReviewValue(reviewSource, "nama_produk", "product_title") || savedSession.product_title || "";
  const defaultKeyword = readReviewValue(reviewSource, "keyword_cari_etalase", "category");
  const defaultDeskripsi = readReviewValue(reviewSource, "deskripsi_visual");
  const defaultUseCase = readReviewValue(reviewSource, "use_case");
  const defaultPainPoint = readReviewValue(reviewSource, "pain_point");
  const defaultSellingAngle = readReviewValue(reviewSource, "selling_angle");
  const defaultTargetViewer = readReviewValue(reviewSource, "target_viewer");
  const promptProductId = savedSession.status === "REVIEWED" ? savedSession.product_id : null;

  return (
    <form action={saveIntake} className="stack">
      <input type="hidden" name="intent" value="review_metadata" />
      <input type="hidden" name="id" value={savedSession.id} />
      <input type="hidden" name="workspace_scope" value={showAllWorkspaces ? "all" : ""} />
      <input type="hidden" name="affiliate_profile_id" value={affiliateProfileId ?? ""} />

      <section className="prompt-preview-panel stack">
        <div className="section-card__actions">
          <div className="stack-tight">
            <h3>Review metadata</h3>
          </div>
          <StatusBadge status={savedSession.status} tone={savedSession.status === "REVIEWED" ? "success" : "info"} />
        </div>

        <div className="grid two-up">
          <ReviewInput label="Nama Produk" name="review_nama_produk" defaultValue={defaultNamaProduk} placeholder="Nama produk" />
          <ReviewInput
            label="Keyword Cari Etalase"
            name="review_keyword_cari_etalase"
            defaultValue={defaultKeyword}
            placeholder="Keyword etalase"
          />
          <ReviewTextarea
            label="Deskripsi Visual"
            name="review_deskripsi_visual"
            defaultValue={defaultDeskripsi}
            placeholder="Deskripsi visual"
          />
          <ReviewInput label="Use Case" name="review_use_case" defaultValue={defaultUseCase} placeholder="Use case" />
          <ReviewInput label="Pain Point" name="review_pain_point" defaultValue={defaultPainPoint} placeholder="Pain point" />
          <ReviewInput
            label="Selling Angle"
            name="review_selling_angle"
            defaultValue={defaultSellingAngle}
            placeholder="Selling angle"
          />
          <ReviewInput
            label="Target Viewer"
            name="review_target_viewer"
            defaultValue={defaultTargetViewer}
            placeholder="Target viewer"
          />
        </div>

        <FormActions layout="triple">
          <PendingActionButton
            activityDescription="Menyimpan metadata yang sudah direview."
            activityKind="generic"
            activityTitle="Menyimpan review"
            className="button primary"
            estimatedDurationMs={7000}
            pendingLabel="Menyimpan"
            disabled={!savedSession.id}
          >
            Simpan Review
          </PendingActionButton>
          {promptProductId ? (
            <Link className="button primary" href={promptHref(promptProductId, savedSession.id, affiliateProfileId)}>
              <FileText size={16} aria-hidden="true" />
              Buat Prompt
            </Link>
          ) : null}
          {savedSession.product_id ? (
            <Link className="button tertiary" href={`/products/${savedSession.product_id}`}>
              <Link2 size={16} aria-hidden="true" />
              Produk
            </Link>
          ) : null}
        </FormActions>
      </section>
    </form>
  );
}

export function IntakeWorkflowForm({
  affiliateProfiles,
  currentWorkspaceName,
  initialStep,
  savedSession,
  savedSessionWorkspaceName,
  selectedAffiliateProfileId,
  showAllWorkspaces,
}: IntakeWorkflowFormProps) {
  const [step, setStep] = useState<IntakeWorkflowStep>(initialStep);
  const [activeSegment, setActiveSegment] = useState<IntakeEvidenceSegment>("produk");
  const [productImage, setProductImage] = useState<ImagePreviewSelectionState>({ selected: false, fileName: null, previewUrl: null });
  const [shopeeScreenshot, setShopeeScreenshot] = useState<ImagePreviewSelectionState>({ selected: false, fileName: null, previewUrl: null });
  const [tiktokScreenshot, setTiktokScreenshot] = useState<ImagePreviewSelectionState>({ selected: false, fileName: null, previewUrl: null });
  const [affiliateProfileId, setAffiliateProfileId] = useState(selectedAffiliateProfileId ?? affiliateProfiles[0]?.id ?? "");

  useEffect(() => {
    setStep(initialStep);
  }, [initialStep, savedSession?.id]);

  useEffect(() => {
    setAffiliateProfileId(selectedAffiliateProfileId ?? affiliateProfiles[0]?.id ?? "");
  }, [affiliateProfiles, selectedAffiliateProfileId]);

  const hasMinimum = productImage.selected && shopeeScreenshot.selected && tiktokScreenshot.selected;

  return (
    <section className="intake-workflow stack">
      {step === "intake" ? (
        <form action={saveIntake} className="stack">
          <input type="hidden" name="intent" value="parse_intake" />
          <input type="hidden" name="workspace_scope" value={showAllWorkspaces ? "all" : ""} />
          <input type="hidden" name="affiliate_profile_id" value={affiliateProfileId} />
          <div className="intake-segment-control" role="tablist" aria-label="Evidence intake">
            <button
              aria-selected={activeSegment === "produk"}
              className="intake-segment-control__button"
              data-active={activeSegment === "produk" ? "true" : undefined}
              role="tab"
              type="button"
              onClick={() => setActiveSegment("produk")}
            >
              Produk
            </button>
            <button
              aria-selected={activeSegment === "metadata"}
              className="intake-segment-control__button"
              data-active={activeSegment === "metadata" ? "true" : undefined}
              role="tab"
              type="button"
              onClick={() => setActiveSegment("metadata")}
            >
              Metadata
            </button>
          </div>

          <div className="intake-segment-panels">
            <section
              aria-hidden={activeSegment !== "produk"}
              className="intake-segment-panel"
              data-active={activeSegment === "produk" ? "true" : undefined}
            >
              <ImagePreviewUploadCard
                label="Foto Produk Utama"
                name="product_image"
                cameraName="product_image_camera"
                capture="environment"
                emptyTitle="Tambah gambar"
                previewAlt="Foto Produk Utama preview"
                required
                onSelectionChange={setProductImage}
              />
              <AffiliateProfileCarousel profiles={affiliateProfiles} selectedId={affiliateProfileId} onSelect={setAffiliateProfileId} />
            </section>

            <section
              aria-hidden={activeSegment !== "metadata"}
              className="intake-segment-panel"
              data-active={activeSegment === "metadata" ? "true" : undefined}
            >
              <ImagePreviewUploadCard
                label="Screenshot Shopee"
                name="shopee_screenshot"
                emptyTitle="Tambah gambar"
                previewAlt="Screenshot Shopee preview"
                required
                onSelectionChange={setShopeeScreenshot}
              />
              <ImagePreviewUploadCard
                label="Screenshot TikTok"
                name="tiktok_screenshot"
                emptyTitle="Tambah gambar"
                previewAlt="Screenshot TikTok preview"
                required
                onSelectionChange={setTiktokScreenshot}
              />
            </section>
          </div>
          {!hasMinimum ? (
            <div className="error-box status-box" role="alert">
              <AlertTriangle size={17} aria-hidden="true" />
              <span>Unggah semua evidence dulu.</span>
            </div>
          ) : null}
          <FormActions layout="single">
            <PendingActionButton
              activityDescription="Menunggu Gemini memproses evidence."
              activityKind="analysis"
              activityTitle="Menganalisis gambar"
              className="button primary"
              estimatedDurationMs={22000}
              pendingLabel="Memproses"
              disabled={!hasMinimum}
            >
              Analisis Gemini
            </PendingActionButton>
          </FormActions>
        </form>
      ) : savedSession ? (
        <AnalysisReadyPanel
          affiliateProfileId={affiliateProfileId}
          currentWorkspaceName={currentWorkspaceName}
          savedSession={savedSession}
          showAllWorkspaces={showAllWorkspaces}
          savedSessionWorkspaceName={savedSessionWorkspaceName}
        />
      ) : (
        <EmptyState icon={WandSparkles} title="Belum ada analisis." description="Unggah evidence dulu." />
      )}
    </section>
  );
}
