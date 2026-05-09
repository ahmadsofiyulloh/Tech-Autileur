import { SkeletonDashboardLiveCycleChart, SkeletonGeminiUsageOverview, SkeletonMetricGrid } from "@/components/operator/loading-skeleton";

export default function DashboardLoading() {
  return (
    <div className="dashboard-page" aria-busy="true">
      <section className="dashboard-section" aria-label="Memuat ringkasan Gemini">
        <div className="dashboard-section__header loading-skeleton-static" aria-hidden="true">
          <span className="icon-frame dashboard-section__icon skeleton-icon" />
          <span className="skeleton medium" />
        </div>
        <SkeletonMetricGrid count={4} />
      </section>
      <section className="dashboard-section" aria-label="Memuat live cycle Gemini">
        <div className="dashboard-section__header loading-skeleton-static" aria-hidden="true">
          <span className="icon-frame dashboard-section__icon skeleton-icon" />
          <span className="skeleton medium" />
        </div>
        <SkeletonDashboardLiveCycleChart />
      </section>
      <SkeletonGeminiUsageOverview />
    </div>
  );
}
