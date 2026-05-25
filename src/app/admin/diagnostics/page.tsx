import { RefreshCw } from "lucide-react";
import { MetricCard } from "@/components/operator/metric-card";
import { NativeButton } from "@/components/ui/native-button";
import { fetchDiagnosticsData } from "./actions";
import { DiagnosticsStuckTasksTable } from "./stuck-tasks-table";
import { DiagnosticsKeyPoolTable } from "./key-pool-table";
import { DiagnosticsRecentErrorsList } from "./recent-errors-list";

export const dynamic = "force-dynamic";

export default async function DiagnosticsPage() {
  const data = await fetchDiagnosticsData();

  return (
    <div className="operator-page">
      <div className="operator-page__header diagnostics-header">
        <div className="diagnostics-header__title">
          <h1 className="operator-page__title">Diagnostics</h1>
          <p className="diagnostics-header__summary">
            Ringkasan status task, key pool, dan error terbaru.
          </p>
        </div>
        <form className="diagnostics-header__refresh">
          <NativeButton type="submit" className="compact">
            <RefreshCw className="icon" />
            Refresh
          </NativeButton>
        </form>
      </div>

      <div className="operator-page__body diagnostics-body">
        {/* Section 1: KPI Summary */}
        <section className="diagnostics-section">
          <div className="metric-grid ai-media-kpi-grid ai-media-kpi-grid--provider">
            <MetricCard
              className="ai-media-kpi"
              label="Task Stuck"
              value={data.totalStuck}
              detail="> 5 menit tanpa update"
              status={data.totalStuck > 0 ? <span className="status-badge status-badge--error">Perlu Perhatian</span> : null}
            />
            <MetricCard
              className="ai-media-kpi"
              label="Gemini Keys"
              value={`${data.keyPool.summary.active} / ${data.keyPool.summary.total}`}
              detail="Aktif dan siap digunakan"
              status={
                data.keyPool.summary.active === 0 ? (
                  <span className="status-badge status-badge--error">Tidak Ada Key</span>
                ) : null
              }
            />
            <MetricCard
              className="ai-media-kpi"
              label="Gagal (24 jam)"
              value={data.failedLast24h}
              detail="Task yang gagal hari ini"
            />
            <MetricCard className="ai-media-kpi" label="Antrian Aktif" value={data.activeQueue} detail="Sedang diproses" />
          </div>
        </section>

        {/* Section 2: Stuck Tasks */}
        <section className="diagnostics-section diagnostics-section--spaced">
          <h2 className="diagnostics-section__title">Stuck Tasks</h2>
          <DiagnosticsStuckTasksTable tasks={data.stuckTasks} />
        </section>

        {/* Section 3: Key Pool Status */}
        <section className="diagnostics-section diagnostics-section--spaced">
          <h2 className="diagnostics-section__title">Key Pool Status</h2>
          <DiagnosticsKeyPoolTable keys={data.keyPool.keys} />
        </section>

        {/* Section 4: Recent Errors */}
        <section className="diagnostics-section diagnostics-section--spaced">
          <h2 className="diagnostics-section__title">Recent Errors</h2>
          <DiagnosticsRecentErrorsList errors={data.recentErrors} />
        </section>
      </div>
    </div>
  );
}
