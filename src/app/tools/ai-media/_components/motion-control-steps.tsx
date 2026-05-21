"use client";

import { Suspense, useRef, useState } from "react";
import { IntakeStepper, type IntakeStepperStep } from "@/components/operator/intake-stepper";
import { SkeletonIntakeStepper } from "@/components/operator/loading-skeleton";
import { ImagePreviewUploadCard } from "@/components/operator/image-preview-upload-card";
import { aiMediaToolConfig } from "@/lib/ai-media/tool-config";
import type { AiMediaGenerationTaskProjection, AiMediaProviderProjection } from "@/lib/server/ai-media";
import { generateAiMediaTaskAction, uploadAiMediaSourceFileAction } from "../actions";
import { AiMediaGenerateStep } from "./ai-media-generate-step";
import { AiMediaLogPanel } from "./ai-media-log-panel";
import { AiMediaLogTerminal } from "./ai-media-log-terminal";
import { AiMediaModelCards } from "./ai-media-model-cards";
import { AiMediaOptionPicker } from "./ai-media-option-picker";
import { AiMediaOutputStep } from "./ai-media-output-step";
import { AiMediaPageHeader } from "./ai-media-page-header";
import { AiMediaProviderStep } from "./ai-media-provider-step";
import { AiMediaSlider } from "./ai-media-slider";

function ReferencePanel({
  onImageUploaded,
  onMotionUploaded,
  imageUploading,
  motionUploading,
  uploadError,
}: {
  onImageUploaded: (refId: string) => void;
  onMotionUploaded: (refId: string) => void;
  imageUploading: boolean;
  motionUploading: boolean;
  uploadError: string | null;
}) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const motionInputRef = useRef<HTMLInputElement>(null);

  async function handleImageChange() {
    const file = imageInputRef.current?.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("purpose", "SOURCE_IMAGE");
    const result = await uploadAiMediaSourceFileAction(fd);
    if (result.success) onImageUploaded(result.driveItemRefId);
  }

  async function handleMotionChange() {
    const file = motionInputRef.current?.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("purpose", "RAW_CLIP");
    const result = await uploadAiMediaSourceFileAction(fd);
    if (result.success) onMotionUploaded(result.driveItemRefId);
  }

  return (
    <div className="stack">
      <ImagePreviewUploadCard
        label="Reference Image"
        name="ref_image"
        accept="image/*"
        emptyTitle="Pilih gambar"
        disabled={imageUploading}
        onSelectionChange={(state) => { if (state.selected) void handleImageChange(); }}
      />
      <ImagePreviewUploadCard
        label="Motion Reference Video"
        name="ref_video"
        accept="video/*"
        emptyTitle="Pilih video"
        disabled={motionUploading}
        onSelectionChange={(state) => { if (state.selected) void handleMotionChange(); }}
      />
      {uploadError ? <span className="ai-media-step-field__hint" role="alert">{uploadError}</span> : null}
    </div>
  );
}

function PromptPanel() {
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");

  return (
    <div className="stack">
      <div className="ai-media-step-field">
        <label className="ai-media-step-field__label" htmlFor="mc-prompt">Prompt</label>
        <textarea id="mc-prompt" rows={3} placeholder="Deskripsi gerakan..." value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      </div>
      <div className="ai-media-step-field">
        <label className="ai-media-step-field__label" htmlFor="mc-neg">Negative Prompt</label>
        <textarea id="mc-neg" rows={2} placeholder="Yang dihindari..." value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} />
      </div>
    </div>
  );
}

function SettingsPanel({ model, onModelChange }: { model: string; onModelChange: (v: string) => void }) {
  const [orientation, setOrientation] = useState(aiMediaToolConfig.motionControlOrientations[0].id);
  const [cfgScale, setCfgScale] = useState(0.5);

  return (
    <div className="stack">
      <AiMediaModelCards options={aiMediaToolConfig.motionControlTiers} value={model} onChange={onModelChange} />
      <div className="ai-media-settings-section">
        <div className="ai-media-settings-grid">
          <AiMediaOptionPicker label="Orientation" options={aiMediaToolConfig.motionControlOrientations} value={orientation} onChange={setOrientation} />
        </div>
      </div>
      <div className="ai-media-slider-group">
        <AiMediaSlider label="CFG Scale" min={0} max={1} step={0.1} value={cfgScale} onChange={setCfgScale} />
      </div>
    </div>
  );
}

type MotionControlStepsProps = {
  provider: AiMediaProviderProjection | null;
};

function MotionControlInner({ provider }: MotionControlStepsProps) {
  const [generating, setGenerating] = useState(false);
  const [generatedTask, setGeneratedTask] = useState<AiMediaGenerationTaskProjection | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [model, setModel] = useState(aiMediaToolConfig.motionControlTiers[0].id);
  const [imageRefId, setImageRefId] = useState<string | null>(null);
  const [motionRefId, setMotionRefId] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [motionUploading, setMotionUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const taskLogs = (generatedTask?.logs ?? []).map((l, i) => ({
    id: `${generatedTask?.id ?? "t"}-${i}`,
    time: l.time,
    message: l.message,
    level: l.level,
  }));

  async function handleImageUploaded(refId: string) {
    setImageRefId(refId);
    setUploadError(null);
  }

  async function handleMotionUploaded(refId: string) {
    setMotionRefId(refId);
    setUploadError(null);
  }

  async function handleGenerate() {
    setGenerating(true);
    setErrorMessage(null);
    try {
      const fd = new FormData();
      fd.set("tool_type", "MOTION_CONTROL");
      fd.set("model_name", model);
      if (imageRefId) fd.set("source_image_drive_item_ref_id", imageRefId);
      if (motionRefId) fd.set("source_motion_drive_item_ref_id", motionRefId);
      const result = await generateAiMediaTaskAction(fd);
      if (result.success) {
        setGeneratedTask(result.task);
      } else {
        setErrorMessage(result.error);
      }
    } catch {
      setErrorMessage("Generate gagal.");
    } finally {
      setGenerating(false);
    }
  }

  const generated = generatedTask?.status === "SUCCESS";
  void errorMessage;

  const providerSummary = provider
    ? `Magnific — ${provider.activeKeyCount} kunci`
    : "Memuat...";

  const refSummary = imageRefId && motionRefId
    ? "Image + video siap"
    : imageRefId
      ? "Image siap"
      : motionRefId
        ? "Video siap"
        : "Pilih file";

  const steps: IntakeStepperStep[] = [
    { id: "provider", label: "Provider", summary: providerSummary, status: provider ? "completed" : "pending", badgeLabel: provider?.state === "active" ? "ACTIVE" : "—", badgeTone: provider?.state === "active" ? "success" : "neutral", panel: <AiMediaProviderStep provider={provider} /> },
    { id: "reference", label: "Reference", summary: refSummary, status: imageRefId || motionRefId ? "completed" : "active", badgeLabel: imageRefId && motionRefId ? "READY" : "DRAFT", badgeTone: imageRefId && motionRefId ? "success" : "info", panel: <ReferencePanel onImageUploaded={handleImageUploaded} onMotionUploaded={handleMotionUploaded} imageUploading={imageUploading} motionUploading={motionUploading} uploadError={uploadError} /> },
    { id: "prompt", label: "Prompt", summary: "Deskripsi gerakan", status: "pending", badgeLabel: "DRAFT", badgeTone: "neutral", panel: <PromptPanel /> },
    { id: "settings", label: "Settings", summary: "Model, durasi, aspect", status: "pending", badgeLabel: "DRAFT", badgeTone: "neutral", panel: <SettingsPanel model={model} onModelChange={setModel} /> },
    { id: "generate", label: "Preview & Generate", summary: generating ? "Generating..." : "Siap", status: generating ? "loading" : "pending", badgeLabel: generating ? "RUNNING" : "WAITING", badgeTone: generating ? "warning" : "neutral", panel: <AiMediaGenerateStep generating={generating} onGenerate={handleGenerate} /> },
    {
      id: "output",
      label: "Output",
      summary: generated ? "Siap" : "Belum ada",
      status: generated ? "completed" : "locked",
      badgeLabel: generated ? "SUCCESS" : "LOCKED",
      badgeTone: generated ? "success" : "neutral",
      panel: (
        <AiMediaOutputStep
          generated={generated}
          taskId={generatedTask?.id ?? null}
          initialOutput={generatedTask?.outputDrive ?? null}
          onRetry={() => {
            setGeneratedTask(null);
            void handleGenerate();
          }}
        />
      ),
    },
  ];

  return (
    <>
      <AiMediaPageHeader backHref="/tools/ai-media" actions={<AiMediaLogPanel entries={taskLogs} />} />
      <div className="ai-media-tool-layout">
        <div className="ai-media-tool-layout__stepper">
          <IntakeStepper steps={steps} defaultExpandedStepId="reference" ariaLabel="Motion Control steps" />
        </div>
        <div className="ai-media-tool-layout__side">
          <AiMediaLogTerminal entries={taskLogs} />
        </div>
      </div>
    </>
  );
}

export function MotionControlSteps({ provider }: MotionControlStepsProps) {
  return (
    <Suspense fallback={<SkeletonIntakeStepper />}>
      <MotionControlInner provider={provider} />
    </Suspense>
  );
}
