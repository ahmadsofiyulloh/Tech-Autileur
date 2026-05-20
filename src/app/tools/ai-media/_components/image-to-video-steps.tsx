"use client";

import { Suspense, useState } from "react";
import { IntakeStepper, type IntakeStepperStep } from "@/components/operator/intake-stepper";
import { ErrorState } from "@/components/operator/error-state";
import { SkeletonIntakeStepper } from "@/components/operator/loading-skeleton";
import { ImagePreviewUploadCard } from "@/components/operator/image-preview-upload-card";
import { mockLogEntries, mockToolOptions } from "@/lib/ai-media/mock-data";
import { useAiMediaDemoState } from "@/lib/ai-media/use-demo-state";
import { AiMediaGenerateStep } from "./ai-media-generate-step";
import { AiMediaLogPanel } from "./ai-media-log-panel";
import { AiMediaLogTerminal } from "./ai-media-log-terminal";
import { AiMediaOptionPicker } from "./ai-media-option-picker";
import { AiMediaOutputStep } from "./ai-media-output-step";
import { AiMediaPageHeader } from "./ai-media-page-header";
import { AiMediaProviderStep } from "./ai-media-provider-step";

function ImagePanel() {
  return (
    <div className="stack">
      <ImagePreviewUploadCard label="Source Image" name="source_image" accept="image/*" emptyTitle="Pilih gambar" />
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

function SettingsPanel() {
  const [model, setModel] = useState(mockToolOptions.models[0].id);
  const [duration, setDuration] = useState(mockToolOptions.durations[1].id);
  const [aspect, setAspect] = useState(mockToolOptions.aspectRatios[0].id);

  return (
    <div className="stack">
      <AiMediaOptionPicker label="Model" options={mockToolOptions.models} value={model} onChange={setModel} />
      <AiMediaOptionPicker label="Durasi" options={mockToolOptions.durations} value={duration} onChange={setDuration} />
      <AiMediaOptionPicker label="Aspect Ratio" options={mockToolOptions.aspectRatios} value={aspect} onChange={setAspect} />
    </div>
  );
}

function ImageToVideoInner() {
  const { isLoading, isError } = useAiMediaDemoState();
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  if (isLoading) return <><AiMediaPageHeader backHref="/tools/ai-media" actions={<AiMediaLogPanel entries={mockLogEntries} />} /><SkeletonIntakeStepper /></>;
  if (isError) return <><AiMediaPageHeader backHref="/tools/ai-media" /><ErrorState title="Gagal memuat Image to Video." /></>;

  function handleGenerate() {
    setGenerating(true);
    setTimeout(() => { setGenerating(false); setGenerated(true); }, 1600);
  }

  const steps: IntakeStepperStep[] = [
    { id: "provider", label: "Provider", summary: "Magnific — fallback siap", status: "completed", badgeLabel: "ACTIVE", badgeTone: "success", panel: <AiMediaProviderStep /> },
    { id: "image", label: "Image", summary: "Pilih gambar", status: "active", badgeLabel: "DRAFT", badgeTone: "info", panel: <ImagePanel /> },
    { id: "prompt", label: "Prompt", summary: "Prompt gerak", status: "pending", badgeLabel: "DRAFT", badgeTone: "neutral", panel: <PromptPanel /> },
    { id: "settings", label: "Settings", summary: "Model, durasi, aspect", status: "pending", badgeLabel: "DRAFT", badgeTone: "neutral", panel: <SettingsPanel /> },
    { id: "generate", label: "Preview & Generate", summary: generating ? "Generating..." : "Siap", status: generating ? "loading" : "pending", badgeLabel: generating ? "RUNNING" : "WAITING", badgeTone: generating ? "warning" : "neutral", panel: <AiMediaGenerateStep generating={generating} onGenerate={handleGenerate} /> },
    { id: "output", label: "Output", summary: generated ? "Siap" : "Belum ada", status: generated ? "completed" : "locked", badgeLabel: generated ? "SUCCESS" : "LOCKED", badgeTone: generated ? "success" : "neutral", panel: <AiMediaOutputStep generated={generated} onRetry={() => { setGenerated(false); handleGenerate(); }} /> },
  ];

  return (
    <>
      <AiMediaPageHeader backHref="/tools/ai-media" actions={<AiMediaLogPanel entries={mockLogEntries} />} />
      <div className="ai-media-tool-layout">
        <div className="ai-media-tool-layout__stepper">
          <IntakeStepper steps={steps} defaultExpandedStepId="image" ariaLabel="Image to Video steps" />
        </div>
        <div className="ai-media-tool-layout__side">
          <AiMediaLogTerminal entries={mockLogEntries} />
        </div>
      </div>
    </>
  );
}

export function ImageToVideoSteps() {
  return (
    <Suspense fallback={<SkeletonIntakeStepper />}>
      <ImageToVideoInner />
    </Suspense>
  );
}
