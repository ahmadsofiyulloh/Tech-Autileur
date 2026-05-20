"use client";

import { Download, RefreshCcw } from "lucide-react";
import { AiMediaPreviewCard } from "./ai-media-preview-card";

type AiMediaOutputStepProps = {
  generated: boolean;
  onRetry?: () => void;
};

export function AiMediaOutputStep({ generated, onRetry }: AiMediaOutputStepProps) {
  if (!generated) {
    return <AiMediaPreviewCard label="Output" emptyText="Belum ada output." />;
  }

  return (
    <div className="stack">
      <AiMediaPreviewCard label="Output" emptyText="Output dummy siap." />
      <div className="ai-media-step-field__actions">
        <button type="button" className="button compact tertiary native-button">
          <Download size={14} />
          Simpan ke Drive
        </button>
        {onRetry && (
          <button type="button" className="button compact tertiary native-button" onClick={onRetry}>
            <RefreshCcw size={14} />
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
