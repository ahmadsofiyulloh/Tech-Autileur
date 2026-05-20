import { MetricCard } from "@/components/operator/metric-card";
import { StatusBadge } from "@/components/operator/status-badge";
import type { AiMediaUsageSummary } from "@/lib/ai-media/mock-data";

export function AiMediaUsageSummaryGrid({ summary }: { summary: AiMediaUsageSummary }) {
  return (
    <section className="metric-grid ai-media-kpi-grid ai-media-kpi-grid--usage" aria-label="Usage summary">
      <MetricCard className="ai-media-kpi" label="Request today" value={summary.requestToday} detail="Reset 00:00 WIB" />
      <MetricCard className="ai-media-kpi" label="Success" value={summary.success} detail="Hari ini" />
      <MetricCard className="ai-media-kpi" label="Failed" value={summary.failed} detail="Hari ini" />
      <MetricCard className="ai-media-kpi" label="Running" value={summary.running} detail="Sedang berjalan" />
      <MetricCard className="ai-media-kpi" label="Waiting for key" value={summary.waitingForKey} detail="Antrian" />
      <MetricCard className="ai-media-kpi" label="Active keys" value={summary.activeKeys} detail="Tersedia" />
      <MetricCard
        className="ai-media-kpi"
        label="Rate limited"
        value={summary.rateLimitedKeys}
        detail="Cooldown"
        status={summary.rateLimitedKeys > 0 ? <StatusBadge status="RATE LIMITED" size="sm" /> : undefined}
      />
      <MetricCard
        className="ai-media-kpi"
        label="Fallback"
        value={summary.fallbackReady ? "Siap" : "Belum"}
        detail={summary.fallbackReady ? "Auto-switch aktif" : "Tambah key cadangan"}
        status={<StatusBadge status={summary.fallbackReady ? "READY" : "NOT READY"} size="sm" />}
      />
      <MetricCard className="ai-media-kpi ai-media-kpi--span" label="Last used" value={summary.lastUsedLabel} detail="Waktu terakhir request" />
    </section>
  );
}
