"use client";

import { Suspense, useState } from "react";
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

function ImagePanel({
  onImageUploaded,
  uploading,
  uploadError,
}: {
  onImageUploaded: (refId: string) => void;
  uploading: boolean;
  uploadError: string | null;
}) {
  async function handleSelectionChange() {
    const input = document.querySelector<HTMLInputElement>('input[name="source_image"]');
    const file = input?.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("purpose", "SOURCE_IMAGE");
    const result = await uploadAiMediaSourceFileAction(fd);
    if (result.success) onImageUploaded(result.driveItemRefId);
  }

  return (
    <div className="stack">
      <ImagePreviewUploadCard
        label="Source Image"
        name="source_image"
        accept="image/*"
        emptyTitle="Pilih gambar"
        disabled={uploading}
        onSelectionChange={(state) => { if (state.selected) void handleSelectionChange(); }}
      />
      {uploadError ? <span className="ai-media-step-field__hint" role="alert">{uploadError}</span> : null}
    </div>
  );
}

function PromptPanel() {
  const [prompt, setPrompt] = useState("");

  return (
    <div className="stack">
      <div className="ai-media-step-field">
        <label className="ai-media-step-field__label" htmlFor="i2v-prompt">Prompt</label>
        <textarea id="i2v-prompt" rows={3} placeholder="Gerakan utama..." value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      </div>
    </div>
  );
}

function SettingsPanel({ model, onModelChange }: { model: string; onModelChange: (v: string) => void }) {
  const [ltxDuration, setLtxDuration] = useState(aiMediaToolConfig.ltxDurations[0].id);
  const [resolution, setResolution] = useState(aiMediaToolConfig.ltxResolutions[0].id);
  const [fps, setFps] = useState(aiMediaToolConfig.ltxFps[0].id);
  const [klingDuration, setKlingDuration] = useState(aiMediaToolConfig.klingDurations[0].id);
  const [cfgScale, setCfgScale] = useState(0.5);

  const isLtx = model === "ltx-2-fast";

  return (
    <div className="stack">
      <AiMediaModelCards options={aiMediaToolConfig.i2vModels} value={model} onChange={onModelChange} />
      <div className="ai-media-settings-section">
        {isLtx ? (
          <div className="ai-media-settings-grid ai-media-settings-grid--three">
            <AiMediaOptionPicker label="Durasi" options={aiMediaToolConfig.ltxDurations} value={ltxDuration} onChange={setLtxDuration} compact />
            <AiMediaOptionPicker label="Resolusi" options={aiMediaToolConfig.ltxResolutions} value={resolution} onChange={setResolution} />
            <AiMediaOptionPicker label="FPS" options={aiMediaToolConfig.ltxFps} value={fps} onChange={setFps} />
          </div>
        ) : (
          <div className="stack">
            <div className="ai-media-settings-grid">
              <AiMediaOptionPicker label="Durasi" options={aiMediaToolConfig.klingDurations} value={klingDuration} onChange={setKlingDuration} />
            </div>
            <div className="ai-media-slider-group">
              <AiMediaSlider label="CFG Scale" min={0} max={1} step={0.1} value={cfgScale} onChange={setCfgScale} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type ImageToVideoStepsProps = {
  provider: AiMediaProviderProjection | null;
};

function ImageToVideoInner({ provider }: ImageToVideoStepsProps) {
  const [generating, setGenerating] = useState(false);
  const [generatedTask, setGeneratedTask] = useState<AiMediaGenerationTaskProjection | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [model, setModel] = useState(aiMediaToolConfig.i2vModels[0].id);
  const [imageRefId, setImageRefId] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const taskLogs = (generatedTask?.logs ?? []).map((l, i) => ({
    id: `${generatedTask?.id ?? "t"}-${i}`,
    time: l.time,
    message: l.message,
    level: l.level,
  }));

  function handleImageUploaded(refId: string) {
    setImageRefId(refId);
    setUploadError(null);
  }

  async function handleGenerate() {
    setGenerating(true);
    setErrorMessage(null);
    try {
      const fd = new FormData();
      fd.set("tool_type", "IMAGE_TO_VIDEO");
      fd.set("model_name", model);
      if (imageRefId) fd.set("source_image_drive_item_ref_id", imageRefId);
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
    ? `Magnific — ${provider.fallbackReady ? "fallback siap" : `${provider.activeKeyCount} kunci`}`
    : "Memuat...";

  const imageSummary = imageRefId ? "Image siap" : "Pilih gambar";

  const steps: IntakeStepperStep[] = [
    { id: "provider", label: "Provider", summary: providerSummary, status: provider ? "completed" : "pending", badgeLabel: provider?.state === "active" ? "ACTIVE" : "—", badgeTone: provider?.state === "active" ? "success" : "neutral", panel: <AiMediaProviderStep provider={provider} /> },
    { id: "image", label: "Image", summary: imageSummary, status: imageRefId ? "completed" : "active", badgeLabel: imageRefId ? "READY" : "DRAFT", badgeTone: imageRefId ? "success" : "info", panel: <ImagePanel onImageUploaded={handleImageUploaded} uploading={imageUploading} uploadError={uploadError} /> },
    { id: "prompt", label: "Prompt", summary: "Prompt gerak", status: "pending", badgeLabel: "DRAFT", badgeTone: "neutral", panel: <PromptPanel /> },
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
          <IntakeStepper steps={steps} defaultExpandedStepId="image" ariaLabel="Image to Video steps" />
        </div>
        <div className="ai-media-tool-layout__side">
          <AiMediaLogTerminal entries={taskLogs} />
        </div>
      </div>
    </>
  );
}

export function ImageToVideoSteps({ provider }: ImageToVideoStepsProps) {
  return (
    <Suspense fallback={<SkeletonIntakeStepper />}>
      <ImageToVideoInner provider={provider} />
    </Suspense>
  );
}
