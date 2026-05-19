import { SkeletonFilterTabs, SkeletonInlineSummary, SkeletonPromptCards, SkeletonSearchToolbar } from "@/components/operator/loading-skeleton";

export default function LoadingPromptsPage() {
  return (
    <div className="operator-detail-layout" aria-busy="true">
      <div className="operator-detail-layout__list stack prompt-page-stack">
        <SkeletonSearchToolbar />
        <SkeletonInlineSummary action={false} />
        <SkeletonFilterTabs count={8} className="desktop-action-set" />
        <div className="settings-inline-summary prompt-workbench-selection-summary desktop-action-set loading-skeleton-static" aria-hidden="true">
          <span className="skeleton short" />
          <span className="skeleton-button" />
        </div>
        <section className="stack" aria-label="Memuat paket prompt">
          <SkeletonPromptCards count={3} />
        </section>
      </div>
    </div>
  );
}
