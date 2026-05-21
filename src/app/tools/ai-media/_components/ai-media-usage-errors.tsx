import { AlertTriangle } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import type { AiMediaRecentErrorProjection } from "@/lib/server/ai-media";

const TOOL_LABELS: Record<string, string> = {
  MOTION_CONTROL: "Motion Control",
  IMAGE_TO_VIDEO: "Image to Video",
  UPSCALER: "Upscaler",
};

function formatTime(value: string): string {
  try {
    return new Date(value).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function AiMediaUsageErrors({ errors }: { errors: AiMediaRecentErrorProjection[] }) {
  return (
    <SectionCard icon={AlertTriangle} title="Recent errors">
      {errors.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="Tidak ada error." />
      ) : (
        <div className="ai-media-usage-key-list">
          {errors.map((err) => (
            <article key={err.id} className="ai-media-usage-key-row">
              <div className="ai-media-usage-row-heading">
                <div className="stack-tight">
                  <strong>{TOOL_LABELS[err.toolType] ?? err.toolType}</strong>
                  <span className="subtle">{formatTime(err.createdAt)} — {err.keyLabel ?? "Tanpa key"}</span>
                </div>
                <StatusBadge status={err.status} size="sm" />
              </div>
              <dl className="ai-media-usage-detail-list">
                <div><dt>Error</dt><dd>{err.errorMessage ?? "—"}</dd></div>
                <div><dt>Retry</dt><dd>{err.retryable ? "Ya" : "Tidak"}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
