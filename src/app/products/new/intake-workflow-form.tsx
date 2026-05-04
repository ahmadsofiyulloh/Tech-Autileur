"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Link2,
  Loader2,
  Plus,
  Upload,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import { saveIntake } from "@/app/intake/actions";
import { EmptyState } from "@/components/operator/empty-state";
import { FormActions } from "@/components/operator/form-actions";
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
    platform: string;
    status: string;
  }>;
  currentWorkspaceName: string | null;
  errorMessage: string | null;
  initialStep: IntakeWorkflowStep;
  message: string | null;
  savedSession: IntakeWorkflowSession | null;
  savedSessionWorkspaceName: string | null;
  selectedAffiliateProfileId: string | null;
  showAllWorkspaces: boolean;
};

type AssetSelectionState = {
  selected: boolean;
  fileName: string | null;
  previewUrl: string | null;
};

type AssetUploadCardProps = {
  description: string;
  label: string;
  name: string;
  onSelectionChange: (state: AssetSelectionState) => void;
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

function SubmitButton({
  children,
  icon: Icon,
  pendingLabel,
  disabled = false,
}: {
  children: string;
  disabled?: boolean;
  icon: LucideIcon;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button className="button primary" disabled={disabled || pending} type="submit">
      {pending ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Icon size={16} aria-hidden="true" />}
      {pending ? pendingLabel : children}
    </button>
  );
}

function AssetUploadCard({ description, label, name, onSelectionChange }: AssetUploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      setError(null);
      setFileName(null);
      setIsPreparing(false);
      setPreviewUrl(null);
      onSelectionChange({ selected: false, fileName: null, previewUrl: null });
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Pilih file gambar.");
      setFileName(null);
      setIsPreparing(false);
      setPreviewUrl(null);
      onSelectionChange({ selected: false, fileName: null, previewUrl: null });
      event.target.value = "";
      return;
    }

    setError(null);
    setFileName(file.name);
    setIsPreparing(true);
    setPreviewUrl(null);
    onSelectionChange({ selected: true, fileName: file.name, previewUrl: null });

    const reader = new FileReader();

    reader.addEventListener("load", () => {
      const nextPreviewUrl = typeof reader.result === "string" ? reader.result : null;
      setPreviewUrl(nextPreviewUrl);
      setIsPreparing(false);
      onSelectionChange({ selected: true, fileName: file.name, previewUrl: nextPreviewUrl });
    });
    reader.addEventListener("error", () => {
      setError("Tidak bisa menyiapkan pratinjau lokal.");
      setFileName(null);
      setIsPreparing(false);
      setPreviewUrl(null);
      onSelectionChange({ selected: false, fileName: null, previewUrl: null });
      event.target.value = "";
    });
    reader.readAsDataURL(file);
  }

  return (
    <section className="asset-upload-card intake-upload-card stack-tight" data-has-preview={previewUrl ? "true" : "false"}>
      <div className="intake-upload-card__header">
        <div className="stack-tight">
          <strong>{label}</strong>
          <span className="subtle">{description}</span>
        </div>
        {isPreparing ? (
          <StatusBadge status="Menyiapkan" tone="warning" />
        ) : previewUrl ? (
          <StatusBadge status="Preview" />
        ) : (
          <StatusBadge status="Kosong" tone="neutral" />
        )}
      </div>
      <div className="asset-upload-card__preview">
        {isPreparing ? (
          <div className="asset-upload-card__empty" role="status">
            <Loader2 className="spin" size={34} aria-hidden="true" />
            <span>Menyiapkan pratinjau</span>
          </div>
        ) : previewUrl ? (
          <img alt={`${label} local preview`} src={previewUrl} />
        ) : (
          <div className="asset-upload-card__empty">
            <Plus size={28} aria-hidden="true" />
            <span>Tambah gambar</span>
          </div>
        )}
        <button
          className="asset-upload-card__overlay button compact intake-upload-card__button"
          disabled={isPreparing}
          type="button"
          onClick={() => inputRef.current?.click()}
        >
          <Upload size={15} aria-hidden="true" />
          {isPreparing ? "Menyiapkan" : previewUrl ? "Ganti" : "Pilih"}
        </button>
      </div>
      <input
        ref={inputRef}
        accept="image/*"
        className="asset-upload-card__input"
        name={name}
        required
        type="file"
        onChange={handleFileChange}
      />
      {fileName ? <p className="subtle">{fileName}</p> : null}
      {error ? (
        <p className="error-box asset-upload-card__error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function affiliateInitials(profileName: string) {
  const parts = profileName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return parts.map((part) => part[0]?.toUpperCase()).join("") || "A";
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
                {affiliateInitials(profile.profile_name)}
              </span>
              <span className="stack-tight">
                <strong>{profile.profile_name}</strong>
                <span className="subtle">{profile.account_label || profile.platform}</span>
              </span>
              <span className={`button compact ${selected ? "primary" : ""}`}>Pilih</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SubmitSkeleton() {
  const { pending } = useFormStatus();

  if (!pending) {
    return null;
  }

  return (
    <section className="muted-box stack analysis-skeleton-card" role="status">
      <div className="section-card__actions">
        <Loader2 className="spin" size={16} aria-hidden="true" />
        <strong>Gemini analyzing...</strong>
      </div>
      <div className="visual-list-card">
        <div className="visual-list-card__thumb">
          <div className="skeleton long" />
        </div>
        <div className="stack-tight">
          <div className="skeleton long" />
          <div className="skeleton medium" />
          <div className="visual-chip-row">
            <div className="skeleton short" />
            <div className="skeleton short" />
          </div>
        </div>
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

        <div className="metric-grid">
          <div className="metric">
            <span>Nama Produk</span>
            <strong>{defaultNamaProduk || "Sudah dianalisis"}</strong>
          </div>
          <div className="metric">
            <span>Keyword Cari Etalase</span>
            <strong>{defaultKeyword || "Tersedia"}</strong>
          </div>
          <div className="metric">
            <span>Workspace</span>
            <strong>{workspaceName}</strong>
          </div>
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

        <FormActions>
          <SubmitButton icon={CheckCircle2} pendingLabel="Menyimpan" disabled={!savedSession.id}>
            Simpan Review
          </SubmitButton>
          {promptProductId ? (
            <Link className="button primary" href={promptHref(promptProductId, savedSession.id, affiliateProfileId)}>
              <FileText size={16} aria-hidden="true" />
              Buat Prompt
            </Link>
          ) : null}
          {savedSession.product_id ? (
            <Link className="button" href={`/products/${savedSession.product_id}`}>
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
  errorMessage,
  initialStep,
  message,
  savedSession,
  savedSessionWorkspaceName,
  selectedAffiliateProfileId,
  showAllWorkspaces,
}: IntakeWorkflowFormProps) {
  const [step, setStep] = useState<IntakeWorkflowStep>(initialStep);
  const [activeSegment, setActiveSegment] = useState<IntakeEvidenceSegment>("produk");
  const [productImage, setProductImage] = useState<AssetSelectionState>({ selected: false, fileName: null, previewUrl: null });
  const [shopeeScreenshot, setShopeeScreenshot] = useState<AssetSelectionState>({ selected: false, fileName: null, previewUrl: null });
  const [tiktokScreenshot, setTiktokScreenshot] = useState<AssetSelectionState>({ selected: false, fileName: null, previewUrl: null });
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
      {message ? (
        <div className="muted-box status-box" role="status">
          <CheckCircle2 size={17} aria-hidden="true" />
          <span>{message}</span>
        </div>
      ) : null}
      {errorMessage ? (
        <div className="error-box status-box" role="alert">
          <AlertTriangle size={17} aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      ) : null}

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
              <AssetUploadCard
                label="Foto Produk Utama"
                description="Foto utama sebagai konteks produk."
                name="product_image"
                onSelectionChange={setProductImage}
              />
              <AffiliateProfileCarousel profiles={affiliateProfiles} selectedId={affiliateProfileId} onSelect={setAffiliateProfileId} />
            </section>

            <section
              aria-hidden={activeSegment !== "metadata"}
              className="intake-segment-panel"
              data-active={activeSegment === "metadata" ? "true" : undefined}
            >
              <div className="intake-metadata-note stack-tight">
                <h3>Metadata Marketplace</h3>
                <p>Screenshot marketplace dipakai untuk memperkaya analisis Gemini.</p>
              </div>
              <AssetUploadCard
                label="Screenshot Shopee"
                description="Bukti marketplace Shopee."
                name="shopee_screenshot"
                onSelectionChange={setShopeeScreenshot}
              />
              <AssetUploadCard
                label="Screenshot TikTok"
                description="Bukti marketplace TikTok."
                name="tiktok_screenshot"
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
          <FormActions>
            <SubmitButton icon={WandSparkles} pendingLabel="Memproses" disabled={!hasMinimum}>
              Analisis Gemini
            </SubmitButton>
          </FormActions>
          <SubmitSkeleton />
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
