import { KeyRound } from "lucide-react";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import type { AiMediaKeyStatus } from "@/lib/ai-media/mock-data";

function KeyRow({ item }: { item: AiMediaKeyStatus }) {
  return (
    <article className="ai-media-usage-key-row">
      <div className="ai-media-usage-row-heading">
        <strong>{item.label}</strong>
        <StatusBadge status={item.status} size="sm" />
      </div>
      <dl className="ai-media-usage-detail-list">
        <div><dt>Request</dt><dd>{item.requestToday}</dd></div>
        <div><dt>Fallback</dt><dd>{item.fallbackEligible ? "Ready" : "No"}</dd></div>
        <div><dt>Last used</dt><dd>{item.lastUsedLabel}</dd></div>
      </dl>
    </article>
  );
}

export function AiMediaUsageKeyList({ keys }: { keys: AiMediaKeyStatus[] }) {
  return (
    <SectionCard icon={KeyRound} title="Provider key status">
      <div className="ai-media-usage-key-list">
        {keys.map((k) => <KeyRow key={k.id} item={k} />)}
      </div>
    </SectionCard>
  );
}
