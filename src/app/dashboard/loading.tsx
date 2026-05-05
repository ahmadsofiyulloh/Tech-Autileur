import { SkeletonDashboardActionRail, SkeletonMetricGrid } from "@/components/operator/loading-skeleton";

export default function DashboardLoading() {
  return (
    <div className="dashboard-page" aria-busy="true">
      <section className="dashboard-section" aria-label="Memuat aksi berikutnya">
        <div className="dashboard-section__header loading-skeleton-static" aria-hidden="true">
          <span className="icon-frame dashboard-section__icon skeleton-icon" />
          <span className="skeleton medium" />
        </div>
        <SkeletonDashboardActionRail />
      </section>
      <section className="dashboard-section" aria-label="Memuat metrik Gemini">
        <div className="dashboard-section__header loading-skeleton-static" aria-hidden="true">
          <span className="icon-frame dashboard-section__icon skeleton-icon" />
          <span className="skeleton medium" />
        </div>
        <SkeletonMetricGrid count={2} />
      </section>
      <section className="dashboard-section" aria-label="Memuat metrik Drive">
        <div className="dashboard-section__header loading-skeleton-static" aria-hidden="true">
          <span className="icon-frame dashboard-section__icon skeleton-icon" />
          <span className="skeleton medium" />
        </div>
        <SkeletonMetricGrid count={3} />
      </section>
    </div>
  );
}
