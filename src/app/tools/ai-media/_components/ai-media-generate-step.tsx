"use client";

import { Play } from "lucide-react";
import { AiMediaPreviewCard } from "./ai-media-preview-card";

type AiMediaGenerateStepProps = {
  generating: boolean;
  onGenerate: () => void;
  previewLabel?: string;
};

export function AiMediaGenerateStep({ generating, onGenerate, previewLabel = "Input Preview" }: AiMediaGenerateStepProps) {
  return (
    <div className="stack">
      <AiMediaPreviewCard label={previewLabel} emptyText="Siap generate." />
      <button type="button" className="button primary native-button" onClick={onGenerate} disabled={generating}>
        <Play size={14} />
        {generating ? "Generating..." : "Generate"}
      </button>
      {generating && <span className="ai-media-step-field__hint">Dummy — tidak ada request nyata.</span>}
    </div>
  );
}
