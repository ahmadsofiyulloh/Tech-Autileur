import { SkeletonLine } from "@/components/operator/loading-skeleton";

function GeminiOperationsSkeleton() {
  return (
    <section className="dashboard-panel dashboard-panel--primary dashboard-ops">
      <div className="dashboard-panel__header loading-skeleton-static" aria-hidden="true">
        <div className="dashboard-panel__title">
          <SkeletonLine size="short" />
          <SkeletonLine size="medium" />
        </div>
        <span className="skeleton-pill" />
      </div>
      <div className="dashboard-ops__body">
        <div className="dashboard-ops__main">
          <div className="metric-grid ai-media-kpi-grid ai-media-kpi-grid--dashboard loading-skeleton-static" aria-hidden="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <div className="ai-media-kpi metric" key={i}>
                <SkeletonLine size="short" />
                <SkeletonLine size="medium" />
                <SkeletonLine size="short" />
              </div>
            ))}
          </div>
          <article className="dashboard-issue-card loading-skeleton-static" aria-hidden="true">
            <div>
              <SkeletonLine size="short" />
              <SkeletonLine size="medium" />
              <SkeletonLine size="long" />
            </div>
            <SkeletonLine size="short" />
          </article>
        </div>
        <div className="dashboard-ops__side loading-skeleton-static" aria-hidden="true">
          <div className="dashboard-quota-panel">
            <div className="dashboard-subsection-title">
              <SkeletonLine size="short" />
              <SkeletonLine size="short" />
            </div>
            <div className="dashboard-quota-list">
              {Array.from({ length: 3 }).map((_, i) => (
                <div className="dashboard-quota-row" key={i}>
                  <div className="dashboard-quota-row__meta">
                    <SkeletonLine size="short" />
                    <SkeletonLine size="short" />
                  </div>
                  <span className="dashboard-quota-row__bar"><span /></span>
                  <SkeletonLine size="short" />
                </div>
              ))}
            </div>
          </div>
          <div className="dashboard-key-panel">
            <div className="dashboard-subsection-title">
              <SkeletonLine size="short" />
              <SkeletonLine size="short" />
            </div>
            <div className="dashboard-key-list">
              {Array.from({ length: 2 }).map((_, i) => (
                <article className="dashboard-key-row" key={i}>
                  <div>
                    <SkeletonLine size="medium" />
                    <SkeletonLine size="short" />
                  </div>
                  <span className="skeleton-pill" />
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ToolsQuickActionsSkeleton() {
  return (
    <section className="dashboard-panel dashboard-panel--secondary">
      <div className="dashboard-panel__header loading-skeleton-static" aria-hidden="true">
        <div className="dashboard-panel__title">
          <SkeletonLine size="short" />
          <SkeletonLine size="medium" />
        </div>
      </div>
      <div className="dashboard-tools-grid loading-skeleton-static" aria-hidden="true">
        {Array.from({ length: 2 }).map((_, i) => (
          <div className="ai-media-tool-card skeleton" key={i} />
        ))}
      </div>
    </section>
  );
}

function PipelineSkeleton() {
  return (
    <section className="dashboard-panel dashboard-panel--secondary">
      <div className="dashboard-panel__header loading-skeleton-static" aria-hidden="true">
        <div className="dashboard-panel__title">
          <SkeletonLine size="short" />
          <SkeletonLine size="medium" />
        </div>
      </div>
      <div className="metric-grid ai-media-kpi-grid ai-media-kpi-grid--pipeline loading-skeleton-static" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="ai-media-kpi metric" key={i}>
            <SkeletonLine size="short" />
            <SkeletonLine size="medium" />
            <SkeletonLine size="short" />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function DashboardLoading() {
  return (
    <div className="dashboard-page dashboard-page--command" aria-busy="true">
      <header className="dashboard-greeting loading-skeleton-static" aria-hidden="true">
        <div>
          <SkeletonLine size="short" />
          <SkeletonLine size="medium" />
          <SkeletonLine size="short" />
        </div>
        <SkeletonLine size="short" />
      </header>

      <div className="dashboard-command-layout">
        <div className="dashboard-command-layout__primary">
          <GeminiOperationsSkeleton />
        </div>
        <aside className="dashboard-command-layout__side" aria-label="Memuat ringkasan kerja">
          <ToolsQuickActionsSkeleton />
          <PipelineSkeleton />
        </aside>
      </div>
    </div>
  );
}
