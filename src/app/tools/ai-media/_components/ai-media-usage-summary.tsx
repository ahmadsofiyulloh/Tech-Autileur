import type { AiMediaUsageSnapshot } from "@/lib/server/ai-media";
import { MetricCard } from "@/components/operator/metric-card";
import { StatusBadge } from "@/components/operator/status-badge";

function formatTimestamp(value: string | null): string {
  if (!value) return "—";
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

export function AiMediaUsageSummaryGrid({ summary }: { summary: AiMediaUsageSnapshot }) {
  return (
    <section className="metric-grid ai-media-kpi-grid ai-media-kpi-grid--usage" aria-label="Usage summary">
      <MetricCard className="ai-media-kpi" label="Request today" value={summary.requestsToday} detail="Reset 00:00 WIB" />
      <MetricCard className="ai-media-kpi" label="Success" value={summary.successCount} detail="Hari ini" />
      <MetricCard className="ai-media-kpi" label="Failed" value={summary.failedCount} detail="Hari ini" />
      <MetricCard className="ai-media-kpi" label="Running" value={summary.runningCount} detail="Sedang berjalan" />
      <MetricCard className="ai-media-kpi" label="Waiting for key" value={summary.waitingForKeyCount} detail="Antrian" />
      <MetricCard className="ai-media-kpi" label="Active keys" value={summary.activeKeyCount} detail="Tersedia" />
      <MetricCard
        className="ai-media-kpi"
        label="Rate limited"
        value={summary.rateLimitedKeyCount}
        detail="Cooldown"
        status={summary.rateLimitedKeyCount > 0 ? <StatusBadge status="RATE LIMITED" size="sm" /> : undefined}
      />
      <MetricCard
        className="ai-media-kpi"
        label="Fallback"
        value={summary.fallbackReady ? "Siap" : "Belum"}
        detail={summary.fallbackReady ? "Auto-switch aktif" : "Tambah key cadangan"}
        status={<StatusBadge status={summary.fallbackReady ? "READY" : "NOT READY"} size="sm" />}
      />
      <MetricCard
        className="ai-media-kpi ai-media-kpi--span"
        label="Last used"
        value={formatTimestamp(summary.lastUsedAt)}
        detail="Waktu terakhir request"
      />
    </section>
  );
}
