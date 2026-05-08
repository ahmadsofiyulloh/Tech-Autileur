"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  AlertTriangle,
  FileText,
  Link2,
  Loader2,
} from "lucide-react";
import { saveIntake } from "@/app/intake/actions";
import { EmptyState } from "@/components/operator/empty-state";
import { FormActions } from "@/components/operator/form-actions";
import { ImagePreviewUploadCard, type ImagePreviewSelectionState } from "@/components/operator/image-preview-upload-card";
import { SkeletonIntakeMetadataPreview } from "@/components/operator/loading-skeleton";
import { PromptLaunchReadinessSummary } from "@/components/operator/prompt-launch-readiness-summary";
import { PendingActionButton } from "@/components/operator/pending-action-button";
import { StatusBadge } from "@/components/operator/status-badge";
import type { JsonRecord } from "@/lib/intake/validation";
import type { PromptLaunchReadiness } from "@/lib/prompts/prompt-launch-readiness";

type IntakeWorkflowStep = "intake" | "prompt";
type IntakeSubmitIntent = "save_product_capture" | "analyze_metadata" | null;

export type IntakeWorkflowSession = {
  id: string;
  intake_code: string;
  status: string;
  workspace_id: string | null;
  product_id: string | null;
  created_at: string;
  product_title: string | null;
  error_message: string | null;
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
  promptLaunchReadiness: PromptLaunchReadiness | null;
  showAllWorkspaces: boolean;
  savedSessionEvidencePreviewUrls?: {
    productImage: string | null;
    shopeeScreenshot: string | null;
    tiktokScreenshot: string | null;
  };
  draftQueue: Array<{
    id: string;
    productId: string | null;
    title: string;
    status: string;
    errorMessage: string | null;
    createdAtLabel: string;
    productImagePreviewUrl: string | null;
    shopeeReady: boolean;
    tiktokReady: boolean;
    continueHref: string;
  }>;
};

type IntakeAffiliateProfile = IntakeWorkflowFormProps["affiliateProfiles"][number];

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

function readSubmitIntent(event: FormEvent<HTMLFormElement>): IntakeSubmitIntent {
  const submitter = (event.nativeEvent as SubmitEvent).submitter;

  if (!(submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement)) {
    return null;
  }

  if (submitter.name !== "intent") {
    return null;
  }

  if (submitter.value === "save_product_capture" || submitter.value === "analyze_metadata") {
    return submitter.value;
  }

  return null;
}

function IntakePendingIntentBridge({
  onPendingIntentChange,
  submittedIntent,
}: {
  onPendingIntentChange: (intent: IntakeSubmitIntent) => void;
  submittedIntent: IntakeSubmitIntent;
}) {
  const { pending } = useFormStatus();

  useEffect(() => {
    onPendingIntentChange(pending ? submittedIntent : null);
  }, [onPendingIntentChange, pending, submittedIntent]);

  return null;
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

function affiliatePlatformLabel(platform: string) {
  const normalized = platform.trim().toUpperCase();

  if (!normalized) {
    return "Platform belum diisi";
  }

  if (normalized === "TIKTOK") {
    return "TikTok";
  }

  if (normalized === "SHOPEE") {
    return "Shopee";
  }

  if (normalized === "INSTAGRAM") {
    return "Instagram";
  }

  if (normalized === "FACEBOOK") {
    return "Facebook";
  }

  return normalized.charAt(0) + normalized.slice(1).toLowerCase();
}

function ActiveAffiliateProfileCard({ profile }: { profile: IntakeAffiliateProfile | null }) {
  if (!profile) {
    return (
      <EmptyState
        action={
          <Link className="button compact primary" href="/settings/affiliate-profiles">
            <Link2 size={16} aria-hidden="true" />
            Buka pengaturan
          </Link>
        }
        icon={FileText}
        title="Belum ada Akun Affiliate aktif."
        description="Atur Akun Affiliate dulu."
      />
    );
  }

  const manageHref = `/settings/affiliate-profiles?profile_id=${encodeURIComponent(profile.id)}`;
  const accountLabel = profile.account_label?.trim() || "Label akun belum diisi";

  return (
    <section className="intake-active-affiliate-card" aria-label="Akun Affiliate aktif">
      <span className="settings-affiliate-profile-card__avatar" aria-hidden="true">
        {profile.avatarUrl ? <img alt="" src={profile.avatarUrl} /> : <span>{affiliateInitials(profile.profile_name)}</span>}
      </span>
      <div className="intake-active-affiliate-card__copy">
        <div className="intake-active-affiliate-card__title-row">
          <strong>{profile.profile_name}</strong>
          <StatusBadge status={profile.status} />
        </div>
        <span className="settings-card-meta-line">{accountLabel}</span>
        <span className="settings-card-meta-line">
          {affiliatePlatformLabel(profile.platform)}
          {" | "}
          {affiliateNicheLabel(profile)}
        </span>
      </div>
      <Link className="button compact intake-active-affiliate-card__action" href={manageHref}>
        <Link2 size={16} aria-hidden="true" />
        Kelola
      </Link>
    </section>
  );
}

function IntakeMetadataPendingPanel({ status }: { status: string }) {
  return (
    <section className="stack" aria-busy="true" aria-live="polite">
      <div className="section-card__actions">
        <div className="stack-tight">
          <h3>{status === "SUBMITTED" ? "Metadata sedang diproses" : "Metadata belum dianalisis"}</h3>
        </div>
        <StatusBadge status={status} tone="info" />
      </div>
      {status === "SUBMITTED" ? <SkeletonIntakeMetadataPreview /> : null}
    </section>
  );
}

function IntakeMetadataEmptyPanel() {
  return (
    <section className="prompt-preview-panel stack">
      <div className="section-card__actions">
        <div className="stack-tight">
          <h3>Metadata siap muncul di sini</h3>
        </div>
        <StatusBadge status="DRAFT" tone="info" />
      </div>
    </section>
  );
}

function IntakeMetadataFailedPanel({
  affiliateProfileId,
  savedSession,
  showAllWorkspaces,
}: {
  affiliateProfileId: string | null;
  savedSession: IntakeWorkflowSession;
  showAllWorkspaces: boolean;
}) {
  const retryParams = new URLSearchParams({
    step: "intake",
    intake_id: savedSession.id,
  });

  if (showAllWorkspaces) {
    retryParams.set("workspace", "all");
  }

  if (affiliateProfileId) {
    retryParams.set("affiliate_profile_id", affiliateProfileId);
  }

  return (
    <EmptyState
      action={
        <Link className="button primary" href={`/products/new?${retryParams.toString()}`}>
          <Link2 size={16} aria-hidden="true" />
          Kembali ke intake
        </Link>
      }
      icon={AlertTriangle}
      title="Analisis metadata gagal."
      description={savedSession.error_message || "Draft tersimpan. Coba ulang."}
    />
  );
}

function DraftQueuePanel({ drafts }: { drafts: IntakeWorkflowFormProps["draftQueue"] }) {
  if (!drafts.length) {
    return null;
  }

  return (
    <section className="intake-draft-queue stack-tight" aria-label="Draft tersimpan">
      <div className="section-card__actions">
        <h3>Draft tersimpan</h3>
        <StatusBadge status={`${drafts.length} draft`} tone="info" />
      </div>
      <div className="intake-draft-queue__list">
        {drafts.map((draft) => (
          <article className="intake-draft-queue__item" key={draft.id}>
            <div className="intake-draft-queue__preview" aria-hidden="true">
              {draft.productImagePreviewUrl ? <img alt="" src={draft.productImagePreviewUrl} /> : <FileText size={18} aria-hidden="true" />}
            </div>
            <div className="intake-draft-queue__copy">
              <strong title={draft.title}>{draft.title}</strong>
              <span>
                {draft.createdAtLabel}
                {" | "}
                Shopee {draft.shopeeReady ? "OK" : "-"}
                {" | "}
                TikTok {draft.tiktokReady ? "OK" : "-"}
              </span>
              {draft.errorMessage ? <small title={draft.errorMessage}>{draft.errorMessage}</small> : null}
            </div>
            <div className="intake-draft-queue__actions">
              <StatusBadge status={draft.status} tone={draft.status === "ERROR" ? "danger" : "info"} />
              <Link className="button compact primary" href={draft.continueHref}>
                <Link2 size={15} aria-hidden="true" />
                Lanjutkan
              </Link>
            </div>
          </article>
        ))}
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
  promptLaunchReadiness,
  showAllWorkspaces,
  savedSessionWorkspaceName,
}: {
  affiliateProfileId: string | null;
  currentWorkspaceName: string | null;
  savedSession: IntakeWorkflowSession;
  promptLaunchReadiness: PromptLaunchReadiness | null;
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
            className="button primary"
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
        {promptLaunchReadiness && !promptLaunchReadiness.ready ? (
          <PromptLaunchReadinessSummary readiness={promptLaunchReadiness} />
        ) : null}
      </section>
    </form>
  );
}

function hasSessionMetadata(savedSession: IntakeWorkflowSession) {
  return Boolean(savedSession.reviewed_metadata_json || savedSession.parsed_metadata_json);
}

export function IntakeWorkflowForm({
  affiliateProfiles,
  currentWorkspaceName,
  initialStep,
  promptLaunchReadiness,
  savedSession,
  savedSessionWorkspaceName,
  selectedAffiliateProfileId,
  savedSessionEvidencePreviewUrls,
  showAllWorkspaces,
  draftQueue,
}: IntakeWorkflowFormProps) {
  const [step, setStep] = useState<IntakeWorkflowStep>(initialStep);
  const [productImage, setProductImage] = useState<ImagePreviewSelectionState>({ selected: false, fileName: null, previewUrl: null });
  const [shopeeScreenshot, setShopeeScreenshot] = useState<ImagePreviewSelectionState>({ selected: false, fileName: null, previewUrl: null });
  const [tiktokScreenshot, setTiktokScreenshot] = useState<ImagePreviewSelectionState>({ selected: false, fileName: null, previewUrl: null });
  const [affiliateProfileId, setAffiliateProfileId] = useState(selectedAffiliateProfileId ?? affiliateProfiles[0]?.id ?? "");
  const [submittedIntent, setSubmittedIntent] = useState<IntakeSubmitIntent>(null);
  const [activePendingIntent, setActivePendingIntent] = useState<IntakeSubmitIntent>(null);

  useEffect(() => {
    setStep(initialStep);
  }, [initialStep, savedSession?.id]);

  useEffect(() => {
    setAffiliateProfileId(selectedAffiliateProfileId ?? affiliateProfiles[0]?.id ?? "");
  }, [affiliateProfiles, selectedAffiliateProfileId]);

  const activeAffiliateProfile = affiliateProfiles.find((profile) => profile.id === affiliateProfileId) ?? affiliateProfiles[0] ?? null;
  const hasSavedProductPreview = Boolean(savedSessionEvidencePreviewUrls?.productImage);
  const hasSavedShopeePreview = Boolean(savedSessionEvidencePreviewUrls?.shopeeScreenshot);
  const hasSavedTiktokPreview = Boolean(savedSessionEvidencePreviewUrls?.tiktokScreenshot);
  const canSaveProduct = Boolean(productImage.selected);
  const canAnalyzeMetadata =
    Boolean(savedSession?.id) &&
    Boolean(productImage.selected || hasSavedProductPreview) &&
    Boolean(shopeeScreenshot.selected || hasSavedShopeePreview) &&
    Boolean(tiktokScreenshot.selected || hasSavedTiktokPreview);
  const sessionHasMetadata = savedSession ? hasSessionMetadata(savedSession) : false;
  const isMetadataPending = Boolean(savedSession && (savedSession.status === "DRAFT" || savedSession.status === "SUBMITTED") && !sessionHasMetadata);
  const isMetadataFailed = Boolean(savedSession && savedSession.status === "ERROR" && !sessionHasMetadata);
  const isSavingProduct = activePendingIntent === "save_product_capture";
  const isAnalyzingMetadata = activePendingIntent === "analyze_metadata";

  const metadataPanel = isAnalyzingMetadata ? (
    <IntakeMetadataPendingPanel status="SUBMITTED" />
  ) : !savedSession ? (
    <IntakeMetadataEmptyPanel />
  ) : isMetadataPending ? (
    <IntakeMetadataPendingPanel status={savedSession.status} />
  ) : isMetadataFailed ? (
    <IntakeMetadataFailedPanel affiliateProfileId={affiliateProfileId} savedSession={savedSession} showAllWorkspaces={showAllWorkspaces} />
  ) : (
    <AnalysisReadyPanel
      affiliateProfileId={affiliateProfileId}
      currentWorkspaceName={currentWorkspaceName}
      savedSession={savedSession}
      promptLaunchReadiness={promptLaunchReadiness}
      showAllWorkspaces={showAllWorkspaces}
      savedSessionWorkspaceName={savedSessionWorkspaceName}
    />
  );

  return (
    <section className={`intake-workflow stack${step === "prompt" ? " intake-workflow--prompt" : ""}`}>
      <form
        action={saveIntake}
        className="stack"
        onSubmit={(event) => {
          setSubmittedIntent(readSubmitIntent(event));
        }}
      >
        <input type="hidden" name="workspace_scope" value={showAllWorkspaces ? "all" : ""} />
        <input type="hidden" name="affiliate_profile_id" value={affiliateProfileId} />
        {savedSession?.id ? <input type="hidden" name="id" value={savedSession.id} /> : null}
        <ActiveAffiliateProfileCard profile={activeAffiliateProfile} />
        <div className="intake-evidence-grid">
          <ImagePreviewUploadCard
            className="intake-evidence-grid__card"
            label="Foto Produk Utama"
            name="product_image"
            emptyTitle="Tambah gambar"
            previewUrl={savedSessionEvidencePreviewUrls?.productImage ?? null}
            previewAlt="Foto Produk Utama preview"
            required
            showStatusBadge={false}
            onSelectionChange={setProductImage}
          />
          <ImagePreviewUploadCard
            className="intake-evidence-grid__card"
            label="Screenshot Shopee"
            name="shopee_screenshot"
            emptyTitle="Tambah gambar"
            previewUrl={savedSessionEvidencePreviewUrls?.shopeeScreenshot ?? null}
            previewAlt="Screenshot Shopee preview"
            showStatusBadge={false}
            onSelectionChange={setShopeeScreenshot}
          />
          <ImagePreviewUploadCard
            className="intake-evidence-grid__card"
            label="Screenshot TikTok"
            name="tiktok_screenshot"
            emptyTitle="Tambah gambar"
            previewUrl={savedSessionEvidencePreviewUrls?.tiktokScreenshot ?? null}
            previewAlt="Screenshot TikTok preview"
            showStatusBadge={false}
            onSelectionChange={setTiktokScreenshot}
          />
        </div>
        <FormActions layout="pair">
          <div className="intake-action-slot">
            <PendingActionButton
              name="intent"
              value="save_product_capture"
              className="button primary"
              pendingLabel="Menyimpan"
              disabled={!canSaveProduct}
            >
              Simpan Produk
            </PendingActionButton>
            {isSavingProduct ? (
              <span className="intake-inline-status" role="status" aria-live="polite">
                <Loader2 size={14} aria-hidden="true" className="spin" />
                Menyimpan produk...
              </span>
            ) : null}
          </div>
          <PendingActionButton
            name="intent"
            value="analyze_metadata"
            className="button tertiary"
            pendingLabel="Memproses"
            disabled={!canAnalyzeMetadata}
          >
            Analisis Metadata
          </PendingActionButton>
        </FormActions>
        <IntakePendingIntentBridge submittedIntent={submittedIntent} onPendingIntentChange={setActivePendingIntent} />
      </form>

      {metadataPanel}
      {!savedSession ? <DraftQueuePanel drafts={draftQueue} /> : null}
    </section>
  );
}
