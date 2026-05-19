import type { ReactNode } from "react";
import { SkeletonDashboardLiveCycleChart, SkeletonGeminiUsageOverview, SkeletonLine } from "@/components/operator/loading-skeleton";

function DashboardSectionSkeleton({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <section className="dashboard-section" aria-label={label}>
      <div className="dashboard-section__header loading-skeleton-static" aria-hidden="true">
        <span className="icon-frame dashboard-section__icon skeleton-icon" />
        <SkeletonLine size="medium" />
      </div>
      {children}
    </section>
  );
}

function SkeletonDashboardActionQueue() {
  return (
    <div className="dashboard-action-queue loading-skeleton-static" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, index) => (
        <div className="dashboard-action-row" key={index}>
          <span className="dashboard-action-row__dot skeleton-icon skeleton-icon--small" />
          <SkeletonLine size="long" />
          <span className="skeleton-pill" />
          <span className="skeleton-icon skeleton-icon--small" />
        </div>
      ))}
    </div>
  );
}

function SkeletonDashboardPipelineStrip() {
  return (
    <ol className="dashboard-pipeline-strip loading-skeleton-static" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <li className="dashboard-pipeline-strip__item" key={index}>
          <div className="dashboard-pipeline-strip__cell">
            <SkeletonLine size="short" />
            <SkeletonLine size="medium" />
          </div>
        </li>
      ))}
    </ol>
  );
}

function SkeletonDashboardMetricGrid() {
  return (
    <div className="metric-grid dashboard-kpi-grid loading-skeleton-static" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div className="metric dashboard-kpi" key={index}>
          <SkeletonLine size="short" />
          <SkeletonLine size="medium" />
          <i aria-hidden="true" />
        </div>
      ))}
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div className="dashboard-page dashboard-page--analysis" aria-busy="true">
      <div className="dashboard-command-center">
        <div className="dashboard-command-center__primary">
          <DashboardSectionSkeleton label="Memuat antrian aksi">
            <SkeletonDashboardActionQueue />
          </DashboardSectionSkeleton>

          <DashboardSectionSkeleton label="Memuat pipeline produk">
            <SkeletonDashboardPipelineStrip />
          </DashboardSectionSkeleton>
        </div>

        <DashboardSectionSkeleton label="Memuat ringkasan Gemini">
          <SkeletonDashboardMetricGrid />
        </DashboardSectionSkeleton>
      </div>

      <div className="dashboard-infrastructure dashboard-insight-grid" aria-label="Memuat infrastruktur Gemini">
        <DashboardSectionSkeleton label="Memuat siklus Gemini">
          <SkeletonDashboardLiveCycleChart />
        </DashboardSectionSkeleton>

        <SkeletonGeminiUsageOverview />
      </div>
    </div>
  );
}
