import {
  SkeletonControllerCard,
  SkeletonControllerHeader,
  SkeletonControllerRail,
  SkeletonLine,
} from "@/components/operator/loading-skeleton";

export default function ControllerLoading() {
  return (
    <div className="stack controller-desktop-content loading-skeleton-static" aria-busy="true">
      <SkeletonControllerHeader />
      <div className="controller-stepper-shell">
        <section className="controller-workflow-stepper" aria-hidden="true">
          <SkeletonControllerRail />
          <div className="controller-workflow-stepper__body">
            <div className="controller-stepper-panel">
              <section className="section-card panel controller-step-section">
                <div className="section-card__header">
                  <SkeletonLine size="medium" />
                  <span className="skeleton-pill" />
                </div>
                <div className="stack">
                  <SkeletonControllerCard />
                  <SkeletonControllerCard />
                </div>
              </section>
            </div>
            <aside className="controller-workflow-stepper__aside">
              <section className="controller-support-panel panel">
                <div className="controller-support-panel__header">
                  <SkeletonLine size="medium" />
                  <span className="skeleton-pill" />
                </div>
                <div className="controller-support-panel__body stack">
                  <SkeletonLine size="medium" />
                  <SkeletonLine size="long" />
                  <SkeletonLine size="short" />
                </div>
              </section>
            </aside>
          </div>
        </section>
      </div>
    </div>
  );
}
