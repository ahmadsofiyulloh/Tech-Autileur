"use client";

import { useState } from "react";
import { Download, ExternalLink, RefreshCcw } from "lucide-react";
import { saveAiMediaOutputAction } from "../actions";
import type {
  AiMediaDriveOutputProjection,
  AiMediaDriveOutputRefProjection,
} from "@/lib/server/ai-media";
import { AiMediaPreviewCard } from "./ai-media-preview-card";

type AiMediaOutputStepProps = {
  generated: boolean;
  taskId?: string | null;
  initialOutput?: AiMediaDriveOutputProjection | AiMediaDriveOutputRefProjection | null;
  onRetry?: () => void;
};

function withPreview(
  output: AiMediaDriveOutputProjection | AiMediaDriveOutputRefProjection | null,
): AiMediaDriveOutputProjection | null {
  if (!output) return null;
  if ("previewDataUrl" in output) return output;
  return { ...output, previewDataUrl: null };
}

export function AiMediaOutputStep({
  generated,
  taskId,
  initialOutput,
  onRetry,
}: AiMediaOutputStepProps) {
  const [output, setOutput] = useState<AiMediaDriveOutputProjection | null>(
    withPreview(initialOutput ?? null),
  );
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!generated) {
    return <AiMediaPreviewCard label="Output" emptyText="Belum ada output." />;
  }

  const previewSrc = output?.previewDataUrl ?? null;
  const isImage = (output?.mimeType ?? "").startsWith("image/");
  const emptyText = output ? (isImage ? "Output siap." : "Output video tersimpan di Drive.") : "Output siap.";

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
    <div className="stack">
      <AiMediaPreviewCard label="Output" src={previewSrc} emptyText={emptyText} />
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
        {onRetry && (
          <button type="button" className="button compact tertiary native-button" onClick={onRetry}>
            <RefreshCcw size={14} />
            Retry
          </button>
        )}
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
