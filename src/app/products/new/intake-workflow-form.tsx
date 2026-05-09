"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  AlertTriangle,
  FileText,
  Link2,
} from "lucide-react";
import { saveIntake } from "@/app/intake/actions";
import { EmptyState } from "@/components/operator/empty-state";
import { FormActions } from "@/components/operator/form-actions";
import { IntakeStepper, type IntakeStepperStep } from "@/components/operator/intake-stepper";
import { ImagePreviewUploadCard, type ImagePreviewSelectionState } from "@/components/operator/image-preview-upload-card";
import { SkeletonIntakeMetadataPreview } from "@/components/operator/loading-skeleton";
import { PostSaveDecisionSurface } from "@/components/operator/post-save-decision-surface";
import { PromptLaunchReadinessSummary } from "@/components/operator/prompt-launch-readiness-summary";
import { PendingActionButton } from "@/components/operator/pending-action-button";
import { StatusBadge } from "@/components/operator/status-badge";
import { normalizeIntakeClientContext } from "@/lib/intake/analysis-telemetry";
import type { JsonRecord } from "@/lib/intake/validation";
import type { PromptLaunchReadiness } from "@/lib/prompts/prompt-launch-readiness";

type IntakeWorkflowStep = "intake" | "prompt";
type IntakeSubmitIntent = "save_product_capture" | "analyze_metadata" | null;
type ReviewSubmitIntent = "review_metadata" | null;
const REVIEW_FORM_ID = "intake-review-form";

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
  postSaveDecisionOpen: boolean;
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

function inferBrowserFamily(userAgent: string, brands?: Array<{ brand?: string | null }> | null) {
  const normalizedBrands = (brands ?? []).map((brand) => brand.brand?.trim().toLowerCase() || "").filter(Boolean).join(" ");
  const normalized = `${normalizedBrands} ${userAgent}`.trim().toLowerCase();

  if (normalized.includes("edg")) {
    return "edge";
  }

  if (normalized.includes("firefox") || normalized.includes("fxios")) {
    return "firefox";
  }

  if (normalized.includes("crios") || normalized.includes("chrome") || normalized.includes("chromium")) {
    return "chrome";
  }

  if (normalized.includes("safari") && !normalized.includes("chrome") && !normalized.includes("crios") && !normalized.includes("edg")) {
    return "safari";
  }

  if (normalized.includes("wv") || normalized.includes("webview")) {
    return "android_webview";
  }

  if (normalized.includes("opera") || normalized.includes("opr")) {
    return "other";
  }

  return "other";
}

function collectIntakeClientContext() {
  const navigatorWithExtras = navigator as Navigator & {
    connection?: { effectiveType?: string | null; saveData?: boolean | null };
    standalone?: boolean;
    userAgentData?: {
      mobile?: boolean | null;
      brands?: Array<{ brand?: string | null }> | null;
    };
  };
  const displayMode = window.matchMedia("(display-mode: standalone)").matches || navigatorWithExtras.standalone === true ? "standalone" : "browser";
  const isMobile = navigatorWithExtras.userAgentData?.mobile ?? /mobi|android|iphone|ipad|ipod/i.test(window.navigator.userAgent);
  const browserFamily = inferBrowserFamily(window.navigator.userAgent, navigatorWithExtras.userAgentData?.brands ?? null);
  const connection = navigatorWithExtras.connection;

  return normalizeIntakeClientContext({
    is_mobile: isMobile,
    display_mode: displayMode,
    browser_family: browserFamily,
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
    network_effective_type: connection?.effectiveType ?? null,
    save_data: typeof connection?.saveData === "boolean" ? connection.saveData : null,
  });
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

function ReviewPendingIntentBridge({
  onPendingIntentChange,
  submittedIntent,
}: {
  onPendingIntentChange: (intent: ReviewSubmitIntent) => void;
  submittedIntent: ReviewSubmitIntent;
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
    <section className="stack">
      <EmptyState
        action={
          <Link className="button primary" href={`/products/new?${retryParams.toString()}`}>
            <Link2 size={16} aria-hidden="true" />
            Kembali ke intake
          </Link>
        }
        icon={AlertTriangle}
        title="Analisis metadata gagal."
        description="Draft tersimpan. Coba ulang."
      />
      {savedSession.error_message ? (
        <section className="error-box" aria-live="polite">
          {savedSession.error_message}
        </section>
      ) : null}
    </section>
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
  form,
  name,
  placeholder,
}: {
  defaultValue: string;
  label: string;
  form?: string;
  name: string;
  placeholder?: string;
}) {
  return (
    <label className="stack-tight" htmlFor={name}>
      <span className="subtle">{label}</span>
      <input id={name} form={form} name={name} placeholder={placeholder} defaultValue={defaultValue} />
    </label>
  );
}

function ReviewTextarea({
  defaultValue,
  label,
  form,
  name,
  placeholder,
  rows = 3,
}: {
  defaultValue: string;
  label: string;
  form?: string;
  name: string;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="stack-tight" htmlFor={name}>
      <span className="subtle">{label}</span>
      <textarea id={name} form={form} name={name} placeholder={placeholder} rows={rows} defaultValue={defaultValue} />
    </label>
  );
}

function AnalysisReadyPanel({
  affiliateProfileId,
  currentWorkspaceName,
  isSavingReview,
  reviewFormId,
  savedSession,
  promptLaunchReadiness,
  savedSessionWorkspaceName,
}: {
  affiliateProfileId: string | null;
  currentWorkspaceName: string | null;
  isSavingReview: boolean;
  reviewFormId: string;
  savedSession: IntakeWorkflowSession;
  promptLaunchReadiness: PromptLaunchReadiness | null;
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
    <section className="prompt-preview-panel stack">
      <div className="section-card__actions">
        <div className="stack-tight">
          <h3>Review Hasil</h3>
          <span className="settings-card-meta-line">{workspaceName}</span>
        </div>
        <StatusBadge status={savedSession.status} tone={savedSession.status === "REVIEWED" ? "success" : "info"} />
      </div>

      <div className="grid two-up">
        <ReviewInput
          form={reviewFormId}
          label="Nama Produk"
          name="review_nama_produk"
          defaultValue={defaultNamaProduk}
          placeholder="Nama produk"
        />
        <ReviewInput
          form={reviewFormId}
          label="Keyword Cari Etalase"
          name="review_keyword_cari_etalase"
          defaultValue={defaultKeyword}
          placeholder="Keyword etalase"
        />
        <ReviewTextarea
          form={reviewFormId}
          label="Deskripsi Visual"
          name="review_deskripsi_visual"
          defaultValue={defaultDeskripsi}
          placeholder="Deskripsi visual"
        />
        <ReviewInput form={reviewFormId} label="Use Case" name="review_use_case" defaultValue={defaultUseCase} placeholder="Use case" />
        <ReviewInput form={reviewFormId} label="Pain Point" name="review_pain_point" defaultValue={defaultPainPoint} placeholder="Pain point" />
        <ReviewInput
          form={reviewFormId}
          label="Selling Angle"
          name="review_selling_angle"
          defaultValue={defaultSellingAngle}
          placeholder="Selling angle"
        />
        <ReviewInput
          form={reviewFormId}
          label="Target Viewer"
          name="review_target_viewer"
          defaultValue={defaultTargetViewer}
          placeholder="Target viewer"
        />
      </div>

      <FormActions layout="triple">
        <PendingActionButton
          className="button primary"
          form={reviewFormId}
          name="intent"
          value="review_metadata"
          pendingLabel="Menyimpan"
          pendingOverride={isSavingReview}
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
  postSaveDecisionOpen,
  showAllWorkspaces,
  draftQueue,
}: IntakeWorkflowFormProps) {
  const [productImage, setProductImage] = useState<ImagePreviewSelectionState>({ selected: false, fileName: null, previewUrl: null });
  const [shopeeScreenshot, setShopeeScreenshot] = useState<ImagePreviewSelectionState>({ selected: false, fileName: null, previewUrl: null });
  const [tiktokScreenshot, setTiktokScreenshot] = useState<ImagePreviewSelectionState>({ selected: false, fileName: null, previewUrl: null });
  const [affiliateProfileId, setAffiliateProfileId] = useState(selectedAffiliateProfileId ?? affiliateProfiles[0]?.id ?? "");
  const [submittedIntent, setSubmittedIntent] = useState<IntakeSubmitIntent>(null);
  const [activePendingIntent, setActivePendingIntent] = useState<IntakeSubmitIntent>(null);
  const [submittedReviewIntent, setSubmittedReviewIntent] = useState<ReviewSubmitIntent>(null);
  const [activeReviewPendingIntent, setActiveReviewPendingIntent] = useState<ReviewSubmitIntent>(null);
  const [analysisClientContextJson, setAnalysisClientContextJson] = useState(() => JSON.stringify(normalizeIntakeClientContext(null)));

  useEffect(() => {
    setAffiliateProfileId(selectedAffiliateProfileId ?? affiliateProfiles[0]?.id ?? "");
  }, [affiliateProfiles, selectedAffiliateProfileId]);

  useEffect(() => {
    setAnalysisClientContextJson(JSON.stringify(collectIntakeClientContext()));
  }, []);

  const activeAffiliateProfile = affiliateProfiles.find((profile) => profile.id === affiliateProfileId) ?? affiliateProfiles[0] ?? null;
  const hasSavedProductPreview = Boolean(savedSessionEvidencePreviewUrls?.productImage);
  const hasSavedShopeePreview = Boolean(savedSessionEvidencePreviewUrls?.shopeeScreenshot);
  const hasSavedTiktokPreview = Boolean(savedSessionEvidencePreviewUrls?.tiktokScreenshot);
  const hasSavedSession = Boolean(savedSession?.id);
  const canSaveProduct = Boolean(productImage.selected);
  const canAnalyzeMetadata =
    hasSavedSession &&
    Boolean(productImage.selected || hasSavedProductPreview) &&
    Boolean(shopeeScreenshot.selected || hasSavedShopeePreview) &&
    Boolean(tiktokScreenshot.selected || hasSavedTiktokPreview);
  const sessionHasMetadata = savedSession ? hasSessionMetadata(savedSession) : false;
  const isMetadataPending = Boolean(savedSession && savedSession.status === "SUBMITTED" && !sessionHasMetadata);
  const isMetadataFailed = Boolean(savedSession && savedSession.status === "ERROR" && !sessionHasMetadata);
  const isSavingProduct = activePendingIntent === "save_product_capture";
  const isAnalyzingMetadata = activePendingIntent === "analyze_metadata";
  const isReviewingMetadata = activeReviewPendingIntent === "review_metadata";
  const isDecisionSurfaceOpen = postSaveDecisionOpen && hasSavedSession;
  const defaultExpandedStepId =
    initialStep === "prompt" && savedSession && sessionHasMetadata
      ? "review"
      : isAnalyzingMetadata || isMetadataPending || isMetadataFailed
        ? "analysis"
        : sessionHasMetadata || isReviewingMetadata
          ? "review"
          : canAnalyzeMetadata
            ? "analysis"
            : hasSavedSession
              ? "evidence"
              : "capture";

  function captureBadge() {
    if (isSavingProduct) {
      return { badgeLabel: "Menyimpan", badgeTone: "info" as const };
    }

    if (hasSavedSession) {
      return { badgeLabel: "Tersimpan", badgeTone: "success" as const };
    }

    return { badgeLabel: "Draft", badgeTone: "info" as const };
  }

  function evidenceBadge() {
    if (canAnalyzeMetadata) {
      return { badgeLabel: "Lengkap", badgeTone: "success" as const };
    }

    if (hasSavedSession || productImage.selected || shopeeScreenshot.selected || tiktokScreenshot.selected) {
      return { badgeLabel: "Belum lengkap", badgeTone: "warning" as const };
    }

    return { badgeLabel: "Menunggu", badgeTone: "neutral" as const };
  }

  function analysisBadge() {
    if (isMetadataPending || isAnalyzingMetadata) {
      return { badgeLabel: "Memproses", badgeTone: "info" as const };
    }

    if (isMetadataFailed) {
      return { badgeLabel: "Gagal", badgeTone: "danger" as const };
    }

    if (sessionHasMetadata) {
      return { badgeLabel: "Selesai", badgeTone: "success" as const };
    }

    if (canAnalyzeMetadata) {
      return { badgeLabel: "Siap", badgeTone: "info" as const };
    }

    return { badgeLabel: "Terkunci", badgeTone: "warning" as const };
  }

  function reviewBadge() {
    if (savedSession?.status === "REVIEWED") {
      return { badgeLabel: "Selesai", badgeTone: "success" as const };
    }

    if (sessionHasMetadata) {
      return { badgeLabel: "Perlu review", badgeTone: "info" as const };
    }

    return { badgeLabel: "Menunggu", badgeTone: "neutral" as const };
  }

  const analysisStepBadge = analysisBadge();

  const captureStep = {
    id: "capture",
    label: "Capture Produk",
    summary: hasSavedSession ? "Draft produk tersimpan" : "Foto utama dan simpan draft",
    status: isSavingProduct ? "loading" : hasSavedSession ? "completed" : canSaveProduct ? "active" : "pending",
    ...captureBadge(),
    panel: (
      <section className="stack-tight">
        <ImagePreviewUploadCard
          className="intake-stepper__single-upload"
          label="Foto Produk Utama"
          name="product_image"
          emptyTitle="Tambah gambar"
          disabled={isDecisionSurfaceOpen}
          previewUrl={savedSessionEvidencePreviewUrls?.productImage ?? null}
          previewAlt="Foto Produk Utama preview"
          required
          showStatusBadge={false}
          onSelectionChange={setProductImage}
        />
        <FormActions layout="single">
          <div className="intake-action-slot">
            <PendingActionButton
              name="intent"
              value="save_product_capture"
              className="button primary"
              pendingLabel="Menyimpan"
              disabled={!canSaveProduct || isDecisionSurfaceOpen}
            >
              Simpan Produk
            </PendingActionButton>
          </div>
        </FormActions>
      </section>
    ),
  } satisfies IntakeStepperStep;

  const evidenceStep = {
    id: "evidence",
    label: "Evidence Lengkap",
    summary: canAnalyzeMetadata ? "Shopee dan TikTok lengkap" : "Lengkapi screenshot Shopee dan TikTok",
    status: canAnalyzeMetadata ? "completed" : hasSavedSession || productImage.selected || shopeeScreenshot.selected || tiktokScreenshot.selected ? "active" : "pending",
    ...evidenceBadge(),
    panel: (
      <section className="stack-tight">
        <div className="intake-evidence-grid intake-evidence-grid--supporting">
          <ImagePreviewUploadCard
            className="intake-evidence-grid__card"
            label="Screenshot Shopee"
            name="shopee_screenshot"
            emptyTitle="Tambah gambar"
            disabled={isDecisionSurfaceOpen}
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
            disabled={isDecisionSurfaceOpen}
            previewUrl={savedSessionEvidencePreviewUrls?.tiktokScreenshot ?? null}
            previewAlt="Screenshot TikTok preview"
            showStatusBadge={false}
            onSelectionChange={setTiktokScreenshot}
          />
        </div>
        <span className="settings-card-meta-line">Analisis aktif setelah dua screenshot lengkap.</span>
      </section>
    ),
  } satisfies IntakeStepperStep;

  const analysisStep = {
    id: "analysis",
    label: "Analisis Metadata",
    summary: isMetadataPending ? "Sedang dianalisis" : sessionHasMetadata ? "Analisis selesai" : canAnalyzeMetadata ? "Siap dianalisis" : "Menunggu evidence lengkap",
    status: isMetadataPending || isAnalyzingMetadata ? "loading" : isMetadataFailed ? "error" : sessionHasMetadata ? "completed" : canAnalyzeMetadata ? "active" : "locked",
    ...analysisStepBadge,
    panel: !savedSession ? (
      <section className="muted-box stack-tight">
        <strong>Simpan Produk dulu.</strong>
        <span>Analisis baru aktif setelah draft tersimpan.</span>
      </section>
    ) : isAnalyzingMetadata ? (
      <IntakeMetadataPendingPanel status="SUBMITTED" />
    ) : isMetadataPending ? (
      <IntakeMetadataPendingPanel status={savedSession.status} />
    ) : isMetadataFailed ? (
      <IntakeMetadataFailedPanel affiliateProfileId={affiliateProfileId} savedSession={savedSession} showAllWorkspaces={showAllWorkspaces} />
    ) : sessionHasMetadata ? (
      <section className="success-box stack-tight">
        <strong>Analisis selesai.</strong>
        <span>Lanjut ke review hasil pada langkah berikutnya.</span>
      </section>
    ) : (
      <section className="stack-tight">
        <div className="section-card__actions">
          <div className="stack-tight">
            <strong>Analisis Metadata</strong>
            <span className="settings-card-meta-line">Aktif setelah Capture Produk dan Evidence Lengkap selesai.</span>
          </div>
          <StatusBadge status={canAnalyzeMetadata ? "Siap" : "Terkunci"} tone={canAnalyzeMetadata ? "success" : "warning"} />
        </div>

        <FormActions layout="single">
          <div className="intake-action-slot">
            <PendingActionButton
              name="intent"
              value="analyze_metadata"
              className="button tertiary"
              pendingLabel="Memproses"
              disabled={!canAnalyzeMetadata || isDecisionSurfaceOpen}
            >
              Analisis Metadata
            </PendingActionButton>
            {!canAnalyzeMetadata ? <span className="intake-inline-status">Lengkapi evidence dulu.</span> : null}
          </div>
        </FormActions>
      </section>
    ),
  } satisfies IntakeStepperStep;

  const reviewStep = {
    id: "review",
    label: "Review Hasil",
    summary: sessionHasMetadata ? "Review metadata dan prompt" : "Menunggu hasil analisis",
    status: savedSession?.status === "REVIEWED" ? "completed" : sessionHasMetadata ? "active" : "locked",
    ...reviewBadge(),
    panel: savedSession && sessionHasMetadata ? (
      <AnalysisReadyPanel
        affiliateProfileId={affiliateProfileId}
        currentWorkspaceName={currentWorkspaceName}
        isSavingReview={activeReviewPendingIntent === "review_metadata"}
        reviewFormId={REVIEW_FORM_ID}
        savedSession={savedSession}
        promptLaunchReadiness={promptLaunchReadiness}
        savedSessionWorkspaceName={savedSessionWorkspaceName}
      />
    ) : (
      <section className="muted-box stack-tight">
        <strong>Review Hasil</strong>
        <span>Langkah ini terbuka setelah analisis metadata selesai.</span>
      </section>
    ),
  } satisfies IntakeStepperStep;

  const steps = [captureStep, evidenceStep, analysisStep, reviewStep];

  return (
    <section className="intake-workflow stack">
      <form
        action={saveIntake}
        className="stack"
        onSubmit={(event) => {
          setSubmittedIntent(readSubmitIntent(event));
        }}
      >
        <input type="hidden" name="workspace_scope" value={showAllWorkspaces ? "all" : ""} />
        <input type="hidden" name="affiliate_profile_id" value={affiliateProfileId} />
        <input type="hidden" name="analysis_client_context" value={analysisClientContextJson} />
        {savedSession?.id ? <input type="hidden" name="id" value={savedSession.id} /> : null}
        <ActiveAffiliateProfileCard profile={activeAffiliateProfile} />
        <IntakeStepper
          ariaLabel="Tahapan intake produk"
          defaultExpandedStepId={defaultExpandedStepId}
          steps={steps}
        />
        <IntakePendingIntentBridge submittedIntent={submittedIntent} onPendingIntentChange={setActivePendingIntent} />
      </form>

      {savedSession && sessionHasMetadata ? (
        <form
          action={saveIntake}
          className="sr-only"
          id={REVIEW_FORM_ID}
          onSubmit={() => {
            setSubmittedReviewIntent("review_metadata");
          }}
        >
          <input type="hidden" name="intent" value="review_metadata" />
          <input type="hidden" name="id" value={savedSession.id} />
          <input type="hidden" name="workspace_scope" value={showAllWorkspaces ? "all" : ""} />
          <input type="hidden" name="affiliate_profile_id" value={affiliateProfileId} />
          <ReviewPendingIntentBridge submittedIntent={submittedReviewIntent} onPendingIntentChange={setActiveReviewPendingIntent} />
        </form>
      ) : null}

      <PostSaveDecisionSurface
        affiliateProfileId={affiliateProfileId}
        intakeId={savedSession?.id ?? ""}
        open={isDecisionSurfaceOpen}
        showAllWorkspaces={showAllWorkspaces}
      />

      {!savedSession && <DraftQueuePanel drafts={draftQueue} />}
    </section>
  );
}
