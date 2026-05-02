"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, CheckCircle2, FileImage, Loader2, Save, Upload, WandSparkles } from "lucide-react";
import { saveIntake } from "@/app/intake/actions";
import { EmptyState } from "@/components/operator/empty-state";
import { FormActions } from "@/components/operator/form-actions";
import { StatusBadge } from "@/components/operator/status-badge";

type IntakeWorkflowStep = "intake" | "prompt";

export type IntakeWorkflowSession = {
  id: string;
  intake_code: string;
  product_title: string | null;
  shopee_url: string | null;
  tiktok_url: string | null;
  raw_notes: string | null;
  status: string;
  workspace_id: string | null;
  created_at: string;
};

type IntakeWorkflowFormProps = {
  currentWorkspaceName: string | null;
  errorMessage: string | null;
  initialStep: IntakeWorkflowStep;
  message: string | null;
  savedSession: IntakeWorkflowSession | null;
  savedSessionWorkspaceName: string | null;
};

type AssetUploadCardProps = {
  description: string;
  label: string;
};

function readText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function hasMinimumInput(input: { productTitle: string; shopeeUrl: string; tiktokUrl: string; notes: string }) {
  return Boolean(readText(input.productTitle) || readText(input.shopeeUrl) || readText(input.tiktokUrl) || readText(input.notes));
}

function marketplaceSummary(shopeeUrl: string, tiktokUrl: string) {
  const marketplaces = [readText(shopeeUrl) ? "Shopee" : null, readText(tiktokUrl) ? "TikTok" : null].filter(Boolean);
  return marketplaces.length ? marketplaces.join(" + ") : "Manual text";
}

function shorten(value: string, maxLength = 220) {
  const trimmed = readText(value);

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 1)}...`;
}

function SubmitButton({ disabledByValidation }: { disabledByValidation: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button className="button primary" disabled={pending || disabledByValidation} type="submit">
      {pending ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
      {pending ? "Saving..." : "Save intake"}
    </button>
  );
}

function AssetUploadCard({ description, label }: AssetUploadCardProps) {
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
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      setFileName(null);
      setIsPreparing(false);
      setPreviewUrl(null);
      event.target.value = "";
      return;
    }

    setError(null);
    setFileName(file.name);
    setIsPreparing(true);
    setPreviewUrl(null);

    const reader = new FileReader();

    reader.addEventListener("load", () => {
      setPreviewUrl(typeof reader.result === "string" ? reader.result : null);
      setIsPreparing(false);
    });
    reader.addEventListener("error", () => {
      setError("Unable to prepare local preview.");
      setFileName(null);
      setIsPreparing(false);
      setPreviewUrl(null);
      event.target.value = "";
    });
    reader.readAsDataURL(file);
  }

  return (
    <section className="asset-upload-card stack-tight" data-has-preview={previewUrl ? "true" : "false"}>
      <div className="section-card__actions">
        <div className="stack-tight">
          <strong>{label}</strong>
          <span className="subtle">{description}</span>
        </div>
        {isPreparing ? (
          <StatusBadge status="PREPARING" tone="warning" />
        ) : previewUrl ? (
          <StatusBadge status="LOCAL_PREVIEW" />
        ) : (
          <StatusBadge status="EMPTY" tone="neutral" />
        )}
      </div>
      <div className="asset-upload-card__preview">
        {isPreparing ? (
          <div className="asset-upload-card__empty" role="status">
            <Loader2 className="spin" size={34} aria-hidden="true" />
            <span>Preparing local preview</span>
          </div>
        ) : previewUrl ? (
          // Local browser previews are intentionally not persisted in this sprint.
          <img alt={`${label} local preview`} src={previewUrl} />
        ) : (
          <div className="asset-upload-card__empty">
            <FileImage size={34} aria-hidden="true" />
            <span>Preview placeholder</span>
          </div>
        )}
        <button
          className="asset-upload-card__overlay button compact"
          disabled={isPreparing}
          type="button"
          onClick={() => inputRef.current?.click()}
        >
          <Upload size={15} aria-hidden="true" />
          {isPreparing ? "Preparing" : previewUrl ? "Replace" : "Choose"}
        </button>
      </div>
      <input ref={inputRef} accept="image/*" className="asset-upload-card__input" type="file" onChange={handleFileChange} />
      {fileName ? <p className="subtle">{fileName}</p> : null}
      {error ? (
        <p className="error-box asset-upload-card__error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function PromptPreviewPanel({
  currentWorkspaceName,
  hasMinimum,
  notes,
  productTitle,
  savedSession,
  savedSessionWorkspaceName,
  shopeeUrl,
  tiktokUrl,
}: {
  currentWorkspaceName: string | null;
  hasMinimum: boolean;
  notes: string;
  productTitle: string;
  savedSession: IntakeWorkflowSession | null;
  savedSessionWorkspaceName: string | null;
  shopeeUrl: string;
  tiktokUrl: string;
}) {
  const title = readText(productTitle) || "Untitled product";
  const sourceMode = marketplaceSummary(shopeeUrl, tiktokUrl);
  const workspaceName = savedSessionWorkspaceName ?? currentWorkspaceName ?? "Unassigned";
  const promptPreview = [
    savedSession ? `Intake: ${savedSession.intake_code}` : null,
    `Product: ${title}`,
    `Workspace: ${workspaceName}`,
    `Sources: ${sourceMode}`,
    readText(shopeeUrl) ? `Shopee link: ${readText(shopeeUrl)}` : null,
    readText(tiktokUrl) ? `TikTok link: ${readText(tiktokUrl)}` : null,
    readText(notes) ? `Operator notes: ${shorten(notes)}` : "Operator notes: Not provided",
    "Visual source: Use uploaded/attached product image or screenshot bytes when backend upload plumbing exists. Current local previews are not persisted.",
    "Generation mode: Deterministic preview only. No Gemini call, prompt pack write, Drive upload, or Flow execution is performed here.",
  ]
    .filter(Boolean)
    .join("\n");
  const [editablePreview, setEditablePreview] = useState(promptPreview);

  useEffect(() => {
    setEditablePreview(promptPreview);
  }, [promptPreview]);

  if (!savedSession || !hasMinimum) {
    return (
      <EmptyState
        icon={WandSparkles}
        title="Prompt preview unlocks after save."
        description="Save a valid intake first. Local image previews are not uploaded yet, so they do not count as saved input."
      />
    );
  }

  return (
    <section className="prompt-preview-panel stack">
      <div className="section-card__actions">
        <div className="stack-tight">
          <p className="eyebrow">Prompt preview</p>
          <h3>Deterministic handoff preview</h3>
          <p>Confirms the saved intake context before Controller execution work.</p>
        </div>
        {savedSession ? <StatusBadge status={savedSession.status} /> : <StatusBadge status="UNSAVED_PREVIEW" tone="warning" />}
      </div>
      <div className="metric-grid">
        <div className="metric">
          <span>Product</span>
          <strong>{title}</strong>
        </div>
        <div className="metric">
          <span>Workspace</span>
          <strong>{workspaceName}</strong>
        </div>
        <div className="metric">
          <span>Input source</span>
          <strong>{sourceMode}</strong>
        </div>
      </div>
      <label className="stack auth-field" htmlFor="prompt-preview-editor">
        <span>Prompt editor preview</span>
        <textarea
          id="prompt-preview-editor"
          rows={10}
          value={editablePreview}
          onChange={(event) => setEditablePreview(event.target.value)}
        />
      </label>
      <div className="muted-box stack-tight">
        <strong>Next step</strong>
        <p>This is an editable local preview only. Prompt pack persistence, affiliate profile rules, and generator output belong to S3.</p>
      </div>
    </section>
  );
}

export function IntakeWorkflowForm({
  currentWorkspaceName,
  errorMessage,
  initialStep,
  message,
  savedSession,
  savedSessionWorkspaceName,
}: IntakeWorkflowFormProps) {
  const [step, setStep] = useState<IntakeWorkflowStep>(initialStep);
  const [productTitle, setProductTitle] = useState(savedSession?.product_title ?? "");
  const [shopeeUrl, setShopeeUrl] = useState(savedSession?.shopee_url ?? "");
  const [tiktokUrl, setTiktokUrl] = useState(savedSession?.tiktok_url ?? "");
  const [notes, setNotes] = useState(savedSession?.raw_notes ?? "");
  const hasMinimum = hasMinimumInput({ productTitle, shopeeUrl, tiktokUrl, notes });
  const canOpenPrompt = Boolean(savedSession && hasMinimum);

  useEffect(() => {
    setStep(initialStep === "prompt" && savedSession ? "prompt" : "intake");
    setProductTitle(savedSession?.product_title ?? "");
    setShopeeUrl(savedSession?.shopee_url ?? "");
    setTiktokUrl(savedSession?.tiktok_url ?? "");
    setNotes(savedSession?.raw_notes ?? "");
  }, [initialStep, savedSession?.id, savedSession?.product_title, savedSession?.raw_notes, savedSession?.shopee_url, savedSession?.tiktok_url]);

  return (
    <section className="intake-workflow stack">
      <div className="workflow-steps" aria-label="Intake workflow">
        <button className="workflow-step" data-active={step === "intake" ? "true" : undefined} type="button" onClick={() => setStep("intake")}>
          <span>1</span>
          Product intake
        </button>
        <button
          className="workflow-step"
          data-active={step === "prompt" ? "true" : undefined}
          disabled={!canOpenPrompt}
          type="button"
          onClick={() => setStep("prompt")}
        >
          <span>2</span>
          Prompt preview
        </button>
        <span className="workflow-step" data-disabled="true">
          <span>3</span>
          Controller
        </span>
        <span className="workflow-step" data-disabled="true">
          <span>4</span>
          Output
        </span>
      </div>

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

      <form className="stack" action={saveIntake}>
        <input type="hidden" name="intent" defaultValue="create_session" />
        <input type="hidden" name="product_photo_drive_item_ref_id" defaultValue="" />
        <input type="hidden" name="screenshot_drive_item_ref_id" defaultValue="" />

        <label className="stack auth-field" htmlFor="create-product-title">
          <span>Product title</span>
          <input
            id="create-product-title"
            name="product_title"
            type="text"
            placeholder="Product name"
            value={productTitle}
            onChange={(event) => setProductTitle(event.target.value)}
          />
        </label>
        <div className="grid two-up">
          <label className="stack auth-field" htmlFor="create-shopee-url">
            <span>Shopee link</span>
            <input
              id="create-shopee-url"
              name="shopee_url"
              type="url"
              placeholder="https://..."
              value={shopeeUrl}
              onChange={(event) => setShopeeUrl(event.target.value)}
            />
          </label>
          <label className="stack auth-field" htmlFor="create-tiktok-url">
            <span>TikTok link</span>
            <input
              id="create-tiktok-url"
              name="tiktok_url"
              type="url"
              placeholder="https://..."
              value={tiktokUrl}
              onChange={(event) => setTiktokUrl(event.target.value)}
            />
          </label>
        </div>
        <div className="grid two-up">
          <AssetUploadCard
            label="Product image"
            description="Local preview only. No Supabase Storage or Drive upload is performed in this sprint."
          />
          <AssetUploadCard
            label="Screenshot"
            description="Local preview only. Visual parsing still needs attached image bytes in a later backend step."
          />
        </div>
        <label className="stack auth-field" htmlFor="create-raw-notes">
          <span>Notes</span>
          <textarea
            id="create-raw-notes"
            name="raw_notes"
            rows={3}
            placeholder="Manual notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        <div className="grid two-up">
          <div className="muted-box stack-tight">
            <strong>Workspace</strong>
            <p>{currentWorkspaceName ? `New intake saves to ${currentWorkspaceName}.` : "No workspace selected. Intake saves unassigned."}</p>
          </div>
          <div className="muted-box stack-tight">
            <strong>Visual parsing rule</strong>
            <p>Product links are metadata only. If image bytes are unavailable, prompt preview uses text fallback and states that limitation.</p>
          </div>
        </div>
        {!hasMinimum ? (
          <div className="error-box status-box" role="alert">
            <AlertTriangle size={17} aria-hidden="true" />
            <span>Add a product title, Shopee/TikTok link, or notes before saving.</span>
          </div>
        ) : null}
        <FormActions>
          <SubmitButton disabledByValidation={!hasMinimum} />
        </FormActions>
      </form>

      {step === "prompt" && canOpenPrompt ? (
        <PromptPreviewPanel
          currentWorkspaceName={currentWorkspaceName}
          hasMinimum={hasMinimum}
          notes={notes}
          productTitle={productTitle}
          savedSession={savedSession}
          savedSessionWorkspaceName={savedSessionWorkspaceName}
          shopeeUrl={shopeeUrl}
          tiktokUrl={tiktokUrl}
        />
      ) : (
        <EmptyState
          icon={WandSparkles}
          title="Prompt preview is next."
          description="Save a valid intake to continue to the deterministic prompt preview/editor step."
        />
      )}
    </section>
  );
}
