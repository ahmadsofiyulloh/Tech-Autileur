import { MetricCard } from "@/components/operator/metric-card";
import { StatusBadge } from "@/components/operator/status-badge";
import type { AiMediaProviderStatus as AiMediaProviderStatusData } from "@/lib/ai-media/mock-data";

type AiMediaProviderStatusProps = {
  provider: AiMediaProviderStatusData;
};

export function AiMediaProviderStatus({ provider }: AiMediaProviderStatusProps) {
  return (
    <div className="metric-grid ai-media-kpi-grid">
      <MetricCard
        className="ai-media-kpi ai-media-kpi--span"
        label="Provider"
        value={provider.provider}
        detail="Magnific API v2"
        status={
          <StatusBadge
            status={provider.state === "active" ? "ACTIVE" : provider.state === "missing" ? "MISSING" : "ERROR"}
            size="sm"
          />
        }
      />
      <MetricCard className="ai-media-kpi" label="Kunci Aktif" value={provider.activeKeyCount} detail="Main + Backup" />
      <MetricCard
        className="ai-media-kpi"
        label="Fallback"
        value={provider.fallbackReady ? "Siap" : "Belum"}
        detail={provider.fallbackReady ? "Auto-switch aktif" : "Tambah key cadangan"}
        status={
          <StatusBadge
            status={provider.fallbackReady ? "READY" : "NOT READY"}
            size="sm"
          />
        }
      />
      <MetricCard className="ai-media-kpi" label="Request Hari Ini" value={provider.requestsToday} detail="Reset 00:00 WIB" />
      <MetricCard className="ai-media-kpi" label="Task Aktif" value={provider.activeTaskCount} detail="Sedang berjalan" />
    </div>
  );
}
