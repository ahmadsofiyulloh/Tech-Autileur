import { AlertTriangle } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import type { AiMediaRecentError } from "@/lib/ai-media/mock-data";

export function AiMediaUsageErrors({ errors }: { errors: AiMediaRecentError[] }) {
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
                  <strong>{err.toolType}</strong>
                  <span className="subtle">{err.timeLabel} — {err.keyLabel}</span>
                </div>
                <StatusBadge status={err.status} size="sm" />
              </div>
              <dl className="ai-media-usage-detail-list">
                <div><dt>Error</dt><dd>{err.message}</dd></div>
                <div><dt>Retry</dt><dd>{err.retryable ? "Ya" : "Tidak"}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
