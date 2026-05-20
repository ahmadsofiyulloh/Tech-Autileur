"use client";

import { Suspense, useState } from "react";
import { Play, RefreshCcw } from "lucide-react";
import { IntakeStepper, type IntakeStepperStep } from "@/components/operator/intake-stepper";
import { ErrorState } from "@/components/operator/error-state";
import { SkeletonIntakeStepper } from "@/components/operator/loading-skeleton";
import { ImagePreviewUploadCard } from "@/components/operator/image-preview-upload-card";
import { mockLogEntries, mockToolOptions } from "@/lib/ai-media/mock-data";
import { useAiMediaDemoState } from "@/lib/ai-media/use-demo-state";
import { AiMediaLogPanel } from "./ai-media-log-panel";
import { AiMediaLogTerminal } from "./ai-media-log-terminal";
import { AiMediaOptionPicker } from "./ai-media-option-picker";
import { AiMediaPageHeader } from "./ai-media-page-header";
import { AiMediaPreviewCard } from "./ai-media-preview-card";
import { AiMediaProviderStep } from "./ai-media-provider-step";

function ImagePanel() {
  return (
    <div className="stack">
      <ImagePreviewUploadCard label="Source Image" name="source_image" accept="image/*" emptyTitle="Pilih gambar" />
    </div>
  );
}

function UpscaleSettingsPanel() {
  const [model, setModel] = useState(mockToolOptions.models[0].id);
  const [scale, setScale] = useState(mockToolOptions.upscaleScales[0].id);
  const [mode, setMode] = useState(mockToolOptions.upscaleModes[0].id);

  return (
    <div className="stack">
      <AiMediaOptionPicker label="Model" options={mockToolOptions.models} value={model} onChange={setModel} />
      <AiMediaOptionPicker label="Scale" options={mockToolOptions.upscaleScales} value={scale} onChange={setScale} />
      <AiMediaOptionPicker label="Mode" options={mockToolOptions.upscaleModes} value={mode} onChange={setMode} />
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
      {generating && <span className="ai-media-step-field__hint">Dummy — tidak ada request nyata.</span>}
    </div>
  );
}

function CompareOutputPanel({ generated, onRetry }: { generated: boolean; onRetry: () => void }) {
  const [view, setView] = useState<"before" | "after">("after");

  if (!generated) {
    return <AiMediaPreviewCard label="Output" emptyText="Belum ada output." />;
  }

  return (
    <div className="ai-media-compare">
      <div className="ai-media-compare__toggle">
        <button type="button" className={`button compact${view === "before" ? " primary" : " tertiary"} native-button`} onClick={() => setView("before")}>Before</button>
        <button type="button" className={`button compact${view === "after" ? " primary" : " tertiary"} native-button`} onClick={() => setView("after")}>After</button>
      </div>
      <div className="ai-media-compare__stacked">
        <AiMediaPreviewCard label={view === "before" ? "Before" : "After"} emptyText={view === "before" ? "Image asli." : "Upscale dummy siap."} />
      </div>
      <div className="ai-media-compare__slider">
        <AiMediaPreviewCard label="Before" emptyText="Image asli." />
        <AiMediaPreviewCard label="After" emptyText="Upscale dummy siap." className="ai-media-compare__after" />
        <input type="range" min="0" max="100" defaultValue="50" aria-label="Compare slider" />
      </div>
      <div className="ai-media-step-field__actions">
        <button type="button" className="button compact tertiary native-button" onClick={onRetry}>
          <RefreshCcw size={14} />
          Retry
        </button>
      </div>
    </div>
  );
}

function UpscalerInner() {
  const { isLoading, isError } = useAiMediaDemoState();
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  if (isLoading) return <><AiMediaPageHeader backHref="/tools/ai-media" actions={<AiMediaLogPanel entries={mockLogEntries} />} /><SkeletonIntakeStepper /></>;
  if (isError) return <><AiMediaPageHeader backHref="/tools/ai-media" /><ErrorState title="Gagal memuat Upscaler." /></>;

  function handleGenerate() {
    setGenerating(true);
    setTimeout(() => { setGenerating(false); setGenerated(true); }, 1600);
  }

  function handleRetry() { setGenerated(false); handleGenerate(); }

  const steps: IntakeStepperStep[] = [
    { id: "provider", label: "Provider", summary: "Magnific — fallback siap", status: "completed", badgeLabel: "ACTIVE", badgeTone: "success", panel: <AiMediaProviderStep /> },
    { id: "image", label: "Image", summary: "Pilih gambar", status: "active", badgeLabel: "DRAFT", badgeTone: "info", panel: <ImagePanel /> },
    { id: "settings", label: "Upscale Settings", summary: "Model, scale, mode", status: "pending", badgeLabel: "DRAFT", badgeTone: "neutral", panel: <UpscaleSettingsPanel /> },
    { id: "generate", label: "Preview & Generate", summary: generating ? "Generating..." : "Siap", status: generating ? "loading" : "pending", badgeLabel: generating ? "RUNNING" : "WAITING", badgeTone: generating ? "warning" : "neutral", panel: <GeneratePanel generating={generating} onGenerate={handleGenerate} /> },
    { id: "compare", label: "Compare Output", summary: generated ? "Compare siap" : "Belum ada", status: generated ? "completed" : "locked", badgeLabel: generated ? "SUCCESS" : "LOCKED", badgeTone: generated ? "success" : "neutral", panel: <CompareOutputPanel generated={generated} onRetry={handleRetry} /> },
  ];

  return (
    <>
      <AiMediaPageHeader backHref="/tools/ai-media" actions={<AiMediaLogPanel entries={mockLogEntries} />} />
      <div className="ai-media-tool-layout">
        <div className="ai-media-tool-layout__stepper">
          <IntakeStepper steps={steps} defaultExpandedStepId="image" ariaLabel="Upscaler steps" />
        </div>
        <div className="ai-media-tool-layout__side">
          <AiMediaLogTerminal entries={mockLogEntries} />
        </div>
      </div>
    </>
  );
}

export function UpscalerSteps() {
  return (
    <Suspense fallback={<SkeletonIntakeStepper />}>
      <UpscalerInner />
    </Suspense>
  );
}
