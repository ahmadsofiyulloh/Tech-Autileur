import { KeyRound } from "lucide-react";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import type { AiMediaKeyMetadataProjection } from "@/lib/server/ai-media";

function formatLastUsed(value: string | null): string {
  if (!value) return "Belum";
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

function KeyRow({ item }: { item: AiMediaKeyMetadataProjection }) {
  return (
    <article className="ai-media-usage-key-row">
      <div className="ai-media-usage-row-heading">
        <strong>{item.label}</strong>
        <StatusBadge status={item.status} size="sm" />
      </div>
      <dl className="ai-media-usage-detail-list">
        <div><dt>Request</dt><dd>{item.requestsToday}</dd></div>
        <div><dt>Fallback</dt><dd>{item.fallbackEligible ? "Ready" : "No"}</dd></div>
        <div><dt>Last used</dt><dd>{formatLastUsed(item.lastUsedAt)}</dd></div>
      </dl>
    </article>
  );
}

export function AiMediaUsageKeyList({ keys }: { keys: AiMediaKeyMetadataProjection[] }) {
  return (
    <SectionCard icon={KeyRound} title="Provider key status">
      <div className="ai-media-usage-key-list">
        {keys.length ? (
          keys.map((k) => <KeyRow key={k.id} item={k} />)
        ) : (
          <p className="subtle">Belum ada key.</p>
        )}
      </div>
    </SectionCard>
  );
}
