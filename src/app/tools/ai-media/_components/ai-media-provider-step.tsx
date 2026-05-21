"use client";

import { MetricCard } from "@/components/operator/metric-card";
import { StatusBadge } from "@/components/operator/status-badge";
import type { AiMediaProviderProjection } from "@/lib/server/ai-media";

type AiMediaProviderStepProps = {
  provider: AiMediaProviderProjection | null;
};

export function AiMediaProviderStep({ provider }: AiMediaProviderStepProps) {
  if (!provider) {
    return (
      <div className="metric-grid ai-media-kpi-grid ai-media-kpi-grid--provider">
        <MetricCard className="ai-media-kpi" label="Status" value="—" detail="Memuat..." />
      </div>
    );
  }

  return (
    <div className="metric-grid ai-media-kpi-grid ai-media-kpi-grid--provider">
      <MetricCard
        className="ai-media-kpi"
        label="Status"
        value={provider.provider}
        detail={provider.state === "active" ? "API aktif" : provider.state === "missing" ? "Belum ada key" : "Ada masalah"}
        status={
          <StatusBadge
            status={provider.state === "active" ? "ACTIVE" : provider.state === "missing" ? "MISSING" : "ERROR"}
            size="sm"
          />
        }
      />
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
      <MetricCard className="ai-media-kpi" label="Kunci Aktif" value={provider.activeKeyCount} detail={`${provider.activeKeyCount} key siap`} />
      <MetricCard className="ai-media-kpi" label="Request" value={provider.requestsToday} detail="Reset 00:00 WIB" />
    </div>
  );
}
