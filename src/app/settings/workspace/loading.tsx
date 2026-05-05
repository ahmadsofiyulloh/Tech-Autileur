import {
  SkeletonInlineSummary,
  SkeletonManagerCards,
  SkeletonSearchToolbar,
} from "@/components/operator/loading-skeleton";

export default function WorkspaceSettingsLoading() {
  return (
    <div className="stack settings-page-body" aria-busy="true">
      <section className="product-master settings-manager settings-manager--workspace" aria-label="Memuat workspace">
        <div className="product-master__list stack">
          <SkeletonSearchToolbar />
          <SkeletonInlineSummary />
          <SkeletonManagerCards count={2} />
        </div>
      </section>
    </div>
  );
}
