import type { ReactNode } from "react";
import { SkeletonLine } from "@/components/operator/loading-skeleton";

function DashboardPanelSkeleton({
  children,
  primary = false,
}: {
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <section className={`dashboard-panel${primary ? " dashboard-panel--primary dashboard-ops" : " dashboard-panel--secondary"}`}>
      <div className="dashboard-panel__header loading-skeleton-static" aria-hidden="true">
        <div className="dashboard-panel__title">
          <SkeletonLine size="short" />
          <SkeletonLine size="medium" />
        </div>
        <span className="skeleton-pill" />
      </div>
      {children}
    </section>
  );
}

function GeminiOperationsSkeleton() {
  return (
    <DashboardPanelSkeleton primary>
      <div className="dashboard-ops__body loading-skeleton-static" aria-hidden="true">
        <div className="dashboard-ops__main">
          <div className="dashboard-ops-metrics">
            {Array.from({ length: 3 }).map((_, index) => (
              <article className="dashboard-ops-metric" key={index}>
                <SkeletonLine size="short" />
                <SkeletonLine size="medium" />
                <SkeletonLine size="short" />
              </article>
            ))}
          </div>

          <article className="dashboard-issue-card">
            <div>
              <SkeletonLine size="short" />
              <SkeletonLine size="medium" />
              <SkeletonLine size="long" />
            </div>
            <SkeletonLine size="short" />
          </article>
        </div>

        <div className="dashboard-ops__side">
          <div className="dashboard-quota-panel">
            <div className="dashboard-subsection-title">
              <SkeletonLine size="short" />
              <SkeletonLine size="short" />
            </div>
            <div className="dashboard-quota-list">
              {Array.from({ length: 3 }).map((_, index) => (
                <div className="dashboard-quota-row" key={index}>
                  <div className="dashboard-quota-row__meta">
                    <SkeletonLine size="short" />
                    <SkeletonLine size="short" />
                  </div>
                  <span className="dashboard-quota-row__bar">
                    <span />
                  </span>
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
              {Array.from({ length: 2 }).map((_, index) => (
                <article className="dashboard-key-row" key={index}>
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
    </DashboardPanelSkeleton>
  );
}

function ActionQueueSkeleton() {
  return (
    <DashboardPanelSkeleton>
      <div className="dashboard-compact-list loading-skeleton-static" aria-hidden="true">
        {Array.from({ length: 3 }).map((_, index) => (
          <div className="dashboard-compact-row" key={index}>
            <span className="dashboard-tone-dot skeleton-icon skeleton-icon--small" />
            <span className="dashboard-compact-row__copy">
              <SkeletonLine size="medium" />
              <SkeletonLine size="short" />
            </span>
            <span className="skeleton-pill" />
            <span className="skeleton-icon skeleton-icon--small" />
          </div>
        ))}
      </div>
    </DashboardPanelSkeleton>
  );
}

function PipelineSkeleton() {
  return (
    <DashboardPanelSkeleton>
      <ol className="dashboard-pipeline-list loading-skeleton-static" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <li className="dashboard-pipeline-item" key={index}>
            <div>
              <span className="dashboard-pipeline-item__copy">
                <SkeletonLine size="medium" />
                <SkeletonLine size="short" />
              </span>
              <SkeletonLine size="short" />
              <span className="dashboard-pipeline-item__bar">
                <span />
              </span>
            </div>
          </li>
        ))}
      </ol>
    </DashboardPanelSkeleton>
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
          <ActionQueueSkeleton />
          <PipelineSkeleton />
        </aside>
      </div>
    </div>
  );
}
