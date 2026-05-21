"use client";

import { Suspense, useState } from "react";
import { Play, RefreshCcw, Download, ExternalLink } from "lucide-react";
import { IntakeStepper, type IntakeStepperStep } from "@/components/operator/intake-stepper";
import { SkeletonIntakeStepper } from "@/components/operator/loading-skeleton";
import { ImagePreviewUploadCard } from "@/components/operator/image-preview-upload-card";
import { aiMediaToolConfig } from "@/lib/ai-media/tool-config";
import type {
  AiMediaDriveOutputProjection,
  AiMediaDriveOutputRefProjection,
  AiMediaGenerationTaskProjection,
  AiMediaProviderProjection,
} from "@/lib/server/ai-media";
import { generateAiMediaTaskAction, saveAiMediaOutputAction, uploadAiMediaSourceFileAction } from "../actions";
import { AiMediaLogPanel } from "./ai-media-log-panel";
import { AiMediaLogTerminal } from "./ai-media-log-terminal";
import { AiMediaModelCards } from "./ai-media-model-cards";
import { AiMediaOptionPicker } from "./ai-media-option-picker";
import { AiMediaPageHeader } from "./ai-media-page-header";
import { AiMediaPreviewCard } from "./ai-media-preview-card";
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

function UpscaleSettingsPanel({ mode, onModeChange }: { mode: string; onModeChange: (v: string) => void }) {
  // Creative state
  const [engine, setEngine] = useState(aiMediaToolConfig.upscalerEngines[0].id);
  const [scale, setScale] = useState(aiMediaToolConfig.upscalerScaleFactors[0].id);
  const [optimizedFor, setOptimizedFor] = useState(aiMediaToolConfig.upscalerOptimizedFor[0].id);
  const [creativity, setCreativity] = useState(0);
  const [hdr, setHdr] = useState(0);
  const [resemblance, setResemblance] = useState(0);
  const [fractality, setFractality] = useState(0);
  // Precision state
  const [precisionScale, setPrecisionScale] = useState(aiMediaToolConfig.upscalerPrecisionScales[0].id);
  const [flavor, setFlavor] = useState(aiMediaToolConfig.upscalerFlavors[0].id);
  const [sharpen, setSharpen] = useState(7);
  const [smartGrain, setSmartGrain] = useState(7);
  const [ultraDetail, setUltraDetail] = useState(30);

  const isCreative = mode === "creative";

  return (
    <div className="stack">
      <AiMediaModelCards options={aiMediaToolConfig.upscalerModes} value={mode} onChange={onModeChange} />
      <div className="ai-media-settings-section">
        {isCreative ? (
          <div className="stack">
            <div className="ai-media-settings-grid ai-media-settings-grid--three">
              <AiMediaOptionPicker label="Engine" options={aiMediaToolConfig.upscalerEngines} value={engine} onChange={setEngine} />
              <AiMediaOptionPicker label="Scale" options={aiMediaToolConfig.upscalerScaleFactors} value={scale} onChange={setScale} />
              <AiMediaOptionPicker label="Optimized For" options={aiMediaToolConfig.upscalerOptimizedFor} value={optimizedFor} onChange={setOptimizedFor} compact />
            </div>
            <div className="ai-media-slider-group">
              <AiMediaSlider label="Creativity" min={-10} max={10} step={1} value={creativity} onChange={setCreativity} />
              <AiMediaSlider label="HDR" min={-10} max={10} step={1} value={hdr} onChange={setHdr} />
              <AiMediaSlider label="Resemblance" min={-10} max={10} step={1} value={resemblance} onChange={setResemblance} />
              <AiMediaSlider label="Fractality" min={-10} max={10} step={1} value={fractality} onChange={setFractality} />
            </div>
          </div>
        ) : (
          <div className="stack">
            <div className="ai-media-settings-grid">
              <AiMediaOptionPicker label="Scale" options={aiMediaToolConfig.upscalerPrecisionScales} value={precisionScale} onChange={setPrecisionScale} />
              <AiMediaOptionPicker label="Flavor" options={aiMediaToolConfig.upscalerFlavors} value={flavor} onChange={setFlavor} />
            </div>
            <div className="ai-media-slider-group">
              <AiMediaSlider label="Sharpen" min={0} max={100} step={1} value={sharpen} onChange={setSharpen} />
              <AiMediaSlider label="Smart Grain" min={0} max={100} step={1} value={smartGrain} onChange={setSmartGrain} />
              <AiMediaSlider label="Ultra Detail" min={0} max={100} step={1} value={ultraDetail} onChange={setUltraDetail} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GeneratePanel({ generating, onGenerate }: { generating: boolean; onGenerate: () => void }) {
  return (
    <div className="stack">
      <AiMediaPreviewCard label="Before" emptyText="Image siap." />
      <button type="button" className="button primary native-button" disabled={generating} onClick={onGenerate}>
        <Play size={14} />
        {generating ? "Generating..." : "Generate"}
      </button>
    </div>
  );
}

function CompareOutputPanel({
  generated,
  taskId,
  initialOutput,
  onRetry,
}: {
  generated: boolean;
  taskId: string | null;
  initialOutput: AiMediaDriveOutputProjection | AiMediaDriveOutputRefProjection | null;
  onRetry: () => void;
}) {
  const [view, setView] = useState<"before" | "after">("after");
  const [output, setOutput] = useState<AiMediaDriveOutputProjection | null>(
    initialOutput ? ("previewDataUrl" in initialOutput ? initialOutput : { ...initialOutput, previewDataUrl: null }) : null,
  );
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!generated) {
    return <AiMediaPreviewCard label="Output" emptyText="Belum ada output." />;
  }

  const previewSrc = output?.previewDataUrl ?? null;

  async function handleSave() {
    if (!taskId) {
      setErrorMessage("Task belum siap disimpan.");
      return;
    }
    setSaving(true);
    setErrorMessage(null);
    setStatusMessage("Mengunggah ke Drive...");
    try {
      const result = await saveAiMediaOutputAction(taskId);
      if (result.success) {
        setOutput(result.output);
        setStatusMessage(result.alreadySaved ? "Sudah tersimpan di Drive." : "Tersimpan di Drive.");
      } else {
        setStatusMessage(null);
        setErrorMessage(result.error);
      }
    } catch {
      setStatusMessage(null);
      setErrorMessage("Simpan ke Drive gagal.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ai-media-compare">
      <div className="ai-media-compare__toggle">
        <button type="button" className={`button compact${view === "before" ? " primary" : " tertiary"} native-button`} onClick={() => setView("before")}>Before</button>
        <button type="button" className={`button compact${view === "after" ? " primary" : " tertiary"} native-button`} onClick={() => setView("after")}>After</button>
      </div>
      <div className="ai-media-compare__stacked">
        <AiMediaPreviewCard
          label={view === "before" ? "Before" : "After"}
          src={view === "after" ? previewSrc : null}
          emptyText={view === "before" ? "Image asli." : output ? "Upscale tersimpan di Drive." : "Upscale siap."}
        />
      </div>
      <div className="ai-media-compare__slider">
        <AiMediaPreviewCard label="Before" emptyText="Image asli." />
        <AiMediaPreviewCard label="After" src={previewSrc} emptyText={output ? "Upscale tersimpan di Drive." : "Upscale siap."} className="ai-media-compare__after" />
        <input type="range" min="0" max="100" defaultValue="50" aria-label="Compare slider" />
      </div>
      {output ? (
        <dl className="product-card__meta">
          <div>
            <dt>File</dt>
            <dd>{output.name}</dd>
          </div>
          <div>
            <dt>Tipe</dt>
            <dd>{output.mimeType ?? "—"}</dd>
          </div>
        </dl>
      ) : null}
      <div className="ai-media-step-field__actions">
        {output ? (
          <a
            href={output.driveUrl}
            target="_blank"
            rel="noreferrer"
            className="button compact primary native-button"
          >
            <ExternalLink size={14} />
            Buka di Drive
          </a>
        ) : (
          <button
            type="button"
            className="button compact tertiary native-button"
            onClick={handleSave}
            disabled={saving || !taskId}
          >
            <Download size={14} />
            {saving ? "Menyimpan..." : "Simpan ke Drive"}
          </button>
        )}
        <button type="button" className="button compact tertiary native-button" onClick={onRetry}>
          <RefreshCcw size={14} />
          Retry
        </button>
      </div>
      {statusMessage ? <span className="ai-media-step-field__hint">{statusMessage}</span> : null}
      {errorMessage ? (
        <span className="ai-media-step-field__hint" role="alert">
          {errorMessage}
        </span>
      ) : null}
    </div>
  );
}

type UpscalerStepsProps = {
  provider: AiMediaProviderProjection | null;
};

function UpscalerInner({ provider }: UpscalerStepsProps) {
  const [generating, setGenerating] = useState(false);
  const [generatedTask, setGeneratedTask] = useState<AiMediaGenerationTaskProjection | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mode, setMode] = useState(aiMediaToolConfig.upscalerModes[0].id);
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
      fd.set("tool_type", "UPSCALER");
      fd.set("model_name", mode);
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

  function handleRetry() { setGeneratedTask(null); void handleGenerate(); }

  const generated = generatedTask?.status === "SUCCESS";
  void errorMessage;

  const providerSummary = provider
    ? `Magnific — ${provider.fallbackReady ? "fallback siap" : `${provider.activeKeyCount} kunci`}`
    : "Memuat...";

  const imageSummary = imageRefId ? "Image siap" : "Pilih gambar";

  const steps: IntakeStepperStep[] = [
    { id: "provider", label: "Provider", summary: providerSummary, status: provider ? "completed" : "pending", badgeLabel: provider?.state === "active" ? "ACTIVE" : "—", badgeTone: provider?.state === "active" ? "success" : "neutral", panel: <AiMediaProviderStep provider={provider} /> },
    { id: "image", label: "Image", summary: imageSummary, status: imageRefId ? "completed" : "active", badgeLabel: imageRefId ? "READY" : "DRAFT", badgeTone: imageRefId ? "success" : "info", panel: <ImagePanel onImageUploaded={handleImageUploaded} uploading={imageUploading} uploadError={uploadError} /> },
    { id: "settings", label: "Upscale Settings", summary: "Model, scale, mode", status: "pending", badgeLabel: "DRAFT", badgeTone: "neutral", panel: <UpscaleSettingsPanel mode={mode} onModeChange={setMode} /> },
    { id: "generate", label: "Preview & Generate", summary: generating ? "Generating..." : "Siap", status: generating ? "loading" : "pending", badgeLabel: generating ? "RUNNING" : "WAITING", badgeTone: generating ? "warning" : "neutral", panel: <GeneratePanel generating={generating} onGenerate={handleGenerate} /> },
    {
      id: "compare",
      label: "Compare Output",
      summary: generated ? "Compare siap" : "Belum ada",
      status: generated ? "completed" : "locked",
      badgeLabel: generated ? "SUCCESS" : "LOCKED",
      badgeTone: generated ? "success" : "neutral",
      panel: (
        <CompareOutputPanel
          generated={generated}
          taskId={generatedTask?.id ?? null}
          initialOutput={generatedTask?.outputDrive ?? null}
          onRetry={handleRetry}
        />
      ),
    },
  ];

  return (
    <>
      <AiMediaPageHeader backHref="/tools/ai-media" actions={<AiMediaLogPanel entries={taskLogs} />} />
      <div className="ai-media-tool-layout">
        <div className="ai-media-tool-layout__stepper">
          <IntakeStepper steps={steps} defaultExpandedStepId="image" ariaLabel="Upscaler steps" />
        </div>
        <div className="ai-media-tool-layout__side">
          <AiMediaLogTerminal entries={taskLogs} />
        </div>
      </div>
    </>
  );
}

export function UpscalerSteps({ provider }: UpscalerStepsProps) {
  return (
    <Suspense fallback={<SkeletonIntakeStepper />}>
      <UpscalerInner provider={provider} />
    </Suspense>
  );
}
