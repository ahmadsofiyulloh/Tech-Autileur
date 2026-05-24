import { MetricCard } from "@/components/operator/metric-card";
import { getShareKpiMetrics } from "@/lib/server/share-kpi";

export async function ShareKpiSummary() {
  const metrics = await getShareKpiMetrics();

  return (
    <div className="metric-grid ai-media-kpi-grid ai-media-kpi-grid--provider">
      <MetricCard
        className="ai-media-kpi"
        label="Platform"
        value={metrics.platformCount}
        detail="Tersedia"
      />
      <MetricCard
        className="ai-media-kpi"
        label="Caption Hari Ini"
        value={metrics.captionsToday}
        detail="Generate baru"
      />
      <MetricCard
        className="ai-media-kpi"
        label="Total Generate"
        value={metrics.totalGenerations}
        detail="Semua platform"
      />
      <MetricCard
        className="ai-media-kpi"
        label="Antrian"
        value={metrics.queuedTasks}
        detail="Menunggu proses"
      />
    </div>
  );
}
